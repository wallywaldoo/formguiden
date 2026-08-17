import {
  inInclusiveRange,
  isoWeekStart,
  lastIsoWeekStarts,
  rollingWindow,
  toLocalDate,
} from "@/lib/analytics/dates";
import { runFamilyActivities } from "@/lib/analytics/running-filter";
import { median } from "@/lib/analytics/stats";
import {
  LONG_RUN_WEEKLY_FRACTION,
  PACE_EASY_FACTOR,
  PACE_FAST_FACTOR,
  REPRESENTATIVE_MIN_DISTANCE_M,
  type ActivityPoint,
  type AnalyticsContext,
  type MetricResult,
} from "@/lib/analytics/types";

function withLocalDate(activity: ActivityPoint, timeZone: string) {
  return { ...activity, localDate: toLocalDate(activity.startedAt, timeZone) };
}

export function weeklyRunDistance(
  activities: ActivityPoint[],
  context: AnalyticsContext,
): MetricResult<number> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const weekStart = isoWeekStart(today);
  const weekEnd = today;
  const runs = runFamilyActivities(activities).map((activity) =>
    withLocalDate(activity, context.timeZone),
  );
  const inWeek = runs.filter((activity) =>
    inInclusiveRange(activity.localDate, weekStart, weekEnd),
  );
  const withDistance = inWeek.filter((activity) => activity.distanceM != null);
  const value = withDistance.reduce(
    (sum, activity) => sum + (activity.distanceM ?? 0),
    0,
  );
  return {
    value: withDistance.length > 0 ? value : null,
    completeness: inWeek.length === 0 ? 0 : withDistance.length / inWeek.length,
    explanationKey: "weekly_run_distance",
  };
}

export function rollingDistance(
  activities: ActivityPoint[],
  context: AnalyticsContext,
  days: number,
): MetricResult<number> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, days);
  const runs = runFamilyActivities(activities).map((activity) =>
    withLocalDate(activity, context.timeZone),
  );
  const inWindow = runs.filter((activity) =>
    inInclusiveRange(activity.localDate, window.start, window.end),
  );
  const withDistance = inWindow.filter(
    (activity) => activity.distanceM != null,
  );
  const value = withDistance.reduce(
    (sum, activity) => sum + (activity.distanceM ?? 0),
    0,
  );
  return {
    value: withDistance.length > 0 ? value : null,
    completeness:
      inWindow.length === 0 ? 0 : withDistance.length / inWindow.length,
    explanationKey: `rolling_${days}d_distance`,
  };
}

export function dailyDistanceSeries(
  activities: ActivityPoint[],
  context: AnalyticsContext,
  days: number,
): Array<{ date: string; distanceKm: number }> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, days);
  const runs = runFamilyActivities(activities).map((activity) =>
    withLocalDate(activity, context.timeZone),
  );
  const byDate = new Map<string, number>();
  for (const activity of runs) {
    if (
      !inInclusiveRange(activity.localDate, window.start, window.end) ||
      activity.distanceM == null
    ) {
      continue;
    }
    byDate.set(
      activity.localDate,
      (byDate.get(activity.localDate) ?? 0) + activity.distanceM / 1000,
    );
  }
  const series: Array<{ date: string; distanceKm: number }> = [];
  let cursor = window.start;
  while (cursor <= window.end) {
    series.push({ date: cursor, distanceKm: byDate.get(cursor) ?? 0 });
    const [year, month, day] = cursor.split("-").map(Number) as [
      number,
      number,
      number,
    ];
    const next = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    next.setUTCDate(next.getUTCDate() + 1);
    cursor = next.toISOString().slice(0, 10);
  }
  return series;
}

export function longRunConsistency(
  activities: ActivityPoint[],
  context: AnalyticsContext,
): MetricResult<number> {
  const target = context.goal.weeklyRunDistanceM;
  if (target == null || target <= 0) {
    return {
      value: null,
      completeness: 0,
      explanationKey: "long_run_consistency",
    };
  }
  const threshold = target * LONG_RUN_WEEKLY_FRACTION;
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const weekStarts = lastIsoWeekStarts(today, 4);
  const runs = runFamilyActivities(activities).map((activity) =>
    withLocalDate(activity, context.timeZone),
  );
  let weeksWithActivity = 0;
  let weeksWithLongRun = 0;
  for (const start of weekStarts) {
    const end = start === weekStarts[0] ? today : addSixDays(start);
    const inWeek = runs.filter((activity) =>
      inInclusiveRange(activity.localDate, start, end),
    );
    if (inWeek.length > 0) {
      weeksWithActivity += 1;
    }
    if (inWeek.some((activity) => (activity.distanceM ?? 0) >= threshold)) {
      weeksWithLongRun += 1;
    }
  }
  return {
    value: weeksWithLongRun,
    completeness: weeksWithActivity / 4,
    explanationKey: "long_run_consistency",
  };
}

