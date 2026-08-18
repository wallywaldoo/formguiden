import { assertNoCredentialMaterial } from "@/lib/import/credentials/scan";
import { extractSingleDatabase } from "@/lib/import/garmindb/archive";
import { mapGarminDb } from "@/lib/import/garmindb/map";
import {
  isSqliteFile,
  openGarminDb,
  type GarminDbProvenance,
} from "@/lib/import/garmindb/open";
import { reject } from "@/lib/import/garmindb/errors";
import {
  describeMeasurementSystem,
  resolveMeasurementSystem,
  type MeasurementSystem,
} from "@/lib/import/garmindb/units";
import { isValidTimeZone } from "@/lib/import/garmindb/time";
import type { ParseResult } from "@/lib/import/types";

export const GARMINDB_SOURCE = "garmindb" as const;

export type GarminDbImportContext = {
  /** From user_preferences. Naive GarminDB timestamps are read in this zone. */
  timeZone: string;
};

export type GarminDbImportProvenance = GarminDbProvenance & {
  measurementSystem: MeasurementSystem;
  assumedTimeZone: string;
  entryPath: string | null;
};

export type GarminDbImportResult = {
  result: ParseResult;
  provenance: GarminDbImportProvenance;
  /** Shown in the preview so the user can catch a wrong unit system. */
  measurementSystemLabel: string;
};

function isZipFile(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06)
  );
}

export function isGarminDbCandidate(bytes: Uint8Array): boolean {
  return isSqliteFile(bytes) || isZipFile(bytes);
}

/**
 * Validates and parses a GarminDB upload.
 *
 * Order matters: credential material is rejected before the file is opened,
 * and the unit system is resolved before any value is mapped.
 */
export async function parseGarminDbUpload(
  bytes: Uint8Array,
  context: GarminDbImportContext,
): Promise<GarminDbImportResult> {
  const timeZone = isValidTimeZone(context.timeZone)
    ? context.timeZone
    : "Europe/Stockholm";

  assertNoCredentialMaterial(bytes);

  let databaseBytes = bytes;
  let entryPath: string | null = null;

  if (isZipFile(bytes)) {
    const extracted = extractSingleDatabase(bytes);
    databaseBytes = extracted.bytes;
    entryPath = extracted.entryPath;
  }

  if (!isSqliteFile(databaseBytes)) {
    reject("not_sqlite", "Filen är inte en SQLite-databas.");
  }

  const reader = await openGarminDb(databaseBytes);
  try {
    const measurementSystem = resolveMeasurementSystem(
      reader.measurementSystemRaw,
    );

    const mapped = mapGarminDb(reader, { timeZone, measurementSystem });

    return {
      result: {
        activities: [],
        dailyHealth: mapped.dailyHealth,
        bodyMeasurements: mapped.bodyMeasurements,
        warnings: mapped.warnings,
      },
      provenance: {
        ...reader.provenance,
        measurementSystem,
        assumedTimeZone: timeZone,
        entryPath,
      },
      measurementSystemLabel: describeMeasurementSystem(measurementSystem),
    };
  } finally {
    reader.close();
  }
}
