import { toFiniteNumber } from "@/lib/numbers";
import type {
  ActivityPoint,
  BodyPoint,
  HealthPoint,
} from "@/lib/analytics/types";

export function mapActivityRow(row: {
  id: string;
  activity_type: string;
  started_at: string;
  duration_s: number | null;
  distance_m: unknown;
  avg_pace_s_per_km: unknown;
  avg_heart_rate_bpm: unknown;
}): ActivityPoint {
  return {
    id: row.id,
    activityType: row.activity_type,
    startedAt: row.started_at,
    durationS: row.duration_s,
    distanceM: toFiniteNumber(row.distance_m),
    avgPaceSPerKm: toFiniteNumber(row.avg_pace_s_per_km),
    avgHeartRateBpm: toFiniteNumber(row.avg_heart_rate_bpm),
  };
}

export function mapHealthRow(row: {
  local_date: string;
  sleep_duration_s: number | null;
  sleep_start_at: string | null;
  hrv_rmssd_ms: unknown;
  resting_heart_rate_bpm: unknown;
  steps: number | null;
  stress_avg: unknown;
  body_battery_high: unknown;
  body_battery_low: unknown;
}): HealthPoint {
  return {
    localDate: row.local_date,
    sleepDurationS: row.sleep_duration_s,
    sleepStartAt: row.sleep_start_at,
    hrvRmssdMs: toFiniteNumber(row.hrv_rmssd_ms),
    restingHeartRateBpm: toFiniteNumber(row.resting_heart_rate_bpm),
    steps: row.steps,
    stressAvg: toFiniteNumber(row.stress_avg),
    bodyBatteryHigh: toFiniteNumber(row.body_battery_high),
    bodyBatteryLow: toFiniteNumber(row.body_battery_low),
  };
}

export function mapBodyRow(row: {
  measured_at: string;
  mass_kg: unknown;
  body_fat_pct: unknown;
}): BodyPoint {
  return {
    measuredAt: row.measured_at,
    massKg: toFiniteNumber(row.mass_kg),
    bodyFatPct: toFiniteNumber(row.body_fat_pct),
  };
}
