import { dataCompleteness } from "@/lib/analytics/completeness";
import { bodyWeightTrend } from "@/lib/analytics/body";
import {
  inInclusiveRange,
  rollingWindow,
  toLocalDate,
} from "@/lib/analytics/dates";
import { goalPaceGap, weeklyRunDistance } from "@/lib/analytics/running";
import { runFamilyActivities } from "@/lib/analytics/running-filter";
import {
  hrvBaseline,
  rhrBaseline,
  sleepDurationMean,
} from "@/lib/analytics/recovery";
import { strengthFrequency } from "@/lib/analytics/strength";
import { mean } from "@/lib/analytics/stats";
import {
  PACE_FAST_FACTOR,
  type ActivityPoint,
  type AnalyticsContext,
  type HealthPoint,
} from "@/lib/analytics/types";
import type {
  RecommendationDraft,
  RecommendationInput,
} from "@/lib/recommendations/types";

export const SLEEP_DEBT_NIGHTS = 3;
export const SLEEP_DEBT_THRESHOLD_S = 6 * 3600;
export const WEEKLY_VOLUME_BEHIND_RATIO = 0.7;
export const PACE_GAP_RECOMMENDATION_S = 15;

type Rule = {
  priority: number;
  evaluate: (input: RecommendationInput) => RecommendationDraft | null;
};

function sleepDebtNights(
  health: HealthPoint[],
  context: AnalyticsContext,
  nights: number,
): { avgSleepS: number | null; nightsWithData: number } {
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, nights);
  const values = health
    .filter((point) =>
      inInclusiveRange(point.localDate, window.start, window.end),
    )
    .map((point) => point.sleepDurationS)
    .filter((value): value is number => value != null && value > 0);
  return {
    avgSleepS: mean(values),
    nightsWithData: values.length,
  };
}

function recentFastRuns(
  activities: ActivityPoint[],
  context: AnalyticsContext,
  days: number,
): number {
  const target = context.goal.targetPaceSPerKm;
  if (target == null || target <= 0) {
    return 0;
  }
  const today = toLocalDate(context.now.toISOString(), context.timeZone);
  const window = rollingWindow(today, days);
  return runFamilyActivities(activities).filter((activity) => {
    const localDate = toLocalDate(activity.startedAt, context.timeZone);
    if (!inInclusiveRange(localDate, window.start, window.end)) {
      return false;
    }
    const pace = activity.avgPaceSPerKm;
    return pace != null && pace < target * PACE_FAST_FACTOR;
  }).length;
}

function isoWeekdayIndex(localDate: string): number {
  const [year, month, day] = localDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const dayIndex = date.getUTCDay();
  return dayIndex === 0 ? 7 : dayIndex;
}

function sharedMetrics(input: RecommendationInput) {
  const weeklyDistance = weeklyRunDistance(input.activities, input.context);
  const paceGap = goalPaceGap(input.activities, input.context);
  const sleep = sleepDurationMean(input.health, input.context);
  const hrv = hrvBaseline(input.health, input.context);
  const rhr = rhrBaseline(input.health, input.context);
  const body = bodyWeightTrend(input.body, input.context);
  const completeness = dataCompleteness({
    weeklyDistance,
    paceGap,
    sleep,
    hrv,
    rhr,
    body,
  });
  return { weeklyDistance, paceGap, completeness };
}

