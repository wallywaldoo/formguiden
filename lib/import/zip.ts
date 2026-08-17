import { unzipSync } from "fflate";

import { detectFileKind } from "@/lib/import/detect";
import {
  MAX_UNCOMPRESSED_TOTAL_BYTES,
  MAX_UPLOAD_BYTES,
  MAX_ZIP_ENTRIES,
  MAX_ZIP_INFLATE_RATIO,
  MAX_ZIP_NESTING,
} from "@/lib/import/limits";
import { escapeZipPath } from "@/lib/import/normalize";
import type { ZipEntry } from "@/lib/import/types";

export class ZipLimitError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ZipLimitError";
    this.code = code;
  }
}

export function listZipEntries(bytes: Uint8Array, depth = 1): ZipEntry[] {
  if (depth > MAX_ZIP_NESTING) {
    throw new ZipLimitError(
      "zip_nesting",
      "ZIP-arkivet är för djupt nästlat. Dela upp exporten.",
    );
  }

  let entryCount = 0;
  let uncompressedTotal = 0;

  let unpacked: Record<string, Uint8Array>;
  try {
    unpacked = unzipSync(bytes, {
      filter(file) {
        entryCount += 1;
        if (entryCount > MAX_ZIP_ENTRIES) {
          throw new ZipLimitError(
            "zip_entries",
            "ZIP-arkivet har fler än 100 filer. Ladda upp enskilda aktiviteter.",
          );
        }
        if (file.originalSize > MAX_UPLOAD_BYTES) {
          throw new ZipLimitError(
            "zip_entry_too_large",
            "En fil i ZIP-arkivet är större än 25 MiB.",
          );
        }
        uncompressedTotal += file.originalSize;
        if (uncompressedTotal > MAX_UNCOMPRESSED_TOTAL_BYTES) {
          throw new ZipLimitError(
            "zip_uncompressed_total",
            "Okomprimerad storlek överstiger 200 MB.",
          );
        }
        if (
          file.size >= 1024 &&
          file.originalSize / file.size > MAX_ZIP_INFLATE_RATIO
        ) {
          throw new ZipLimitError(
            "zip_bomb",
            "Komprimeringsförhållandet ser ut som en zip-bomb. Filen avvisades.",
          );
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof ZipLimitError) {
      throw error;
    }
    throw new ZipLimitError("zip_corrupt", "Kunde inte läsa ZIP-arkivet.");
  }

  const entries: ZipEntry[] = [];
  for (const [path, content] of Object.entries(unpacked)) {
    if (content.byteLength > MAX_UPLOAD_BYTES) {
      throw new ZipLimitError(
        "zip_entry_too_large",
        "En fil i ZIP-arkivet är större än 25 MiB.",
      );
    }
    const safePath = escapeZipPath(path);
    if (detectFileKind(content) === "zip") {
      const nested = listZipEntries(content, depth + 1);
      for (const nestedEntry of nested) {
        entries.push({
          path: `${safePath}/${nestedEntry.path}`,
          bytes: nestedEntry.bytes,
        });
      }
    } else {
      entries.push({ path: safePath, bytes: content });
    }
    if (entries.length > MAX_ZIP_ENTRIES) {
      throw new ZipLimitError(
        "zip_entries",
        "ZIP-arkivet har fler än 100 filer. Ladda upp enskilda aktiviteter.",
      );
    }
  }

  return entries;
}
