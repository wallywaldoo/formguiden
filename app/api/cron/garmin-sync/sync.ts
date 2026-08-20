/**
 * Core Garmin → Postgres sync logic.
 * Shared between the cron route (GET /api/cron/garmin-sync) and the manual
 * trigger (POST /api/cron/garmin-sync/trigger).
 *
 * Idempotent: uses ON CONFLICT DO UPDATE so repeated runs are safe.
 */

import sql from "@/lib/db";
import { GarminClient } from "@/lib/garmin/client";
import { ensureWeekRecaps } from "@/features/week-recap/service";

function dateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function mapActivityType(typeKey: string): string {
  const mapping: Record<string, string> = {
    running: "run",
    trail_running: "trail_run",
    treadmill_running: "treadmill",
    walking: "walk",
    hiking: "hike",
    cycling: "cycle",
    indoor_cycling: "cycle",
    strength_training: "strength",
    fitness_equipment: "strength",
  };
  return mapping[typeKey] ?? "other";
}

export interface SyncResult {
  syncedAt: string;
  days: number;
  startDate: string;
  endDate: string;
  healthDaysUpserted: number;
  weightEntriesUpserted: number;
  activitiesUpserted: number;
  errors: string[];
}

export async function runGarminSync(options: {
  days?: number;
  startDate?: string;
  endDate?: string;
}): Promise<SyncResult> {
  const days = options.days ?? 14;
  const errors: string[] = [];

  const client = GarminClient.fromEnv();

  const endDate = options.endDate ? new Date(options.endDate) : new Date();
  const startDate = options.startDate
    ? new Date(options.startDate)
    : new Date();
  if (!options.startDate) {
    startDate.setDate(endDate.getDate() - (days - 1));
  }

  const endStr = endDate.toISOString().split("T")[0];
  const startStr = startDate.toISOString().split("T")[0];

  const dates = dateRange(startStr, endStr);

  let healthDaysUpserted = 0;
  let weightEntriesUpserted = 0;
  let activitiesUpserted = 0;

  // ── Daily health metrics ─────────────────────────────────────────────────
  for (const date of dates) {
    try {
      const [stats, sleep, hrv] = await Promise.allSettled([
        client.getDailyStats(date),
        client.getSleepData(date),
        client.getHrvData(date),
      ]);

      const s = stats.status === "fulfilled" ? stats.value : null;
      const sl = sleep.status === "fulfilled" ? sleep.value : null;
      const h = hrv.status === "fulfilled" ? hrv.value : null;

      if (stats.status === "rejected") {
        errors.push(`stats ${date}: ${(stats.reason as Error).message}`);
      }
      if (sleep.status === "rejected") {
        errors.push(`sleep ${date}: ${(sleep.reason as Error).message}`);
      }
      if (hrv.status === "rejected") {
        errors.push(`hrv ${date}: ${(hrv.reason as Error).message}`);
      }

      if (!s && !sl && !h) {
        continue;
      }

      await sql`
        INSERT INTO daily_health_metrics (
          local_date, source,
          sleep_duration_s, sleep_start_at, sleep_end_at,
          sleep_light_s, sleep_deep_s, sleep_rem_s, sleep_awake_s,
          hrv_rmssd_ms,
          resting_heart_rate_bpm, stress_avg,
          body_battery_high, body_battery_low,
          steps, respiration_avg_brpm
        ) VALUES (
          ${date}, 'garmin-api',
          ${sl?.sleepDurationS ?? s?.sleepDurationS ?? null},
          ${sl?.sleepStartAt ?? null},
          ${sl?.sleepEndAt ?? null},
          ${sl?.sleepLightS ?? null},
          ${sl?.sleepDeepS ?? null},
          ${sl?.sleepRemS ?? null},
          ${sl?.sleepAwakeS ?? null},
          ${h?.hrvRmssdMs ?? null},
          ${s?.restingHeartRateBpm ?? sl?.restingHeartRateBpm ?? null},
          ${s?.stressAvg ?? null},
          ${s?.bodyBatteryHigh ?? null},
          ${s?.bodyBatteryLow ?? null},
          ${s?.steps ?? null},
          ${s?.respirationAvgBrpm ?? null}
        )
        ON CONFLICT (local_date, source)
        DO UPDATE SET
          sleep_duration_s    = COALESCE(EXCLUDED.sleep_duration_s, daily_health_metrics.sleep_duration_s),
          sleep_start_at      = COALESCE(EXCLUDED.sleep_start_at, daily_health_metrics.sleep_start_at),
          sleep_end_at        = COALESCE(EXCLUDED.sleep_end_at, daily_health_metrics.sleep_end_at),
          sleep_light_s       = COALESCE(EXCLUDED.sleep_light_s, daily_health_metrics.sleep_light_s),
          sleep_deep_s        = COALESCE(EXCLUDED.sleep_deep_s, daily_health_metrics.sleep_deep_s),
          sleep_rem_s         = COALESCE(EXCLUDED.sleep_rem_s, daily_health_metrics.sleep_rem_s),
          sleep_awake_s       = COALESCE(EXCLUDED.sleep_awake_s, daily_health_metrics.sleep_awake_s),
          hrv_rmssd_ms        = COALESCE(EXCLUDED.hrv_rmssd_ms, daily_health_metrics.hrv_rmssd_ms),
          resting_heart_rate_bpm = COALESCE(EXCLUDED.resting_heart_rate_bpm, daily_health_metrics.resting_heart_rate_bpm),
          stress_avg          = COALESCE(EXCLUDED.stress_avg, daily_health_metrics.stress_avg),
          body_battery_high   = COALESCE(EXCLUDED.body_battery_high, daily_health_metrics.body_battery_high),
          body_battery_low    = COALESCE(EXCLUDED.body_battery_low, daily_health_metrics.body_battery_low),
          steps               = COALESCE(EXCLUDED.steps, daily_health_metrics.steps),
          respiration_avg_brpm = COALESCE(EXCLUDED.respiration_avg_brpm, daily_health_metrics.respiration_avg_brpm),
          updated_at          = now()
      `;
      healthDaysUpserted++;
    } catch (err) {
      errors.push(
        `health upsert ${date}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // ── Weight measurements ──────────────────────────────────────────────────
  try {
    const weights = await client.getWeightRange(startStr, endStr);
    for (const w of weights) {
      await sql`
        INSERT INTO body_measurements (measured_at, source, mass_kg, body_fat_pct)
        VALUES (${w.measuredAt}, 'garmin-api', ${w.massKg}, ${w.bodyFatPct})
        ON CONFLICT DO NOTHING
      `;
      weightEntriesUpserted++;
    }
  } catch (err) {
    errors.push(`weight: ${err instanceof Error ? err.message : String(err)}`);
  }

  // ── Activities ───────────────────────────────────────────────────────────
  try {
    const activities = await client.getActivities(startStr, endStr);
    for (const act of activities) {
      if (!act.activityId) continue;

      const actType = mapActivityType(act.activityType);
      const startedAt = act.startTimeGMT
        ? new Date(act.startTimeGMT).toISOString()
        : null;

      if (!startedAt) continue;

      // avg pace in s/km
      const avgPace =
        act.averageSpeed && act.averageSpeed > 0
          ? Math.round(1000 / act.averageSpeed)
          : null;

      const inserted = await sql`
        INSERT INTO activities (
          source, external_id, activity_type,
          started_at, duration_s, distance_m,
          elevation_gain_m, avg_heart_rate_bpm, max_heart_rate_bpm,
          avg_pace_s_per_km, calories_kcal, notes
        ) VALUES (
          'garmin-api', ${act.activityId}, ${actType},
          ${startedAt}, ${act.duration ? Math.round(act.duration) : null},
          ${act.distance ?? null},
          ${act.elevationGain ?? null},
          ${act.averageHR ?? null},
          ${act.maxHR ?? null},
          ${avgPace}, ${act.calories ?? null},
          ${act.activityName || null}
        )
        ON CONFLICT (source, external_id)
        WHERE external_id IS NOT NULL
        DO UPDATE SET
          activity_type       = EXCLUDED.activity_type,
          started_at          = EXCLUDED.started_at,
          duration_s          = EXCLUDED.duration_s,
          distance_m          = EXCLUDED.distance_m,
          elevation_gain_m    = EXCLUDED.elevation_gain_m,
          avg_heart_rate_bpm  = EXCLUDED.avg_heart_rate_bpm,
          max_heart_rate_bpm  = EXCLUDED.max_heart_rate_bpm,
          avg_pace_s_per_km   = EXCLUDED.avg_pace_s_per_km,
          calories_kcal       = EXCLUDED.calories_kcal,
          notes               = COALESCE(activities.notes, EXCLUDED.notes),
          updated_at          = now()
        RETURNING id
      `;
      activitiesUpserted++;
    }
  } catch (err) {
    errors.push(
      `activities: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    await ensureWeekRecaps();
  } catch {
    // Recap snapshot is best-effort; sync should still succeed.
  }

  return {
    syncedAt: new Date().toISOString(),
    days,
    startDate: startStr,
    endDate: endStr,
    healthDaysUpserted,
    weightEntriesUpserted,
    activitiesUpserted,
    errors,
  };
}