function addSixDays(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + 6);
  return date.toISOString().slice(0, 10);
}

export type IntensityBucket = "easy" | "target" | "fast";

export function intensityDistribution(
  activities: ActivityPoint[],
  context: AnalyticsContext,
): MetricResult<Record<IntensityBucket, number>> {
  const target = context.goal.targetPaceSPerKm;
  if (target == null || target <= 0) {
    return {
      value: null,
      completeness: 0,
      explanationKey: "intensity_distribution",
    };
  }
  const runs = runFamilyActivities(activities).filter(
    (activity) => activity.avgPaceSPerKm != null,
  );
  if (runs.length === 0) {
    return {
      value: null,
      completeness: 0,
      explanationKey: "intensity_distribution",
    };
  }
  const buckets: Record<IntensityBucket, number> = {
    easy: 0,
    target: 0,
    fast: 0,
  };
  for (const run of runs) {
    const pace = run.avgPaceSPerKm!;
    if (pace < target * PACE_FAST_FACTOR) {
      buckets.fast += 1;
    } else if (pace > target * PACE_EASY_FACTOR) {
      buckets.easy += 1;
    } else {
      buckets.target += 1;
    }
  }
  const allRuns = runFamilyActivities(activities).length;
  return {
    value: buckets,
    completeness: allRuns === 0 ? 0 : runs.length / allRuns,
    explanationKey: "intensity_distribution",
  };
}

export function weeklyPaceTrend(
  activities: ActivityPoint[],
  context: AnalyticsContext,
): MetricResult<Array<{ weekStart: string; paceSPerKm: number }>> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const weekStarts = lastIsoWeekStarts(today, 8).slice().reverse();
  const target = context.goal.targetPaceSPerKm;
  const weeklyTarget = context.goal.weeklyRunDistanceM;
  const runs = runFamilyActivities(activities).map((activity) =>
    withLocalDate(activity, context.timeZone),
  );
  const points: Array<{ weekStart: string; paceSPerKm: number }> = [];
  for (const start of weekStarts) {
    const end =
      start === weekStarts[weekStarts.length - 1] ? today : addSixDays(start);
    const inWeek = runs.filter((activity) =>
      inInclusiveRange(activity.localDate, start, end),
    );
    const easyOrLong = inWeek.filter((activity) => {
      if (activity.avgPaceSPerKm == null) {
        return false;
      }
      const easy =
        target != null &&
        activity.avgPaceSPerKm > target * (PACE_EASY_FACTOR - 0.05);
      const long =
        weeklyTarget != null &&
        (activity.distanceM ?? 0) >= weeklyTarget * LONG_RUN_WEEKLY_FRACTION;
      return target == null ? true : easy || long;
    });
    const pace = median(easyOrLong.map((activity) => activity.avgPaceSPerKm!));
    if (pace != null) {
      points.push({ weekStart: start, paceSPerKm: pace });
    }
  }
  const weeksWithPace = points.length;
  return {
    value: points.length > 0 ? points : null,
    completeness: weeksWithPace / weekStarts.length,
    explanationKey: "pace_trend",
  };
}

export function goalPaceGap(
  activities: ActivityPoint[],
  context: AnalyticsContext,
): MetricResult<number> {
  const target = context.goal.targetPaceSPerKm;
  if (target == null || target <= 0) {
    return { value: null, completeness: 0, explanationKey: "goal_pace_gap" };
  }
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, 28);
  const runs = runFamilyActivities(activities)
    .map((activity) => withLocalDate(activity, context.timeZone))
    .filter(
      (activity) =>
        activity.avgPaceSPerKm != null &&
        inInclusiveRange(activity.localDate, window.start, window.end),
    )
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const representative =
    runs.find(
      (activity) => (activity.distanceM ?? 0) >= REPRESENTATIVE_MIN_DISTANCE_M,
    ) ?? runs[0];
  if (!representative?.avgPaceSPerKm) {
    return { value: null, completeness: 0, explanationKey: "goal_pace_gap" };
  }
  return {
    value: representative.avgPaceSPerKm - target,
    completeness: 1,
    explanationKey: "goal_pace_gap",
  };
}
