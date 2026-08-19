import { mapGarminConnectPayload } from "@/lib/import/garmin-connect/map";
import {
  GARMIN_CONNECT_SCHEMA_VERSION,
  garminConnectPayloadSchema,
  type GarminConnectProvenance,
} from "@/lib/import/garmin-connect/schema";
import type { ParseResult } from "@/lib/import/types";

export class GarminConnectRejectionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "GarminConnectRejectionError";
    this.code = code;
  }
}

export type GarminConnectImportProvenance = GarminConnectProvenance & {
  schemaVersion: number;
  dayCount: number;
  bodyMeasurementCount: number;
};

export type GarminConnectImportResult = {
  result: ParseResult;
  provenance: GarminConnectImportProvenance;
};

export function parseGarminConnectUpload(
  bytes: Uint8Array,
): GarminConnectImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    throw new GarminConnectRejectionError(
      "invalid_json",
      "Filen är inte giltig JSON.",
    );
  }

  const parsed = garminConnectPayloadSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "";
    throw new GarminConnectRejectionError(
      "schema_mismatch",
      path
        ? `Fältet ${path} är ogiltigt: ${issue?.message}`
        : (issue?.message ?? "Nyttolasten matchar inte förväntat format."),
    );
  }

  const payload = parsed.data;
  const result = mapGarminConnectPayload(payload);

  return {
    result,
    provenance: {
      ...payload.provenance,
      schemaVersion: GARMIN_CONNECT_SCHEMA_VERSION,
      dayCount: result.dailyHealth.length,
      bodyMeasurementCount: result.bodyMeasurements.length,
    },
  };
}
