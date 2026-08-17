import {
  inInclusiveRange,
  rollingWindow,
  toLocalDate,
} from "@/lib/analytics/dates";
import { clamp01 } from "@/lib/analytics/stats";
import type { AnalyticsContext, MetricResult } from "@/lib/analytics/types";

export type StrengthSessionPoint = {
  startedAt: string;
};

export function strengthFrequency(
  sessions: StrengthSessionPoint[],
  context: AnalyticsContext,
  weeklyTarget: number | null,
): MetricResult<number> {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, 7);
  const count = sessions.filter((session) => {
    const localDate = toLocalDate(session.startedAt, context.timeZone);
    return inInclusiveRange(localDate, window.start, window.end);
  }).length;
  return {
    value: count,
    completeness:
      weeklyTarget != null && weeklyTarget > 0
        ? clamp01(count / weeklyTarget)
        : count > 0
          ? 1
          : 0,
    explanationKey: "strength_frequency",
  };
}
