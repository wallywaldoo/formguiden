import type { ImportProviderAdapter } from "@/lib/import/adapters/types";
import { detectFileKind, type FileKind } from "@/lib/import/detect";
import { parseCsv } from "@/lib/import/csv/parse";
import { parseFit } from "@/lib/import/fit/parse";
import { parseGpx } from "@/lib/import/gpx/parse";
import { parseTcx } from "@/lib/import/tcx/parse";
import type { ParseResult } from "@/lib/import/types";

export function parseDetectedBytes(
  bytes: Uint8Array,
  fileKind: FileKind,
): ParseResult {
  switch (fileKind) {
    case "fit":
      return parseFit(bytes);
    case "tcx":
      return parseTcx(bytes);
    case "gpx":
      return parseGpx(bytes);
    case "csv":
      return parseCsv(bytes);
    default:
      return {
        activities: [],
        dailyHealth: [],
        bodyMeasurements: [],
        warnings: [
          {
            code: "unsupported_kind",
            message:
              "Filtypen stöds inte. Använd FIT, TCX, GPX, CSV eller ZIP.",
          },
        ],
      };
  }
}

export const garminFileAdapter: ImportProviderAdapter = {
  id: "garmin-file",
  detect(bytes) {
    const kind = detectFileKind(bytes);
    return kind === "unknown" ? null : kind;
  },
  parse(bytes, context) {
    return parseDetectedBytes(bytes, context.fileKind);
  },
  externalId(record) {
    return record.externalId;
  },
};
