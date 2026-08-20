import { isoWeekStart, isoWeekday, toLocalDate } from "@/lib/analytics/dates";
import {
  hrvBaseline,
  sleepDurationMean,
} from "@/lib/analytics/recovery";
import { weeklyRunDistance } from "@/lib/analytics/running";
import { strengthFrequency } from "@/lib/analytics/strength";
import type {
  ActivityPoint,
  AnalyticsContext,
  HealthPoint,
} from "@/lib/analytics/types";
import { generateRecommendation } from "@/lib/recommendations/engine";
import type { RecommendationDraft } from "@/lib/recommendations/types";
import type { StrengthSessionPoint } from "@/lib/analytics/strength";
import {
  ALL_TRAINING_KINDS,
  EASY_OR_REST_KINDS,
  RECOVERY_ONLY_KINDS,
  type TrainingSessionKind,
} from "@/lib/training-plan/schema";
import { formatDistanceKm, formatHours } from "@/lib/units/format";
import { formatPaceMinPerKm } from "@/lib/units/pace";

export type TrainingSnapshotInput = {
  activities: ActivityPoint[];
  health: HealthPoint[];
  strengthSessions: StrengthSessionPoint[];
  context: AnalyticsContext;
  weeklyStrengthTarget: number | null;
  pendingImportId: string | null;
  distanceUnit: "km" | "mi";
  raceType: string | null;
  raceDate: string | null;
  feedback: string | null;
};

export type TrainingSnapshot = {
  localDate: string;
  weekStart: string;
  weekday: number;
  timeZone: string;
  distanceUnit: "km" | "mi";
  alreadyTrainedToday: boolean;
  hoursSinceLastActivity: number | null;
  lastActivity: {
    activityType: string;
    localDate: string;
    distanceM: number | null;
    durationS: number | null;
    avgPaceSPerKm: number | null;
  } | null;
  weeklyDistanceM: number | null;
  weeklyDistanceGoalM: number | null;
  weeklyStrengthCount: number;
  weeklyStrengthTarget: number | null;
  sleepLastNightS: number | null;
  sleepAvg7dS: number | null;
  hrvMs: number | null;
  hrvBaselineMs: number | null;
  recommendation: {
    ruleId: string;
    actionKey: string;
    actionSv: string;
  } | null;
  allowedKinds: TrainingSessionKind[];
  vetoReason: string | null;
  preferredKind: TrainingSessionKind | null;
  recentActivities: Array<{
    localDate: string;
    activityType: string;
    distanceM: number | null;
    durationS: number | null;
  }>;
  recentHealth: Array<{
    localDate: string;
    sleepHours: number | null;
    hrvMs: number | null;
  }>;
  goal: {
    raceType: string | null;
    raceDate: string | null;
    targetPaceSPerKm: number | null;
  };
  feedback: string | null;
};

function hoursBetween(iso: string, now: Date): number {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000;
}

function trainedOnDate(
  activities: ActivityPoint[],
  strengthSessions: StrengthSessionPoint[],
  localDate: string,
  timeZone: string,
): boolean {
  return (
    activities.some(
      (activity) => toLocalDate(activity.startedAt, timeZone) === localDate,
    ) ||
    strengthSessions.some(
      (session) => toLocalDate(session.startedAt, timeZone) === localDate,
    )
  );
}

export function allowedKindsFromRules(input: {
  alreadyTrainedToday: boolean;
  hoursSinceLastActivity: number | null;
  recommendation: RecommendationDraft | null;
}): { allowedKinds: TrainingSessionKind[]; vetoReason: string | null } {
  if (
    input.alreadyTrainedToday ||
    (input.hoursSinceLastActivity != null && input.hoursSinceLastActivity < 12)
  ) {
    return {
      allowedKinds: RECOVERY_ONLY_KINDS,
      vetoReason: "Du har redan ett pass inne. Låt det sjunka in.",
    };
  }
  if (input.recommendation?.actionKey === "recovery_easy_day") {
    return {
      allowedKinds: EASY_OR_REST_KINDS,
      vetoReason: input.recommendation.actionSv,
    };
  }
  return { allowedKinds: ALL_TRAINING_KINDS, vetoReason: null };
}

export function preferredKindFromRecommendation(
  recommendation: RecommendationDraft | null,
): TrainingSessionKind | null {
  switch (recommendation?.actionKey) {
    case "recovery_easy_day":
      return "easy_run";
    case "plan_strength_session":
      return "strength";
    case "increase_weekly_volume":
      return "easy_run";
    case "review_pace_gap":
      return "easy_run";
    case "maintain_training":
      return "quality_run";
    default:
      return null;
  }
}

export function snapshotFingerprint(snapshot: TrainingSnapshot): string {
  return [
    snapshot.localDate,
    snapshot.lastActivity?.localDate ?? "",
    snapshot.lastActivity?.activityType ?? "",
    snapshot.weeklyDistanceM ?? "",
    snapshot.weeklyStrengthCount,
    snapshot.sleepLastNightS ?? "",
    snapshot.hrvMs ?? "",
    snapshot.allowedKinds.join(","),
    snapshot.feedback ?? "",
  ].join("|");
}

