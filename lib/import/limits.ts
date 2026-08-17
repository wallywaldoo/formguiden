export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MIN_UPLOAD_BYTES = 1;
export const MAX_ZIP_ENTRIES = 100;
export const MAX_ZIP_NESTING = 3;
export const MAX_UNCOMPRESSED_TOTAL_BYTES = 200 * 1024 * 1024;
export const MAX_ZIP_INFLATE_RATIO = 50;
export const SLICE_BUDGET_MS = 20_000;
export const PREVIEW_TTL_DAYS = 7;
export const PROCESS_LEASE_SECONDS = 45;

export const IMPORT_SOURCE = "garmin-file" as const;
