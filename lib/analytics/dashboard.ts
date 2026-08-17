import { bodyWeightTrend, latestMass } from "@/lib/analytics/body";
import { dataCompleteness } from "@/lib/analytics/completeness";
import { primaryAction } from "@/lib/analytics/primary-action";
import {
  goalPaceGap,
  intensityDistribution,
  longRunConsistency,
  rollingDistance,
  weeklyPaceTrend,
  weeklyRunDistance,
} from "@/lib/analytics/running";
import {
  hrvBaseline,
  rhrBaseline,
  sleepConsistency,
  sleepDurationMean,
} from "@/lib/analytics/recovery";
import type {
  ActivityPoint,
  AnalyticsContext,
  BodyPoint,
  HealthPoint,
} from "@/lib/analytics/types";
import type { RecommendationDraft } from "@/lib/recommendations/types";

export function computeDashboard(input: {
  activities: ActivityPoint[];
  health: HealthPoint[];
  body: BodyPoint[];
  context: AnalyticsContext;
  pendingImportId: string | null;
  recommendation?: RecommendationDraft | null;
}) {
  const weeklyDistance = weeklyRunDistance(input.activities, input.context);
  const distance7 = rollingDistance(input.activities, input.context, 7);
  const distance28 = rollingDistance(input.activities, input.context, 28);
  const distance90 = rollingDistance(input.activities, input.context, 90);
  const longRuns = longRunConsistency(input.activities, input.context);
  const intensity = intensityDistribution(input.activities, input.context);
  const paceTrend = weeklyPaceTrend(input.activities, input.context);
  const paceGap = goalPaceGap(input.activities, input.context);
  const sleep = sleepDurationMean(input.health, input.context);
  const sleepSpread = sleepConsistency(input.health, input.context);
  const hrv = hrvBaseline(input.health, input.context);
  const rhr = rhrBaseline(input.health, input.context);
  const bodyTrend = bodyWeightTrend(input.body, input.context);
  const completeness = dataCompleteness({
    weeklyDistance,
    paceGap,
    sleep,
    hrv,
    rhr,
    body: bodyTrend,
  });

  return {
    weeklyDistance,
    distance7,
    distance28,
    distance90,
    longRuns,
    intensity,
    paceTrend,
    paceGap,
    sleep,
    sleepSpread,
    hrv,
    rhr,
    bodyTrend,
    latestMass: latestMass(input.body),
    completeness,
    action: primaryAction({
      activities: input.activities,
      pendingImportId: input.pendingImportId,
      completeness,
      paceGap,
      recommendation: input.recommendation,
    }),
  };
}
