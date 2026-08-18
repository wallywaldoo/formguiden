import type { GarminDbReader, TableRow } from "@/lib/import/garmindb/open";
import type { SupportedTable } from "@/lib/import/garmindb/schema";
import {
  localDateToMiddayUtcIso,
  parseDurationSeconds,
  parseLocalDate,
  zonedNaiveToUtcIso,
} from "@/lib/import/garmindb/time";
import {
  massToKilograms,
  roundTo,
  type MeasurementSystem,
} from "@/lib/import/garmindb/units";
import type {
  CanonicalBodyMeasurement,
  CanonicalDailyHealth,
  ImportWarning,
} from "@/lib/import/types";

export type GarminDbMapContext = {
  timeZone: string;
  measurementSystem: MeasurementSystem;
};

export type GarminDbMapResult = {
  dailyHealth: CanonicalDailyHealth[];
  bodyMeasurements: CanonicalBodyMeasurement[];
  warnings: ImportWarning[];
  skipped: Record<string, number>;
};

function numeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Rejects sentinel and physiologically impossible values rather than storing them. */
function inRange(
  value: number | null,
  min: number,
  max: number,
): number | null {
  if (value === null || value <= 0) {
    return null;
  }
  return value >= min && value <= max ? value : null;
}

function indexByDate(
  rows: TableRow[],
  onSkip: () => void,
): Map<string, TableRow> {
  const byDate = new Map<string, TableRow>();
  for (const row of rows) {
    const localDate = parseLocalDate(row.day);
    if (!localDate) {
      onSkip();
      continue;
    }
    // Later rows for the same day win; GarminDB keys these tables by day.
    byDate.set(localDate, row);
  }
  return byDate;
}

export function mapGarminDb(
  reader: GarminDbReader,
  context: GarminDbMapContext,
): GarminDbMapResult {
  const { timeZone, measurementSystem } = context;
  const warnings: ImportWarning[] = [];
  const skipped: Record<string, number> = {};

  const bump = (table: SupportedTable): void => {
    skipped[table] = (skipped[table] ?? 0) + 1;
  };

  const present = new Set(reader.provenance.presentTables);
  const read = (table: SupportedTable): Map<string, TableRow> =>
    present.has(table)
      ? indexByDate(reader.readTable(table), () => bump(table))
      : new Map();

  const sleep = read("sleep");
  const restingHr = read("resting_hr");
  const hrv = read("hrv");
  const dailySummary = read("daily_summary");

  const dates = new Set<string>([
    ...sleep.keys(),
    ...restingHr.keys(),
    ...hrv.keys(),
    ...dailySummary.keys(),
  ]);

  const dailyHealth: CanonicalDailyHealth[] = [];
  for (const localDate of [...dates].sort()) {
    const s = sleep.get(localDate);
    const r = restingHr.get(localDate);
    const h = hrv.get(localDate);
    const d = dailySummary.get(localDate);

    const row: CanonicalDailyHealth = {
      externalId: `garmindb:day:${localDate}`,
      localDate,
      sleepDurationS: parseDurationSeconds(s?.total_sleep),
      sleepStartAt: zonedNaiveToUtcIso(s?.start, timeZone),
      sleepEndAt: zonedNaiveToUtcIso(s?.end, timeZone),
      sleepLightS: parseDurationSeconds(s?.light_sleep),
      sleepDeepS: parseDurationSeconds(s?.deep_sleep),
      sleepRemS: parseDurationSeconds(s?.rem_sleep),
      sleepAwakeS: parseDurationSeconds(s?.awake),
      hrvRmssdMs: inRange(numeric(h?.last_night_avg), 1, 500),
      // A dedicated resting_hr row is more precise than the daily rollup.
      restingHeartRateBpm:
        inRange(numeric(r?.resting_heart_rate), 20, 200) ??
        inRange(numeric(d?.rhr), 20, 200),
      // The daily rollup covers the whole day; sleep only covers the night.
      stressAvg:
        inRange(numeric(d?.stress_avg), 1, 100) ??
        inRange(numeric(s?.avg_stress), 1, 100),
      bodyBatteryHigh: inRange(numeric(d?.bb_max), 1, 100),
      bodyBatteryLow: inRange(numeric(d?.bb_min), 1, 100),
      steps: inRange(numeric(d?.steps), 1, 200_000),
      respirationAvgBrpm:
        inRange(numeric(s?.avg_rr), 1, 60) ??
        inRange(numeric(d?.rr_waking_avg), 1, 60),
    };

    if (hasSignal(row)) {
      dailyHealth.push(row);
    }
  }

  const bodyMeasurements: CanonicalBodyMeasurement[] = [];
  if (present.has("weight")) {
    for (const weightRow of reader.readTable("weight")) {
      const localDate = parseLocalDate(weightRow.day);
      const raw = numeric(weightRow.weight);
      if (!localDate || raw === null || raw <= 0) {
        bump("weight");
        continue;
      }
      const massKg = massToKilograms(raw, measurementSystem);
      if (massKg < 20 || massKg > 400) {
        bump("weight");
        continue;
      }
      const measuredAt = localDateToMiddayUtcIso(localDate, timeZone);
      if (!measuredAt) {
        bump("weight");
        continue;
      }
      bodyMeasurements.push({
        externalId: `garmindb:weight:${localDate}`,
        measuredAt,
        massKg: roundTo(massKg, 2),
        bodyFatPct: null,
      });
    }
  }

  warnings.push({
    code: "garmindb_timezone_assumed",
    message: `Tider tolkas i din tidszon (${timeZone}). GarminDB sparar klockslag utan tidszon.`,
  });

  if (measurementSystem === "statute") {
    warnings.push({
      code: "garmindb_units_converted",
      message: "Vikter i filen är i pund och har räknats om till kilogram.",
    });
  }

  for (const [table, columns] of Object.entries(
    reader.provenance.missingOptionalColumns,
  )) {
    warnings.push({
      code: "garmindb_missing_columns",
      message: `Tabellen ${table} saknar ${columns.length} valfria kolumner i din GarminDB-version. De fälten importeras som tomma.`,
    });
  }

  for (const [table, count] of Object.entries(skipped)) {
    warnings.push({
      code: "garmindb_rows_skipped",
      message: `${count} rader i ${table} kunde inte tolkas och hoppades över.`,
    });
  }

  return { dailyHealth, bodyMeasurements, warnings, skipped };
}

/** A day with no usable measurement is noise, not data. */
function hasSignal(row: CanonicalDailyHealth): boolean {
  return (
    row.sleepDurationS !== null ||
    row.sleepStartAt !== null ||
    row.hrvRmssdMs !== null ||
    row.restingHeartRateBpm !== null ||
    row.stressAvg !== null ||
    row.bodyBatteryHigh !== null ||
    row.steps !== null ||
    row.respirationAvgBrpm !== null
  );
}
