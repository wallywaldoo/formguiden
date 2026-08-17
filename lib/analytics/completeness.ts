import { clamp01 } from "@/lib/analytics/stats";
import type { MetricResult } from "@/lib/analytics/types";

const WEIGHTS = {
  weeklyDistance: 2,
  pace: 2,
  sleep: 2,
  hrv: 1,
  rhr: 1,
  body: 1,
} as const;

export function dataCompleteness(parts: {
  weeklyDistance: MetricResult<number>;
  paceGap: MetricResult<number>;
  sleep: MetricResult<number>;
  hrv: MetricResult<number>;
  rhr: MetricResult<number>;
  body: MetricResult<number>;
}): MetricResult<number> {
  const totalWeight =
    WEIGHTS.weeklyDistance +
    WEIGHTS.pace +
    WEIGHTS.sleep +
    WEIGHTS.hrv +
    WEIGHTS.rhr +
    WEIGHTS.body;
  const score =
    parts.weeklyDistance.completeness * WEIGHTS.weeklyDistance +
    parts.paceGap.completeness * WEIGHTS.pace +
    parts.sleep.completeness * WEIGHTS.sleep +
    parts.hrv.completeness * WEIGHTS.hrv +
    parts.rhr.completeness * WEIGHTS.rhr +
    parts.body.completeness * WEIGHTS.body;
  const value = clamp01(score / totalWeight);
  return {
    value,
    completeness: 1,
    explanationKey: "data_completeness",
  };
}
