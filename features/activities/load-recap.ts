import { generateActivityRecap } from "@/lib/ai/training/activity-recap";
import {
  analyzeActivity,
  type CompareRunInput,
} from "@/lib/analytics/activity-detail";
import { isoWeekStart, toLocalDate } from "@/lib/analytics/dates";
import {
  activityRecapSchema,
  plannedSessionForDate,
  recapFingerprint,
  type ActivityRecap,
  type ActivityRecapFacts,
} from "@/lib/analytics/activity-recap";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import {
  getActivity,
  getActivityRecap,
  listRunActivities,
  listWeekPlansByStarts,
  upsertActivityRecap,
} from "@/lib/db/queries";
import { toFiniteNumber } from "@/lib/numbers";
import { weekPlanSchema, type DailySession } from "@/lib/training-plan/schema";

export async function ensureActivityRecap(
  facts: ActivityRecapFacts,
): Promise<ActivityRecap | null> {
  const fingerprint = recapFingerprint(facts);
  try {
    const stored = await getActivityRecap(facts.activityId);
    if (stored && stored.fingerprint === fingerprint) {
      const parsed = activityRecapSchema.safeParse(stored.payload);
      if (parsed.success) return parsed.data;
    }
  } catch {
    // Table may be missing until migrations are applied.
  }

  const generated = await generateActivityRecap(facts);
  try {
    await upsertActivityRecap({
      activityId: facts.activityId,
      fingerprint,
      payload: generated.recap,
      source: generated.source,
      model: generated.model,
    });
  } catch {
    // Keep the page usable even if persistence fails.
  }
  return generated.recap;
}

export async function plannedSessionForLocalDate(
  localDate: string,
): Promise<DailySession | null> {
  const rows = await listWeekPlansByStarts([isoWeekStart(localDate)]);
  const week = weekPlanSchema.safeParse(rows[0]?.payload);
  return plannedSessionForDate(week.success ? week.data : null, localDate);
}

export async function loadActivityRecap(input: {
  activityId: string;
  planned?: DailySession | null;
  recentRuns?: CompareRunInput[];
}): Promise<ActivityRecap | null> {
  try {
    const [data, runList] = await Promise.all([
      getActivity(input.activityId),
      input.recentRuns ? Promise.resolve(null) : listRunActivities(40),
    ]);
    const activity = data.activities_by_pk;
    if (!activity) return null;

    const timeZone = data.user_preferences[0]?.timezone || DEFAULT_TIMEZONE;
    const localDate = toLocalDate(activity.started_at, timeZone);
    const planned =
      input.planned !== undefined
        ? input.planned
        : await plannedSessionForLocalDate(localDate);
    const distance = toFiniteNumber(activity.distance_m);
    const pace = toFiniteNumber(activity.avg_pace_s_per_km);
    const recentRuns =
      input.recentRuns ??
      runList?.activities
        .filter((row) => row.id !== activity.id)
        .map((row) => ({
          id: row.id,
          startedAt: row.started_at,
          distanceM: toFiniteNumber(row.distance_m),
          durationS: row.duration_s,
          paceSPerKm: toFiniteNumber(row.avg_pace_s_per_km),
          avgHeartRateBpm: toFiniteNumber(row.avg_heart_rate_bpm),
        })) ??
      [];
    const analysis = analyzeActivity({
      samples: data.activity_samples.map((sample) => ({
        elapsedS: sample.elapsed_s,
        distanceM: toFiniteNumber(sample.distance_m),
        heartRateBpm: toFiniteNumber(sample.heart_rate_bpm),
        cadence: toFiniteNumber(sample.cadence),
        speedMps: toFiniteNumber(sample.speed_mps),
        altitudeM: toFiniteNumber(sample.altitude_m),
        powerW: toFiniteNumber(sample.power_w),
        temperatureC: toFiniteNumber(sample.temperature_c),
      })),
      laps: data.activity_laps.map((lap) => ({
        lapIndex: lap.lap_index,
        kind: lap.kind,
        durationS: lap.duration_s,
        distanceM: toFiniteNumber(lap.distance_m),
        avgPaceSPerKm: toFiniteNumber(lap.avg_pace_s_per_km),
        avgHeartRateBpm: toFiniteNumber(lap.avg_heart_rate_bpm),
        maxHeartRateBpm: toFiniteNumber(lap.max_heart_rate_bpm),
        avgCadence: toFiniteNumber(lap.avg_cadence),
        elevationGainM: toFiniteNumber(lap.elevation_gain_m),
        elevationLossM: toFiniteNumber(lap.elevation_loss_m),
        caloriesKcal: toFiniteNumber(lap.calories_kcal),
      })),
      durationS: activity.duration_s,
      movingDurationS: null,
      elapsedDurationS: null,
      distanceM: distance,
      paceSPerKm: pace,
      avgHeartRateBpm: toFiniteNumber(activity.avg_heart_rate_bpm),
      maxHeartRateBpm: toFiniteNumber(activity.max_heart_rate_bpm),
      elevationGainM: toFiniteNumber(activity.elevation_gain_m),
      elevationLossM: toFiniteNumber(activity.elevation_loss_m),
      recentRuns,
    });

    return ensureActivityRecap({
      activityId: activity.id,
      activityType: activity.activity_type,
      localDate,
      durationS: activity.duration_s,
      distanceM: distance,
      paceSPerKm: pace,
      avgHeartRateBpm: toFiniteNumber(activity.avg_heart_rate_bpm),
      planned,
      analysis,
    });
  } catch {
    return null;
  }
}
