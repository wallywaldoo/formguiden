import { garminFileAdapter } from "@/lib/import/adapters/garmin-file";
import { detectFileKind, type FileKind } from "@/lib/import/detect";
import { MAX_UPLOAD_BYTES, MIN_UPLOAD_BYTES } from "@/lib/import/limits";
import type { ParseResult } from "@/lib/import/types";

export type InspectedFile = {
  kind: FileKind;
  parse: ParseResult;
};

export function inspectAndParse(bytes: Uint8Array): InspectedFile {
  if (
    bytes.byteLength < MIN_UPLOAD_BYTES ||
    bytes.byteLength > MAX_UPLOAD_BYTES
  ) {
    return {
      kind: "unknown",
      parse: {
        activities: [],
        dailyHealth: [],
        bodyMeasurements: [],
        warnings: [
          {
            code: "size",
            message: "Filen är utanför tillåten storlek (1 B–25 MiB).",
          },
        ],
      },
    };
  }

  const kind = detectFileKind(bytes);
  if (kind === "zip") {
    return {
      kind,
      parse: {
        activities: [],
        dailyHealth: [],
        bodyMeasurements: [],
        warnings: [],
      },
    };
  }

  const detected = garminFileAdapter.detect(bytes) ?? kind;
  return {
    kind: detected,
    parse: garminFileAdapter.parse(bytes, { fileKind: detected }),
  };
}
