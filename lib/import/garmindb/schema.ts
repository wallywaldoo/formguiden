/**
 * The supported slice of GarminDB's `garmin.db`.
 *
 * GarminDB records its own schema version in the `_attributes` key-value table
 * under `db.version`, and refuses to open a database whose version does not
 * match its code. We pin against that same number instead of guessing from
 * table shapes.
 *
 * Only the columns listed here are ever read. Device serial numbers, file
 * paths, and every identity-bearing column stay outside the allowlist by
 * construction, so they cannot reach the application.
 */

export const GARMINDB_DATABASE_NAME = "garmin";

/** `_attributes.db.version` must equal this exactly. */
export const SUPPORTED_DB_VERSION = 14;

/** Other GarminDB databases are recognised so we can reject them by name. */
export const KNOWN_UNSUPPORTED_DATABASES = [
  "garmin_activities",
  "garmin_monitoring",
  "garmin_summary",
  "summary",
  "fitbit",
  "mshealth",
] as const;

export const ATTRIBUTES_TABLE = "attributes";
export const DB_ATTRIBUTES_TABLE = "_attributes";

export type TableSpec = {
  /** Absent required column rejects the file. */
  required: readonly string[];
  /** Absent optional column yields null plus a warning. */
  optional: readonly string[];
};

export const SUPPORTED_TABLES = {
  sleep: {
    required: ["day"],
    optional: [
      "start",
      "end",
      "total_sleep",
      "deep_sleep",
      "light_sleep",
      "rem_sleep",
      "awake",
      "avg_rr",
      "avg_stress",
    ],
  },
  resting_hr: {
    required: ["day"],
    optional: ["resting_heart_rate"],
  },
  weight: {
    required: ["day", "weight"],
    optional: [],
  },
  hrv: {
    required: ["day"],
    optional: ["last_night_avg"],
  },
  daily_summary: {
    required: ["day"],
    optional: [
      "rhr",
      "stress_avg",
      "steps",
      "bb_max",
      "bb_min",
      "rr_waking_avg",
    ],
  },
} as const satisfies Record<string, TableSpec>;

export type SupportedTable = keyof typeof SUPPORTED_TABLES;

export const SUPPORTED_TABLE_NAMES = Object.keys(
  SUPPORTED_TABLES,
) as SupportedTable[];

/**
 * `sleep` and `weight` are the tables that make the import worth doing. If
 * neither is present the file is a GarminDB database we cannot use.
 */
export const MINIMUM_USEFUL_TABLES: readonly SupportedTable[] = [
  "sleep",
  "weight",
  "resting_hr",
  "daily_summary",
];

export const MAX_ROWS_PER_TABLE = 50_000;
export const MAX_ROWS_PER_IMPORT = 200_000;
export const GARMINDB_SLICE_BUDGET_MS = 15_000;
