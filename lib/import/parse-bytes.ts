import { garminFileAdapter } from "@/lib/import/adapters/garmin-file";
import type { ImportProviderId } from "@/lib/import/adapters/types";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { scanForCredentialMaterial } from "@/lib/import/credentials/scan";
import { detectFileKind, type FileKind } from "@/lib/import/detect";
import {
  GarminConnectRejectionError,
  parseGarminConnectUpload,
} from "@/lib/import/garmin-connect";
import { parseGarminDbUpload } from "@/lib/import/garmindb";
import { entriesContainDatabase } from "@/lib/import/garmindb/archive";
import { GarminDbRejectionError } from "@/lib/import/garmindb/errors";
import { MAX_UPLOAD_BYTES, MIN_UPLOAD_BYTES } from "@/lib/import/limits";
import type { ImportWarning, ParseResult } from "@/lib/import/types";
import { listZipEntries } from "@/lib/import/zip";

export type InspectedFile = {
  kind: FileKind;
  source: ImportProviderId;
  parse: ParseResult;
  /** Non-identifying parse metadata persisted alongside the import file. */
  provenance?: Record<string, unknown>;
};

function empty(warnings: ImportWarning[] = []): ParseResult {
  return {
    activities: [],
    dailyHealth: [],
    bodyMeasurements: [],
    warnings,
  };
}

function rejected(
  kind: FileKind,
  source: ImportProviderId,
  code: string,
  message: string,
): InspectedFile {
  return { kind, source, parse: empty([{ code, message }]) };
}

/**
 * A ZIP we cannot read is not routed here. The caller already reports unzip
 * failures, and duplicating that error would change the message users see.
 */
function archiveHoldsDatabase(kind: FileKind, bytes: Uint8Array): boolean {
  if (kind !== "zip") {
    return false;
  }
  try {
    return entriesContainDatabase(listZipEntries(bytes));
  } catch {
    return false;
  }
}

export async function inspectAndParse(
  bytes: Uint8Array,
  context: { timeZone?: string } = {},
): Promise<InspectedFile> {
  if (
    bytes.byteLength < MIN_UPLOAD_BYTES ||
    bytes.byteLength > MAX_UPLOAD_BYTES
  ) {
    return rejected(
      "unknown",
      "garmin-file",
      "size",
      "Filen är utanför tillåten storlek (1 B–25 MiB).",
    );
  }

  // Runs before any parser touches the bytes, for every source.
  const credentialFinding = scanForCredentialMaterial(bytes);
  if (credentialFinding) {
    return rejected(
      "unknown",
      "garmin-file",
      credentialFinding.code,
      credentialFinding.message,
    );
  }

  const kind = detectFileKind(bytes);

  // A ZIP wrapping a database goes through the GarminDB archive rules as one
  // unit, so its symlink, traversal, and home-directory checks apply.
  const isGarminDb = kind === "sqlite" || archiveHoldsDatabase(kind, bytes);

  if (isGarminDb) {
    try {
      const outcome = await parseGarminDbUpload(bytes, {
        timeZone: context.timeZone ?? DEFAULT_TIMEZONE,
      });
      return {
        kind,
        source: "garmindb",
        parse: outcome.result,
        provenance: { garmindb: outcome.provenance },
      };
    } catch (error) {
      if (error instanceof GarminDbRejectionError) {
        return rejected(kind, "garmindb", error.code, error.message);
      }
      throw error;
    }
  }

  if (kind === "json") {
    try {
      const outcome = parseGarminConnectUpload(bytes);
      return {
        kind,
        source: "garmin-connect",
        parse: outcome.result,
        provenance: { garminConnect: outcome.provenance },
      };
    } catch (error) {
      if (error instanceof GarminConnectRejectionError) {
        return rejected(kind, "garmin-connect", error.code, error.message);
      }
      throw error;
    }
  }

  if (kind === "zip") {
    return { kind, source: "garmin-file", parse: empty() };
  }

  const detected = garminFileAdapter.detect(bytes) ?? kind;
  return {
    kind: detected,
    source: "garmin-file",
    parse: await garminFileAdapter.parse(bytes, { fileKind: detected }),
  };
}
