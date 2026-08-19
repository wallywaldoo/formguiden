import type { GarminConnectPayload } from "@/lib/import/garmin-connect/schema";
import type {
  CanonicalBodyMeasurement,
  CanonicalDailyHealth,
  ImportWarning,
  ParseResult,
} from "@/lib/import/types";

export const GARMIN_CONNECT_SOURCE = "garmin-connect";

/**
 * Deterministic so a replayed sync collides with the row it already wrote
 * instead of creating a second one. Daily health additionally relies on the
 * (user_id, local_date, source) unique constraint; body measurements rely on
 * this id alone, which is why the migration adds an index for it.
 */
function dayExternalId(localDate: string): string {
  return `${GARMIN_CONNECT_SOURCE}:day:${localDate}`;
}

function weightExternalId(measuredAt: string): string {
  return `${GARMIN_CONNECT_SOURCE}:weight:${measuredAt}`;
}

function hasAnyValue(day: CanonicalDailyHealth): boolean {
  return (
    day.sleepDurationS !== null ||
    day.hrvRmssdMs !== null ||
    day.restingHeartRateBpm !== null ||
    day.stressAvg !== null ||
    day.bodyBatteryHigh !== null ||
    day.bodyBatteryLow !== null ||
    day.steps !== null ||
    day.respirationAvgBrpm !== null
  );
}

export function mapGarminConnectPayload(
  payload: GarminConnectPayload,
): ParseResult {
  const warnings: ImportWarning[] = [];

  const seenDates = new Set<string>();
  const dailyHealth: CanonicalDailyHealth[] = [];

  for (const entry of payload.dailyHealth) {
    if (seenDates.has(entry.localDate)) {
      warnings.push({
        code: "duplicate_date",
        message: `Dagen ${entry.localDate} fanns flera gånger i samma körning och räknades en gång.`,
      });
      continue;
    }
    seenDates.add(entry.localDate);

    const day: CanonicalDailyHealth = {
      externalId: dayExternalId(entry.localDate),
      localDate: entry.localDate,
      sleepDurationS: entry.sleepDurationS,
      sleepStartAt: entry.sleepStartAt,
      sleepEndAt: entry.sleepEndAt,
      sleepLightS: entry.sleepLightS,
      sleepDeepS: entry.sleepDeepS,
      sleepRemS: entry.sleepRemS,
      sleepAwakeS: entry.sleepAwakeS,
      hrvRmssdMs: entry.hrvRmssdMs,
      restingHeartRateBpm: entry.restingHeartRateBpm,
      stressAvg: entry.stressAvg,
      bodyBatteryHigh: entry.bodyBatteryHigh,
      bodyBatteryLow: entry.bodyBatteryLow,
      steps: entry.steps,
      respirationAvgBrpm: entry.respirationAvgBrpm,
    };

    // A day where the watch was not worn arrives as all nulls. Storing it would
    // create a row that looks like a measured zero in every chart downstream.
    if (!hasAnyValue(day)) {
      continue;
    }

    dailyHealth.push(day);
  }

  const seenMeasurements = new Set<string>();
  const bodyMeasurements: CanonicalBodyMeasurement[] = [];

  for (const entry of payload.bodyMeasurements) {
    if (entry.massKg === null && entry.bodyFatPct === null) {
      continue;
    }
    if (seenMeasurements.has(entry.measuredAt)) {
      continue;
    }
    seenMeasurements.add(entry.measuredAt);

    bodyMeasurements.push({
      externalId: weightExternalId(entry.measuredAt),
      measuredAt: entry.measuredAt,
      massKg: entry.massKg,
      bodyFatPct: entry.bodyFatPct,
    });
  }

  return {
    // Activities never arrive on this channel. They are uploaded as FIT files
    // so the existing garmin-file parser can keep laps and GPS.
    activities: [],
    dailyHealth,
    bodyMeasurements,
    warnings,
  };
}
