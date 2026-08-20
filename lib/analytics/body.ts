import {
  inInclusiveRange,
  rollingWindow,
  toLocalDate,
} from "@/lib/analytics/dates";
import { linearSlope } from "@/lib/analytics/stats";
import {
  BODY_TREND_DAYS,
  BODY_TREND_MIN_POINTS,
  type AnalyticsContext,
  type BodyPoint,
  type MetricResult,
} from "@/lib/analytics/types";

export function latestMass(points: BodyPoint[]): number | null {
  const withMass = points
    .filter((point) => point.massKg != null && point.massKg > 0)
    .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));
  return withMass[0]?.massKg ?? null;
}

export function bodyWeightTrend(
  points: BodyPoint[],
  context: AnalyticsContext,
): MetricResult<number> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, BODY_TREND_DAYS);
  const inWindow = points
    .map((point) => ({
      ...point,
      localDate: toLocalDate(point.measuredAt, context.timeZone),
    }))
    .filter(
      (point) =>
        point.massKg != null &&
        point.massKg > 0 &&
        inInclusiveRange(point.localDate, window.start, window.end),
    )
    .sort((a, b) => a.localDate.localeCompare(b.localDate));

  if (inWindow.length < BODY_TREND_MIN_POINTS) {
    return {
      value: null,
      completeness: inWindow.length / BODY_TREND_MIN_POINTS,
      explanationKey: "body_weight_trend",
    };
  }

  const first = inWindow[0]!.localDate;
  const slopePerDay = linearSlope(
    inWindow.map((point) => ({
      x: dayIndex(first, point.localDate),
      y: point.massKg!,
    })),
  );
  return {
    value: slopePerDay == null ? null : slopePerDay * 7,
    completeness: 1,
    explanationKey: "body_weight_trend",
  };
}

function dayIndex(start: string, date: string): number {
  const startMs = Date.parse(`${start}T12:00:00Z`);
  const dateMs = Date.parse(`${date}T12:00:00Z`);
  return (dateMs - startMs) / 86_400_000;
}

export function massSeries(
  points: BodyPoint[],
  context: AnalyticsContext,
  days: number,
): Array<{ date: string; massKg: number }> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, days);
  return points
    .map((point) => ({
      date: toLocalDate(point.measuredAt, context.timeZone),
      massKg: point.massKg,
    }))
    .filter(
      (point): point is { date: string; massKg: number } =>
        point.massKg != null &&
        point.massKg > 0 &&
        inInclusiveRange(point.date, window.start, window.end),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function bodyFatSeries(
  points: BodyPoint[],
  context: AnalyticsContext,
  days: number,
): Array<{ date: string; bodyFatPct: number }> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, days);
  return points
    .map((point) => ({
      date: toLocalDate(point.measuredAt, context.timeZone),
      bodyFatPct: point.bodyFatPct,
    }))
    .filter(
      (point): point is { date: string; bodyFatPct: number } =>
        point.bodyFatPct != null &&
        point.bodyFatPct > 0 &&
        inInclusiveRange(point.date, window.start, window.end),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function bodyMassIndex(
  massKg: number | null,
  heightCm: number | null,
): { value: number; category: string } | null {
  if (massKg == null || massKg <= 0 || heightCm == null || heightCm <= 0) {
    return null;
  }
  const heightM = heightCm / 100;
  const value = massKg / (heightM * heightM);
  if (!Number.isFinite(value)) {
    return null;
  }
  let category: string;
  if (value < 18.5) {
    category = "Undervikt";
  } else if (value < 25) {
    category = "Normalvikt";
  } else if (value < 30) {
    category = "Övervikt";
  } else {
    category = "Fetma";
  }
  return { value, category };
}

export function massGoalProgress(
  currentKg: number,
  targetKg: number,
  startKg: number,
): number | null {
  const total = Math.abs(startKg - targetKg);
  if (total < 0.05) {
    return currentKg === targetKg ? 100 : null;
  }
  const losing = startKg > targetKg;
  const raw = losing
    ? (startKg - currentKg) / total
    : (currentKg - startKg) / total;
  return Math.max(0, Math.min(100, raw * 100));
}