export const RECOMMENDATION_RULES: Rule[] = [
  {
    priority: 10,
    evaluate(input) {
      if (input.pendingImportId) {
        return null;
      }
      const { avgSleepS, nightsWithData } = sleepDebtNights(
        input.health,
        input.context,
        SLEEP_DEBT_NIGHTS,
      );
      if (avgSleepS == null || nightsWithData < 2) {
        return null;
      }
      const fastRuns = recentFastRuns(input.activities, input.context, 2);
      if (avgSleepS >= SLEEP_DEBT_THRESHOLD_S || fastRuns === 0) {
        return null;
      }
      return {
        ruleId: "sleep_debt_limit_intensity",
        actionKey: "recovery_easy_day",
        actionSv: "Vila eller kör lätt idag",
        href: "/recovery",
        comparisonPeriodDays: SLEEP_DEBT_NIGHTS,
        completeness: nightsWithData / SLEEP_DEBT_NIGHTS,
        confidence: nightsWithData >= SLEEP_DEBT_NIGHTS ? "medium" : "low",
        disclaimerKey: "recovery_general",
        formulaKeys: ["sleep_duration_mean", "intensity_fast_run"],
        priority: 10,
        signals: [
          {
            signalKey: "sleep_avg_hours",
            observedValue: avgSleepS / 3600,
            unit: "h",
            comparator: "lt",
            referenceValue: SLEEP_DEBT_THRESHOLD_S / 3600,
          },
          {
            signalKey: "recent_fast_runs",
            observedValue: fastRuns,
            unit: "count",
            comparator: "gte",
            referenceValue: 1,
          },
        ],
      };
    },
  },
  {
    priority: 20,
    evaluate(input) {
      const goalM = input.context.goal.weeklyRunDistanceM;
      if (goalM == null || goalM <= 0 || input.pendingImportId) {
        return null;
      }
      const today = toLocalDate(
        input.context.now.toISOString(),
        input.context.timeZone,
      );
      const weekday = isoWeekdayIndex(today);
      if (weekday < 3) {
        return null;
      }
      const weeklyDistance = weeklyRunDistance(input.activities, input.context);
      const actual = weeklyDistance.value ?? 0;
      const expected = goalM * (weekday / 7);
      if (actual >= expected * WEEKLY_VOLUME_BEHIND_RATIO) {
        return null;
      }
      return {
        ruleId: "weekly_volume_behind",
        actionKey: "increase_weekly_volume",
        actionSv: "Öka veckovolymen",
        href: "/running",
        comparisonPeriodDays: weekday,
        completeness: weeklyDistance.completeness,
        confidence: weekday >= 5 ? "high" : "medium",
        disclaimerKey: "training_general",
        formulaKeys: ["weekly_run_distance", "weekly_volume_progress"],
        priority: 20,
        signals: [
          {
            signalKey: "weekly_distance_m",
            observedValue: actual,
            unit: "m",
            comparator: "lt",
            referenceValue: expected * WEEKLY_VOLUME_BEHIND_RATIO,
          },
          {
            signalKey: "weekly_distance_goal_m",
            observedValue: goalM,
            unit: "m",
            comparator: "eq",
            referenceValue: goalM,
          },
        ],
      };
    },
  },
  {
    priority: 30,
    evaluate(input) {
      const target = input.weeklyStrengthTarget;
      if (target == null || target <= 0 || input.pendingImportId) {
        return null;
      }
      const today = toLocalDate(
        input.context.now.toISOString(),
        input.context.timeZone,
      );
      const weekday = isoWeekdayIndex(today);
      const frequency = strengthFrequency(
        input.strengthSessions,
        input.context,
        target,
      );
      const count = frequency.value ?? 0;
      if (count >= target || weekday < 3) {
        return null;
      }
      return {
        ruleId: "strength_behind_target",
        actionKey: "plan_strength_session",
        actionSv: "Planera styrkepass",
        href: "/strength",
        comparisonPeriodDays: 7,
        completeness: frequency.completeness,
        confidence: weekday >= 6 ? "high" : "medium",
        disclaimerKey: "training_general",
        formulaKeys: ["strength_frequency"],
        priority: 30,
        signals: [
          {
            signalKey: "strength_sessions_week",
            observedValue: count,
            unit: "count",
            comparator: "lt",
            referenceValue: target,
          },
        ],
      };
    },
  },
  {
    priority: 40,
    evaluate(input) {
      if (input.pendingImportId) {
        return null;
      }
      const paceGap = goalPaceGap(input.activities, input.context);
      const gap = paceGap.value;
      if (gap == null || gap <= PACE_GAP_RECOMMENDATION_S) {
        return null;
      }
      return {
        ruleId: "pace_gap_review",
        actionKey: "review_pace_gap",
        actionSv: "Granska tempo mot mål",
        href: "/running",
        comparisonPeriodDays: 28,
        completeness: paceGap.completeness,
        confidence: gap > 30 ? "high" : "medium",
        disclaimerKey: "training_general",
        formulaKeys: ["goal_pace_gap"],
        priority: 40,
        signals: [
          {
            signalKey: "pace_gap_s_per_km",
            observedValue: gap,
            unit: "s/km",
            comparator: "gt",
            referenceValue: PACE_GAP_RECOMMENDATION_S,
          },
        ],
      };
    },
  },
  {
    priority: 50,
    evaluate(input) {
      if (input.pendingImportId) {
        return null;
      }
      const metrics = sharedMetrics(input);
      const value = metrics.completeness.value;
      if (value == null || value >= 0.4) {
        return null;
      }
      if (runFamilyActivities(input.activities).length === 0) {
        return null;
      }
      return {
        ruleId: "data_completeness_import",
        actionKey: "import_more_data",
        actionSv: "Hämta in fler Garmin-filer",
        href: "/import",
        comparisonPeriodDays: 90,
        completeness: value,
        confidence: value < 0.25 ? "low" : "medium",
        disclaimerKey: "training_general",
        formulaKeys: ["data_completeness"],
        priority: 50,
        signals: [
          {
            signalKey: "data_completeness",
            observedValue: value,
            unit: "ratio",
            comparator: "lt",
            referenceValue: 0.4,
          },
        ],
      };
    },
  },
  {
    priority: 100,
    evaluate(input) {
      if (input.pendingImportId) {
        return null;
      }
      if (runFamilyActivities(input.activities).length === 0) {
        return null;
      }
      const metrics = sharedMetrics(input);
      const value = metrics.completeness.value ?? 0;
      return {
        ruleId: "maintain_consistency",
        actionKey: "maintain_training",
        actionSv: "Fortsätt enligt plan",
        href: "/running",
        comparisonPeriodDays: 7,
        completeness: value,
        confidence: value >= 0.7 ? "high" : "medium",
        disclaimerKey: "training_general",
        formulaKeys: ["weekly_run_distance", "data_completeness"],
        priority: 100,
        signals: [
          {
            signalKey: "weekly_distance_m",
            observedValue: metrics.weeklyDistance.value,
            unit: "m",
            comparator: "eq",
            referenceValue: input.context.goal.weeklyRunDistanceM,
          },
        ],
      };
    },
  },
];

export function evaluateRecommendation(
  input: RecommendationInput,
): RecommendationDraft | null {
  const matches = RECOMMENDATION_RULES.map((rule) =>
    rule.evaluate(input),
  ).filter((candidate): candidate is RecommendationDraft => candidate != null);
  if (matches.length === 0) {
    return null;
  }
  return matches.sort((a, b) => a.priority - b.priority)[0] ?? null;
}
