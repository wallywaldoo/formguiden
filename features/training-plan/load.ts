import {
  mapActivityRow,
  mapHealthRow,
} from "@/features/dashboard/map-rows";
import sql from "@/lib/db";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { toFiniteNumber } from "@/lib/numbers";
import type { TrainingSnapshotInput } from "@/lib/training-plan/snapshot";

export async function loadTrainingSnapshotInput(input: {
  now: Date;
  feedback?: string | null;
}): Promise<TrainingSnapshotInput> {
  const now = input.now;
  const since = new Date(now.getTime() - 100 * 86_400_000).toISOString();
  const sinceDate = since.slice(0, 10);

  const [prefs, goals, activities, health, strength, pending] =
    await Promise.all([
      sql`SELECT timezone, distance_unit FROM user_preferences LIMIT 1`,
      sql`
        SELECT weekly_run_distance_m, target_pace_s_per_km, target_mass_kg,
               weekly_strength_sessions, race_type, race_date
        FROM goals WHERE status = 'active' LIMIT 1
      `,
      sql`
        SELECT id, activity_type, started_at, duration_s, distance_m,
               avg_pace_s_per_km, avg_heart_rate_bpm
        FROM activities WHERE started_at >= ${since}
        ORDER BY started_at DESC LIMIT 400
      `,
      sql`
        SELECT local_date, sleep_duration_s, sleep_start_at, hrv_rmssd_ms,
               resting_heart_rate_bpm, steps, stress_avg,
               body_battery_high, body_battery_low
        FROM daily_health_metrics WHERE local_date >= ${sinceDate}
        ORDER BY local_date DESC LIMIT 120
      `,
      sql`
        SELECT started_at FROM strength_sessions
        WHERE started_at >= ${since}
        ORDER BY started_at DESC LIMIT 200
      `,
      sql`
        SELECT id FROM data_imports
        WHERE status IN ('preview_ready', 'partial', 'queued', 'processing')
        ORDER BY created_at DESC LIMIT 1
      `,
    ]);

  const goal = goals[0];
  const context: AnalyticsContext = {
    timeZone: (prefs[0]?.timezone as string) || DEFAULT_TIMEZONE,
    now,
    goal: {
      weeklyRunDistanceM: toFiniteNumber(goal?.weekly_run_distance_m),
      targetPaceSPerKm: toFiniteNumber(goal?.target_pace_s_per_km),
      targetMassKg: toFiniteNumber(goal?.target_mass_kg),
    },
  };

  return {
    activities: (
      activities as unknown as Parameters<typeof mapActivityRow>[0][]
    ).map(mapActivityRow),
    health: (health as unknown as Parameters<typeof mapHealthRow>[0][]).map(
      mapHealthRow,
    ),
    strengthSessions: strength.map((session) => ({
      startedAt: session.started_at as string,
    })),
    context,
    weeklyStrengthTarget:
      (goal?.weekly_strength_sessions as number | null) ?? null,
    pendingImportId: (pending[0]?.id as string) ?? null,
    distanceUnit: prefs[0]?.distance_unit === "mi" ? "mi" : "km",
    raceType: (goal?.race_type as string | null) ?? null,
    raceDate:
      goal?.race_date != null ? String(goal.race_date).slice(0, 10) : null,
    feedback: input.feedback ?? null,
  };
}
