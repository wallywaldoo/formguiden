import sql from "@/lib/db";
import { toFiniteNumber } from "@/lib/numbers";

export type CoachContextData = {
  profile: {
    displayName: string | null;
  } | null;
  preferences: {
    timezone: string;
    distanceUnit: "km" | "mi";
    elevationUnit: "m" | "ft";
  } | null;
  goal: {
    raceType: string | null;
    raceDate: string | null;
    targetPaceSPerKm: number | null;
    weeklyRunDistanceM: number | null;
  } | null;
  activities: Array<{
    id: string;
    activityType: string;
    startedAt: string;
    durationS: number | null;
    distanceM: number | null;
    avgPaceSPerKm: number | null;
    avgHeartRateBpm: number | null;
    trainingLoad: number | null;
    perceivedEffort: number | null;
    notes: string | null;
  }>;
  health: Array<{
    localDate: string;
    sleepDurationS: number | null;
    hrvRmssdMs: number | null;
    restingHeartRateBpm: number | null;
    steps: number | null;
    stressAvg: number | null;
    bodyBatteryHigh: number | null;
    bodyBatteryLow: number | null;
  }>;
  body: Array<{
    measuredAt: string;
    massKg: number | null;
    bodyFatPct: number | null;
  }>;
  pendingImport: {
    id: string;
    status: string;
  } | null;
};

export async function getCoachContextData(): Promise<CoachContextData> {
  const now = new Date();
  const sinceActivities = new Date(
    now.getTime() - 100 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const sinceHealthDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const sinceBody = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000)
    .toISOString();

  const [profiles, preferences, goals, activities, health, body, pendingImports] =
    await Promise.all([
      sql`SELECT display_name FROM profiles LIMIT 1`,
      sql`
        SELECT timezone, distance_unit, elevation_unit
        FROM user_preferences
        LIMIT 1
      `,
      sql`
        SELECT race_type, race_date, target_pace_s_per_km, weekly_run_distance_m
        FROM goals
        WHERE status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `,
      sql`
        SELECT
          id,
          activity_type AS "activityType",
          started_at AS "startedAt",
          duration_s AS "durationS",
          distance_m AS "distanceM",
          avg_pace_s_per_km AS "avgPaceSPerKm",
          avg_heart_rate_bpm AS "avgHeartRateBpm",
          training_load AS "trainingLoad",
          perceived_effort AS "perceivedEffort",
          notes
        FROM activities
        WHERE started_at >= ${sinceActivities}
        ORDER BY started_at DESC
        LIMIT 24
      `,
      sql`
        SELECT
          local_date AS "localDate",
          sleep_duration_s AS "sleepDurationS",
          hrv_rmssd_ms AS "hrvRmssdMs",
          resting_heart_rate_bpm AS "restingHeartRateBpm",
          steps,
          stress_avg AS "stressAvg",
          body_battery_high AS "bodyBatteryHigh",
          body_battery_low AS "bodyBatteryLow"
        FROM daily_health_metrics
        WHERE local_date >= ${sinceHealthDate}
        ORDER BY local_date DESC
        LIMIT 35
      `,
      sql`
        SELECT
          measured_at AS "measuredAt",
          mass_kg AS "massKg",
          body_fat_pct AS "bodyFatPct"
        FROM body_measurements
        WHERE measured_at >= ${sinceBody}
        ORDER BY measured_at DESC
        LIMIT 20
      `,
      sql`
        SELECT id, status
        FROM data_imports
        WHERE status IN ('preview_ready', 'partial', 'queued', 'processing')
        ORDER BY created_at DESC
        LIMIT 1
      `,
    ]);

  return {
    profile: (profiles[0] as { display_name: string | null } | undefined)
      ? {
          displayName:
            (profiles[0] as { display_name: string | null }).display_name ?? null,
        }
      : null,
    preferences: (preferences[0] as
      | {
          timezone: string | null;
          distance_unit: string | null;
          elevation_unit: string | null;
        }
      | undefined)
      ? {
          timezone:
            (preferences[0] as { timezone: string | null }).timezone ??
            "Europe/Stockholm",
          distanceUnit:
            (preferences[0] as { distance_unit: string | null }).distance_unit ===
            "mi"
              ? "mi"
              : "km",
          elevationUnit:
            (preferences[0] as { elevation_unit: string | null }).elevation_unit ===
            "ft"
              ? "ft"
              : "m",
        }
      : null,
    goal: (goals[0] as
      | {
          race_type: string | null;
          race_date: string | null;
          target_pace_s_per_km: number | null;
          weekly_run_distance_m: number | null;
        }
      | undefined)
      ? {
          raceType: (goals[0] as { race_type: string | null }).race_type ?? null,
          raceDate: (goals[0] as { race_date: string | null }).race_date ?? null,
          targetPaceSPerKm:
            (goals[0] as { target_pace_s_per_km: number | null })
              .target_pace_s_per_km ?? null,
          weeklyRunDistanceM:
            (goals[0] as { weekly_run_distance_m: number | null })
              .weekly_run_distance_m ?? null,
        }
      : null,
    activities: activities.map((activity) => ({
      id: activity.id as string,
      activityType: activity.activityType as string,
      startedAt: activity.startedAt as string,
      durationS: (activity.durationS as number | null) ?? null,
      distanceM: toFiniteNumber(activity.distanceM),
      avgPaceSPerKm: toFiniteNumber(activity.avgPaceSPerKm),
      avgHeartRateBpm: toFiniteNumber(activity.avgHeartRateBpm),
      trainingLoad: toFiniteNumber(activity.trainingLoad),
      perceivedEffort: toFiniteNumber(activity.perceivedEffort),
      notes: (activity.notes as string | null) ?? null,
    })),
    health: health.map((day) => ({
      localDate: day.localDate as string,
      sleepDurationS: (day.sleepDurationS as number | null) ?? null,
      hrvRmssdMs: toFiniteNumber(day.hrvRmssdMs),
      restingHeartRateBpm: toFiniteNumber(day.restingHeartRateBpm),
      steps: (day.steps as number | null) ?? null,
      stressAvg: toFiniteNumber(day.stressAvg),
      bodyBatteryHigh: toFiniteNumber(day.bodyBatteryHigh),
      bodyBatteryLow: toFiniteNumber(day.bodyBatteryLow),
    })),
    body: body.map((entry) => ({
      measuredAt: entry.measuredAt as string,
      massKg: toFiniteNumber(entry.massKg),
      bodyFatPct: toFiniteNumber(entry.bodyFatPct),
    })),
    pendingImport: ((pendingImports[0] as { id: string; status: string } | undefined) ??
      null) as {
      id: string;
      status: string;
    } | null,
  };
}
