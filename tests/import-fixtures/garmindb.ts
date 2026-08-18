import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";

/**
 * Builds real SQLite files shaped like GarminDB's `garmin.db`, so the parser
 * is exercised against actual bytes rather than a mock. Column types follow
 * GarminDB's SQLAlchemy models: days are DATETIME, durations are TIME text.
 */

const require = createRequire(import.meta.url);

let cached: SqlJsStatic | null = null;

export async function sqlJs(): Promise<SqlJsStatic> {
  if (!cached) {
    const file = readFileSync(require.resolve("sql.js/dist/sql-wasm.wasm"));
    cached = await initSqlJs({
      wasmBinary: file.buffer.slice(
        file.byteOffset,
        file.byteOffset + file.byteLength,
      ) as ArrayBuffer,
    });
  }
  return cached;
}

export const CURRENT_DB_VERSION = 14;

export type SleepFixture = {
  day: string;
  start?: string | null;
  end?: string | null;
  total_sleep?: string | null;
  deep_sleep?: string | null;
  light_sleep?: string | null;
  rem_sleep?: string | null;
  awake?: string | null;
  avg_rr?: number | null;
  avg_stress?: number | null;
};

export type DailySummaryFixture = {
  day: string;
  rhr?: number | null;
  stress_avg?: number | null;
  steps?: number | null;
  bb_max?: number | null;
  bb_min?: number | null;
  rr_waking_avg?: number | null;
};

export type GarminDbFixture = {
  dbVersion?: number;
  measurementSystem?: string | null;
  sleep?: SleepFixture[];
  weight?: { day: string; weight: number }[];
  restingHr?: { day: string; resting_heart_rate: number }[];
  hrv?: { day: string; last_night_avg: number }[];
  dailySummary?: DailySummaryFixture[];
  /** Extra statements run after the standard schema, for hostile-file tests. */
  extraSql?: string;
  /** Omit tables entirely, to model an older or partial database. */
  omitTables?: string[];
};

function insertKeyValue(
  db: Database,
  table: string,
  pairs: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(pairs)) {
    db.run(`INSERT INTO ${table} (timestamp, key, value) VALUES (?, ?, ?)`, [
      "2026-08-01 12:00:00.000000",
      key,
      value,
    ]);
  }
}

