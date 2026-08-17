import {
  inInclusiveRange,
  minutesFromEveningOrigin,
  rollingWindow,
  toLocalDate,
} from "@/lib/analytics/dates";
import { mean, median, sampleStdDev } from "@/lib/analytics/stats";
import {
  HRV_BASELINE_DAYS,
  HRV_MIN_POINTS,
  RHR_BASELINE_DAYS,
  RHR_MIN_POINTS,
  SLEEP_CONSISTENCY_MIN_NIGHTS,
  SLEEP_MEAN_DAYS,
  type AnalyticsContext,
  type HealthPoint,
  type MetricResult,
} from "@/lib/analytics/types";

function inDays(
  points: HealthPoint[],
  context: AnalyticsContext,
  days: number,
): HealthPoint[] {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, days);
  return points.filter((point) =>
    inInclusiveRange(point.localDate, window.start, window.end),
  );
}

export function sleepDurationMean(
  points: HealthPoint[],
  context: AnalyticsContext,
): MetricResult<number> {
  const window = inDays(points, context, SLEEP_MEAN_DAYS);
  const values = window
    .map((point) => point.sleepDurationS)
    .filter((value): value is number => value != null && value > 0);
  return {
    value: mean(values),
    completeness: values.length / SLEEP_MEAN_DAYS,
    explanationKey: "sleep_duration",
  };
}

export function sleepConsistency(
  points: HealthPoint[],
  context: AnalyticsContext,
): MetricResult<number> {
  const window = inDays(points, context, 14);
  const starts = window
    .map((point) => point.sleepStartAt)
    .filter((value): value is string => Boolean(value))
    .map((iso) => minutesFromEveningOrigin(iso, context.timeZone));
  if (starts.length < SLEEP_CONSISTENCY_MIN_NIGHTS) {
    return {
      value: null,
      completeness: starts.length / SLEEP_CONSISTENCY_MIN_NIGHTS,
      explanationKey: "sleep_consistency",
    };
  }
  return {
    value: sampleStdDev(starts),
    completeness: 1,
    explanationKey: "sleep_consistency",
  };
}

export function hrvBaseline(
  points: HealthPoint[],
  context: AnalyticsContext,
): MetricResult<number> {
  const window = inDays(points, context, HRV_BASELINE_DAYS);
  const values = window
    .map((point) => point.hrvRmssdMs)
    .filter((value): value is number => value != null && value > 0);
  if (values.length < HRV_MIN_POINTS) {
    return {
      value: null,
      completeness: values.length / HRV_MIN_POINTS,
      explanationKey: "hrv_baseline",
    };
  }
  return {
    value: median(values),
    completeness: 1,
    explanationKey: "hrv_baseline",
  };
}

export function rhrBaseline(
  points: HealthPoint[],
  context: AnalyticsContext,
): MetricResult<number> {
  const window = inDays(points, context, RHR_BASELINE_DAYS);
  const values = window
    .map((point) => point.restingHeartRateBpm)
    .filter((value): value is number => value != null && value > 0);
  if (values.length < RHR_MIN_POINTS) {
    return {
      value: null,
      completeness: values.length / RHR_MIN_POINTS,
      explanationKey: "rhr_baseline",
    };
  }
  return {
    value: median(values),
    completeness: 1,
    explanationKey: "rhr_baseline",
  };
}

export function sleepSeries(
  points: HealthPoint[],
  context: AnalyticsContext,
  days: number,
): Array<{ date: string; hours: number | null }> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, days);
  const byDate = new Map(
    points.map((point) => [point.localDate, point.sleepDurationS]),
  );
  const series: Array<{ date: string; hours: number | null }> = [];
  let cursor = window.start;
  while (cursor <= window.end) {
    const seconds = byDate.get(cursor);
    series.push({
      date: cursor,
      hours: seconds != null && seconds > 0 ? seconds / 3600 : null,
    });
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