export function buildTrainingSnapshot(
  input: TrainingSnapshotInput,
): TrainingSnapshot {
  const { context } = input;
  const localDate = toLocalDate(context.now.toISOString(), context.timeZone);
  const weekStart = isoWeekStart(localDate);
  const latestActivity = [...input.activities].sort((a, b) =>
    a.startedAt < b.startedAt ? 1 : -1,
  )[0];
  const latestStamp = [
    latestActivity?.startedAt,
    ...input.strengthSessions.map((session) => session.startedAt),
  ]
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => (a < b ? 1 : -1))[0];
  const lastActivity = latestActivity
    ? {
        activityType: latestActivity.activityType,
        localDate: toLocalDate(latestActivity.startedAt, context.timeZone),
        distanceM: latestActivity.distanceM,
        durationS: latestActivity.durationS,
        avgPaceSPerKm: latestActivity.avgPaceSPerKm,
      }
    : null;
  const hoursSinceLastActivity = latestStamp
    ? hoursBetween(latestStamp, context.now)
    : null;
  const alreadyTrainedToday = trainedOnDate(
    input.activities,
    input.strengthSessions,
    localDate,
    context.timeZone,
  );
  const recommendation = generateRecommendation({
    activities: input.activities,
    health: input.health,
    body: [],
    strengthSessions: input.strengthSessions,
    context,
    weeklyStrengthTarget: input.weeklyStrengthTarget,
    pendingImportId: input.pendingImportId,
  });
  const caps = allowedKindsFromRules({
    alreadyTrainedToday,
    hoursSinceLastActivity,
    recommendation,
  });
  const weeklyDistance = weeklyRunDistance(input.activities, context);
  const sleep = sleepDurationMean(input.health, context);
  const hrv = hrvBaseline(input.health, context);
  const todayHealth = input.health.find((row) => row.localDate === localDate);
  const lastNight =
    todayHealth ??
    input.health.find((row) => row.localDate < localDate) ??
    null;
  const strength = strengthFrequency(
    input.strengthSessions,
    context,
    input.weeklyStrengthTarget,
  );

  return {
    localDate,
    weekStart,
    weekday: isoWeekday(localDate),
    timeZone: context.timeZone,
    distanceUnit: input.distanceUnit,
    alreadyTrainedToday,
    hoursSinceLastActivity,
    lastActivity,
    weeklyDistanceM: weeklyDistance.value,
    weeklyDistanceGoalM: context.goal.weeklyRunDistanceM,
    weeklyStrengthCount: strength.value ?? 0,
    weeklyStrengthTarget: input.weeklyStrengthTarget,
    sleepLastNightS: lastNight?.sleepDurationS ?? null,
    sleepAvg7dS: sleep.value,
    hrvMs: lastNight?.hrvRmssdMs ?? null,
    hrvBaselineMs: hrv.value,
    recommendation: recommendation
      ? {
          ruleId: recommendation.ruleId,
          actionKey: recommendation.actionKey,
          actionSv: recommendation.actionSv,
        }
      : null,
    allowedKinds: caps.allowedKinds,
    vetoReason: caps.vetoReason,
    preferredKind: preferredKindFromRecommendation(recommendation),
    recentActivities: input.activities.slice(0, 12).map((activity) => ({
      localDate: toLocalDate(activity.startedAt, context.timeZone),
      activityType: activity.activityType,
      distanceM: activity.distanceM,
      durationS: activity.durationS,
    })),
    recentHealth: input.health.slice(0, 8).map((day) => ({
      localDate: day.localDate,
      sleepHours:
        day.sleepDurationS != null ? day.sleepDurationS / 3600 : null,
      hrvMs: day.hrvRmssdMs,
    })),
    goal: {
      raceType: input.raceType,
      raceDate: input.raceDate,
      targetPaceSPerKm: context.goal.targetPaceSPerKm,
    },
    feedback: input.feedback,
  };
}

export function snapshotFacts(snapshot: TrainingSnapshot): string[] {
  const facts: string[] = [];
  if (snapshot.sleepLastNightS != null) {
    facts.push(`Sömn ${formatHours(snapshot.sleepLastNightS)}`);
  }
  if (snapshot.hrvMs != null && snapshot.hrvBaselineMs != null) {
    const delta = snapshot.hrvMs - snapshot.hrvBaselineMs;
    facts.push(
      `HRV ${Math.round(snapshot.hrvMs)} ms (${delta >= 0 ? "+" : ""}${Math.round(delta)} mot baseline)`,
    );
  } else if (snapshot.hrvMs != null) {
    facts.push(`HRV ${Math.round(snapshot.hrvMs)} ms`);
  }
  if (
    snapshot.weeklyDistanceM != null &&
    snapshot.weeklyDistanceGoalM != null
  ) {
    facts.push(
      `Vecka ${formatDistanceKm(snapshot.weeklyDistanceM, snapshot.distanceUnit)} av ${formatDistanceKm(snapshot.weeklyDistanceGoalM, snapshot.distanceUnit)}`,
    );
  } else if (snapshot.weeklyDistanceM != null) {
    facts.push(
      `Vecka ${formatDistanceKm(snapshot.weeklyDistanceM, snapshot.distanceUnit)}`,
    );
  }
  if (snapshot.lastActivity) {
    const bits = [snapshot.lastActivity.activityType];
    if (snapshot.lastActivity.distanceM != null) {
      bits.push(
        formatDistanceKm(snapshot.lastActivity.distanceM, snapshot.distanceUnit),
      );
    }
    if (snapshot.lastActivity.avgPaceSPerKm != null) {
      bits.push(`${formatPaceMinPerKm(snapshot.lastActivity.avgPaceSPerKm)} /km`);
    }
    facts.push(`Senaste: ${bits.join(" · ")}`);
  }
  if (snapshot.feedback) {
    facts.push(`Notis: ${snapshot.feedback}`);
  }
  return facts.slice(0, 4);
}