export async function buildGarminDb(
  fixture: GarminDbFixture = {},
): Promise<Uint8Array> {
  const SQL = await sqlJs();
  const db = new SQL.Database();
  const omit = new Set(fixture.omitTables ?? []);

  try {
    db.run(
      `CREATE TABLE _attributes (timestamp DATETIME, key VARCHAR NOT NULL, value VARCHAR, PRIMARY KEY (key));
       CREATE TABLE attributes (timestamp DATETIME, key VARCHAR NOT NULL, value VARCHAR, PRIMARY KEY (key));`,
    );

    insertKeyValue(db, "_attributes", {
      "db.version": String(fixture.dbVersion ?? CURRENT_DB_VERSION),
      "sleep.version": "4",
      "weight.version": "2",
      "resting_hr.version": "2",
      "daily_summary.version": "5",
    });

    const system =
      fixture.measurementSystem === undefined
        ? "DisplayMeasure.metric"
        : fixture.measurementSystem;
    if (system !== null) {
      insertKeyValue(db, "attributes", {
        measurement_system: system,
        gender: "Gender.male",
      });
    }

    if (!omit.has("sleep")) {
      db.run(
        `CREATE TABLE sleep (
           day DATE NOT NULL, start DATETIME, end DATETIME,
           total_sleep TIME, deep_sleep TIME, light_sleep TIME,
           rem_sleep TIME, awake TIME, avg_spo2 FLOAT, avg_rr FLOAT,
           avg_stress FLOAT, PRIMARY KEY (day))`,
      );
      for (const row of fixture.sleep ?? []) {
        db.run(
          `INSERT INTO sleep (day, start, end, total_sleep, deep_sleep, light_sleep, rem_sleep, awake, avg_rr, avg_stress)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row.day,
            row.start ?? null,
            row.end ?? null,
            row.total_sleep ?? null,
            row.deep_sleep ?? null,
            row.light_sleep ?? null,
            row.rem_sleep ?? null,
            row.awake ?? null,
            row.avg_rr ?? null,
            row.avg_stress ?? null,
          ],
        );
      }
    }

    if (!omit.has("weight")) {
      db.run(
        `CREATE TABLE weight (day DATE NOT NULL, weight FLOAT NOT NULL, PRIMARY KEY (day))`,
      );
      for (const row of fixture.weight ?? []) {
        db.run(`INSERT INTO weight (day, weight) VALUES (?, ?)`, [
          row.day,
          row.weight,
        ]);
      }
    }

    if (!omit.has("resting_hr")) {
      db.run(
        `CREATE TABLE resting_hr (day DATE NOT NULL, resting_heart_rate FLOAT, PRIMARY KEY (day))`,
      );
      for (const row of fixture.restingHr ?? []) {
        db.run(
          `INSERT INTO resting_hr (day, resting_heart_rate) VALUES (?, ?)`,
          [row.day, row.resting_heart_rate],
        );
      }
    }

    if (!omit.has("hrv")) {
      db.run(
        `CREATE TABLE hrv (day DATE NOT NULL, weekly_avg FLOAT, last_night_avg FLOAT, PRIMARY KEY (day))`,
      );
      for (const row of fixture.hrv ?? []) {
        db.run(`INSERT INTO hrv (day, last_night_avg) VALUES (?, ?)`, [
          row.day,
          row.last_night_avg,
        ]);
      }
    }

    if (!omit.has("daily_summary")) {
      db.run(
        `CREATE TABLE daily_summary (
           day DATE NOT NULL, hr_min FLOAT, hr_max FLOAT, rhr FLOAT,
           stress_avg FLOAT, steps INTEGER, steps_goal INTEGER,
           bb_max FLOAT, bb_min FLOAT, rr_waking_avg FLOAT,
           distance FLOAT, floors FLOAT, PRIMARY KEY (day))`,
      );
      for (const row of fixture.dailySummary ?? []) {
        db.run(
          `INSERT INTO daily_summary (day, rhr, stress_avg, steps, bb_max, bb_min, rr_waking_avg)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            row.day,
            row.rhr ?? null,
            row.stress_avg ?? null,
            row.steps ?? null,
            row.bb_max ?? null,
            row.bb_min ?? null,
            row.rr_waking_avg ?? null,
          ],
        );
      }
    }

    if (fixture.extraSql) {
      db.run(fixture.extraSql);
    }

    return db.export();
  } finally {
    db.close();
  }
}

/** A plain SQLite file that is not GarminDB at all. */
export async function buildForeignSqlite(): Promise<Uint8Array> {
  const SQL = await sqlJs();
  const db = new SQL.Database();
  try {
    db.run(
      "CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT); INSERT INTO notes (body) VALUES ('hello');",
    );
    return db.export();
  } finally {
    db.close();
  }
}

/** Shaped like GarminDB's activities database, which we deliberately refuse. */
export async function buildActivitiesDb(): Promise<Uint8Array> {
  const SQL = await sqlJs();
  const db = new SQL.Database();
  try {
    db.run(
      `CREATE TABLE _attributes (timestamp DATETIME, key VARCHAR NOT NULL, value VARCHAR, PRIMARY KEY (key));
       CREATE TABLE activities (activity_id VARCHAR NOT NULL, name VARCHAR, sport VARCHAR, PRIMARY KEY (activity_id));`,
    );
    db.run(
      "INSERT INTO _attributes (timestamp, key, value) VALUES ('2026-08-01 12:00:00', 'db.version', '14')",
    );
    return db.export();
  } finally {
    db.close();
  }
}
