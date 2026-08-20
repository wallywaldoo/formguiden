import {
  addDays,
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

function daysInclusive(start: string, end: string): number {
  const [ys, ms, ds] = start.split("-").map(Number) as [number, number, number];
  const [ye, me, de] = end.split("-").map(Number) as [number, number, number];
  const from = Date.UTC(ys, ms - 1, ds);
  const to = Date.UTC(ye, me - 1, de);
  return Math.round((to - from) / 86_400_000) + 1;
}

function seriesFromBuckets(
  byKey: Map<string, number>,
  start: string,
  end: string,
  stepDays: number,
  keyFor: (cursor: string) => string,
): Array<{ date: string; distanceKm: number }> {
  const series: Array<{ date: string; distanceKm: number }> = [];
  let cursor = start;
  while (cursor <= end) {
    const key = keyFor(cursor);
    series.push({ date: key, distanceKm: byKey.get(key) ?? 0 });
    cursor = addDays(cursor, stepDays);
  }
  return series;
}

export function historyDistanceSeries(
  activities: ActivityPoint[],
  context: AnalyticsContext,
): Array<{ date: string; distanceKm: number }> {
  const runs = runFamilyActivities(activities)
    .map((activity) => withLocalDate(activity, context.timeZone))
    .filter((activity) => activity.distanceM != null);
  if (runs.length === 0) {
    return [];
  }
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const oldest = runs.reduce(
    (min, activity) => (activity.localDate < min ? activity.localDate : min),
    runs[0]!.localDate,
  );
  const span = daysInclusive(oldest, today);
  const byDate = new Map<string, number>();
  for (const activity of runs) {
    const key =
      span > 365 * 4
        ? activity.localDate.slice(0, 7)
        : span > 120
          ? isoWeekStart(activity.localDate)
          : activity.localDate;
    byDate.set(key, (byDate.get(key) ?? 0) + (activity.distanceM ?? 0) / 1000);
  }
  if (span > 365 * 4) {
    const series: Array<{ date: string; distanceKm: number }> = [];
    let year = Number(oldest.slice(0, 4));
    let month = Number(oldest.slice(5, 7));
    const endYear = Number(today.slice(0, 4));
    const endMonth = Number(today.slice(5, 7));
    while (year < endYear || (year === endYear && month <= endMonth)) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      series.push({ date: key, distanceKm: byDate.get(key) ?? 0 });
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
    return series;
  }
  if (span > 120) {
    return seriesFromBuckets(
      byDate,
      isoWeekStart(oldest),
      today,
      7,
      (cursor) => isoWeekStart(cursor),
    );
  }
  return seriesFromBuckets(byDate, oldest, today, 1, (cursor) => cursor);
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

export function representativeRunPace(
  activities: ActivityPoint[],
  context: AnalyticsContext,
): number | null {
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
  return representative?.avgPaceSPerKm ?? null;
}

export function goalPaceGap(
  activities: ActivityPoint[],
  context: AnalyticsContext,
): MetricResult<number> {
  const target = context.goal.targetPaceSPerKm;
  if (target == null || target <= 0) {
    return { value: null, completeness: 0, explanationKey: "goal_pace_gap" };
  }
  const current = representativeRunPace(activities, context);
  if (current == null) {
    return { value: null, completeness: 0, explanationKey: "goal_pace_gap" };
  }
  return {
    value: current - target,
    completeness: 1,
    explanationKey: "goal_pace_gap",
  };
}

export const RUNNING_RANGE_DAYS = {
  "7d": 7,
  "90d": 90,
  "365d": 365,
  all: null,
} as const;

export type RunningRangeKey = keyof typeof RUNNING_RANGE_DAYS;

export function parseRunningRange(
  value: string | null | undefined,
): RunningRangeKey {
  if (value === "7d" || value === "90d" || value === "365d" || value === "all") {
    return value;
  }
  return "90d";
}

export function filterActivitiesByRange<T extends { startedAt: string }>(
  activities: T[],
  context: Pick<AnalyticsContext, "now" | "timeZone">,
  range: RunningRangeKey,
): T[] {
  if (range === "all") return activities;
  const days = RUNNING_RANGE_DAYS[range];
  if (days == null) return activities;
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, days);
  return activities.filter((activity) => {
    const localDate = toLocalDate(activity.startedAt, context.timeZone);
    return inInclusiveRange(localDate, window.start, window.end);
  });
}

export function weekRunSummary(
  activities: ActivityPoint[],
  context: AnalyticsContext,
) {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, 7);
  const runs = runFamilyActivities(activities)
    .map((activity) => withLocalDate(activity, context.timeZone))
    .filter((activity) =>
      inInclusiveRange(activity.localDate, window.start, window.end),
    );

  const withDistance = runs.filter((run) => run.distanceM != null);
  const totalDistanceM = withDistance.reduce(
    (sum, run) => sum + (run.distanceM ?? 0),
    0,
  );
  const withDuration = runs.filter((run) => run.durationS != null);
  const totalDurationS = withDuration.reduce(
    (sum, run) => sum + (run.durationS ?? 0),
    0,
  );
  const paces = runs
    .filter((run) => run.avgPaceSPerKm != null && (run.distanceM ?? 0) > 0)
    .map((run) => run.avgPaceSPerKm!);

  return {
    runCount: runs.length,
    totalDistanceM: withDistance.length > 0 ? totalDistanceM : null,
    totalDurationS: withDuration.length > 0 ? totalDurationS : null,
    avgPaceSPerKm: median(paces),
  };
}

export function paceTrendSeries(
  activities: ActivityPoint[],
  context: AnalyticsContext,
  days: number,
): Array<{ date: string; pace: number }> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, days);
  return runFamilyActivities(activities)
    .map((activity) => withLocalDate(activity, context.timeZone))
    .filter(
      (activity) =>
        activity.avgPaceSPerKm != null &&
        (activity.distanceM ?? 0) > 1000 &&
        inInclusiveRange(activity.localDate, window.start, window.end),
    )
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((activity) => ({
      date: activity.localDate,
      pace: activity.avgPaceSPerKm!,
    }));
}

export function heartRateTrendSeries(
  activities: ActivityPoint[],
  context: AnalyticsContext,
  days: number,
): Array<{ date: string; heartRate: number }> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, days);
  return runFamilyActivities(activities)
    .map((activity) => withLocalDate(activity, context.timeZone))
    .filter(
      (activity) =>
        activity.avgHeartRateBpm != null &&
        inInclusiveRange(activity.localDate, window.start, window.end),
    )
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((activity) => ({
      date: activity.localDate,
      heartRate: activity.avgHeartRateBpm!,
    }));
}
