import { unzipSync } from "fflate";

import { assertNoCredentialMaterial } from "@/lib/import/credentials/scan";
import { reject } from "@/lib/import/garmindb/errors";
import { isSqliteFile } from "@/lib/import/garmindb/open";
import { MAX_UPLOAD_BYTES } from "@/lib/import/limits";

/**
 * A GarminDB upload has exactly one legitimate shape: a single garmin.db,
 * optionally inside a flat ZIP. These limits are deliberately tighter than the
 * general import path, which has to tolerate Garmin's own nested account dumps.
 */
export const GARMINDB_MAX_ZIP_ENTRIES = 20;
export const GARMINDB_MAX_INFLATE_RATIO = 100;

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const UNIX_MODE_MASK = 0xf000;
const UNIX_SYMLINK = 0xa000;

export type CentralDirectoryEntry = {
  name: string;
  unixMode: number;
  isSymlink: boolean;
  compressedSize: number;
  uncompressedSize: number;
};

function findEndOfCentralDirectory(view: DataView): number {
  // The EOCD sits at the end, after a comment of at most 65535 bytes.
  const minimum = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) {
      return offset;
    }
  }
  return -1;
}

/**
 * Reads the central directory so we can see external attributes. fflate does
 * not surface them, and without them a symlink entry is indistinguishable from
 * a small text file.
 */
export function readCentralDirectory(
  bytes: Uint8Array,
): CentralDirectoryEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd === -1) {
    reject("archive_shape_rejected", "ZIP-arkivet kunde inte läsas.");
  }

  const entryCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  if (entryCount === 0xffff || offset === 0xffffffff) {
    reject(
      "archive_shape_rejected",
      "ZIP64-arkiv stöds inte. Ladda upp garmin.db direkt.",
    );
  }
  if (entryCount > GARMINDB_MAX_ZIP_ENTRIES) {
    reject(
      "archive_shape_rejected",
      `ZIP-arkivet har fler än ${GARMINDB_MAX_ZIP_ENTRIES} filer. Ladda upp endast garmin.db.`,
    );
  }

  const entries: CentralDirectoryEntry[] = [];
  const decoder = new TextDecoder("utf-8", { fatal: false });

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > view.byteLength) {
      reject("archive_shape_rejected", "ZIP-arkivet är skadat.");
    }
    if (view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      reject("archive_shape_rejected", "ZIP-arkivet är skadat.");
    }

    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);

    const nameStart = offset + 46;
    const name = decoder.decode(
      bytes.subarray(nameStart, nameStart + nameLength),
    );

    const unixMode = (externalAttributes >>> 16) & 0xffff;
    entries.push({
      name,
      unixMode,
      isSymlink: (unixMode & UNIX_MODE_MASK) === UNIX_SYMLINK,
      compressedSize,
      uncompressedSize,
    });

    offset = nameStart + nameLength + extraLength + commentLength;
  }

  return entries;
}

const TRAVERSAL_PATTERNS = [
  /(^|[\\/])\.\.([\\/]|$)/,
  /^[\\/]/,
  /^[A-Za-z]:/,
  /\\/,
  /\0/,
];

export function isUnsafePath(path: string): boolean {
  return TRAVERSAL_PATTERNS.some((pattern) => pattern.test(path));
}

function pathSegments(path: string): string[] {
  return path.split("/").filter((segment) => segment.length > 0);
}

/**
 * A GarminDB home directory contains databases, downloaded FIT files, and the
 * credential config side by side. Uploading the whole thing is the single most
 * likely way a user would hand us their Garmin password by accident.
 */
export function looksLikeGarminDbHome(paths: string[]): boolean {
  let signals = 0;
  const segments = paths.flatMap((path) => pathSegments(path));
  const lower = segments.map((segment) => segment.toLowerCase());

  if (lower.includes("dbs")) {
    signals += 1;
  }
  if (lower.includes("fitfiles")) {
    signals += 1;
  }
  if (lower.includes(".garmindb")) {
    signals += 1;
  }
  const databaseCount = paths.filter((path) =>
    path.toLowerCase().endsWith(".db"),
  ).length;
  if (databaseCount > 1) {
    signals += 1;
  }
  return signals >= 2;
}

export type ArchiveExtraction = {
  bytes: Uint8Array;
  entryPath: string;
};

/**
 * Decides whether an archive belongs to the GarminDB path. Content-based, so a
 * renamed `.zip` full of FIT files is not diverted here.
 */
export function entriesContainDatabase(
  entries: readonly { bytes: Uint8Array }[],
): boolean {
  return entries.some((entry) => isSqliteFile(entry.bytes));
}

/**
 * Validates a ZIP and returns the single SQLite member it must contain.
 *
 * Every entry is scanned for credential material before anything is selected,
 * so a hostile archive cannot smuggle a config file past us by pairing it with
 * a valid database.
 */
export function extractSingleDatabase(bytes: Uint8Array): ArchiveExtraction {
  const central = readCentralDirectory(bytes);

  for (const entry of central) {
    if (entry.isSymlink) {
      reject(
        "archive_shape_rejected",
        "ZIP-arkivet innehåller symboliska länkar och avvisades.",
      );
    }
    if (isUnsafePath(entry.name)) {
      reject(
        "archive_shape_rejected",
        "ZIP-arkivet innehåller ogiltiga sökvägar och avvisades.",
      );
    }
    if (entry.uncompressedSize > MAX_UPLOAD_BYTES) {
      reject(
        "archive_shape_rejected",
        "En fil i ZIP-arkivet är större än 25 MiB.",
      );
    }
    if (
      entry.compressedSize >= 1024 &&
      entry.uncompressedSize / entry.compressedSize > GARMINDB_MAX_INFLATE_RATIO
    ) {
      reject(
        "archive_shape_rejected",
        "Komprimeringsförhållandet ser ut som en zip-bomb. Filen avvisades.",
      );
    }
  }

  const names = central.map((entry) => entry.name);
  if (looksLikeGarminDbHome(names)) {
    reject(
      "archive_shape_rejected",
      "Ladda upp endast garmin.db, inte hela HealthData-mappen. Mappen innehåller dina Garmin-inloggningsuppgifter, som Formkurvan aldrig tar emot.",
    );
  }

  let unpacked: Record<string, Uint8Array>;
  try {
    unpacked = unzipSync(bytes);
  } catch {
    reject("archive_shape_rejected", "ZIP-arkivet kunde inte packas upp.");
  }

  const candidates: ArchiveExtraction[] = [];
  for (const [path, content] of Object.entries(unpacked)) {
    if (content.byteLength === 0) {
      continue;
    }
    // Rejection is upload-wide: one bad entry condemns the archive.
    assertNoCredentialMaterial(content);

    if (isSqliteFile(content)) {
      candidates.push({ bytes: content, entryPath: path });
      continue;
    }
    if (isZip(content)) {
      reject(
        "archive_shape_rejected",
        "Nästlade ZIP-arkiv stöds inte i den här importen. Ladda upp garmin.db direkt.",
      );
    }
  }

  if (candidates.length === 0) {
    reject(
      "archive_shape_rejected",
      "ZIP-arkivet innehåller ingen garmin.db-databas.",
    );
  }
  if (candidates.length > 1) {
    reject(
      "archive_shape_rejected",
      "ZIP-arkivet innehåller flera databaser. Ladda upp endast garmin.db.",
    );
  }

  return candidates[0];
}

function isZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06)
  );
}
