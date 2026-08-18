export const GARMINDB_REJECTION_CODES = [
  "not_sqlite",
  "not_garmindb",
  "unsupported_database",
  "unsupported_schema_version",
  "missing_required_table",
  "missing_required_column",
  "schema_object_rejected",
  "measurement_system_unknown",
  "row_budget_exceeded",
  "time_budget_exceeded",
  "file_too_large",
  "archive_shape_rejected",
  "sqlite_unreadable",
] as const;

export type GarminDbRejectionCode = (typeof GARMINDB_REJECTION_CODES)[number];

/**
 * Rejection carries a category code and a Swedish message safe to show the
 * user. It must never embed file content, SQL, or engine internals.
 */
export class GarminDbRejectionError extends Error {
  readonly code: GarminDbRejectionCode;

  constructor(code: GarminDbRejectionCode, message: string) {
    super(message);
    this.name = "GarminDbRejectionError";
    this.code = code;
  }
}

export function reject(code: GarminDbRejectionCode, message: string): never {
  throw new GarminDbRejectionError(code, message);
}
