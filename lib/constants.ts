export const PRODUCT_NAME = "Formkurvan";

export const PRIVACY_DOCUMENT_VERSION = "mvp-2026-08-17";

export const HALF_MARATHON_DISTANCE_M = 21_097.5;
export const MARATHON_DISTANCE_M = 42_195;
export const FIVE_K_DISTANCE_M = 5_000;
export const TEN_K_DISTANCE_M = 10_000;

export const RACE_TYPES = [
  "5k",
  "10k",
  "half_marathon",
  "marathon",
  "custom",
] as const;

export type RaceType = (typeof RACE_TYPES)[number];

export const RACE_DISTANCE_M: Record<Exclude<RaceType, "custom">, number> = {
  "5k": FIVE_K_DISTANCE_M,
  "10k": TEN_K_DISTANCE_M,
  half_marathon: HALF_MARATHON_DISTANCE_M,
  marathon: MARATHON_DISTANCE_M,
};

export const DEFAULT_TIMEZONE = "Europe/Stockholm";
export const DEFAULT_LOCALE = "sv-SE";

export const PKCE_VERIFIER_COOKIE = "nhost_pkce_verifier";

export const GARMIN_IMPORTS_BUCKET = "garmin-imports";
export const USER_EXPORTS_BUCKET = "user-exports";
/**
 * Uploads land here before validation and graduate to garmin-imports only
 * after passing every check. Objects that never graduate are deleted.
 */
export const GARMINDB_QUARANTINE_BUCKET = "garmindb-quarantine";

export const ACCOUNT_DELETION_GRACE_DAYS = 7;
export const RECOMMENDATION_VALID_HOURS = 24;
export const EXPORT_MAX_GARMIN_BYTES = 20 * 1024 * 1024;

export const PASSWORD_MIN_LENGTH = 9;
export const PASSWORD_MAX_LENGTH = 50;
