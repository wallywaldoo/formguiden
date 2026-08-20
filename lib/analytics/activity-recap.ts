import { z } from "zod";

import type { ActivityAnalysis } from "@/lib/analytics/activity-detail";
import { restorePlannedSession } from "@/lib/training-plan/fallback";
import {
  TRAINING_KIND_LABEL,
  type DailySession,
  type TrainingSessionKind,
  type WeekPlan,
} from "@/lib/training-plan/schema";
import { formatDistanceKm } from "@/lib/units/format";
import { formatDurationHms, formatPaceMinPerKm } from "@/lib/units/pace";

export const PLAN_FIT = ["followed", "partly", "missed", "unplanned"] as const;
export type PlanFit = (typeof PLAN_FIT)[number];

export const activityRecapSchema = z.object({
  score: z.number().int().min(1).max(10),
  headline: z.string().trim().min(1).max(80),
  coachTake: z.string().trim().min(1).max(600),
  planFit: z.enum(PLAN_FIT),
  planFitLabel: z.string().trim().min(1).max(40),
  planFitNote: z.string().trim().min(1).max(180),
});

export type ActivityRecap = z.infer<typeof activityRecapSchema>;

export type ActivityRecapFacts = {
  activityId: string;
  activityType: string;
  localDate: string;
  durationS: number | null;
  distanceM: number | null;
  paceSPerKm: number | null;
  avgHeartRateBpm: number | null;
  planned: DailySession | null;
  analysis: Pick<
    ActivityAnalysis,
    "halves" | "compare" | "insights" | "hrZoneShare" | "pace" | "cadence"
  >;
};

export const PLAN_FIT_LABEL: Record<PlanFit, string> = {
  followed: "Följde planen",
  partly: "Delvis enligt plan",
  missed: "Avvek från planen",
  unplanned: "Utanför planen",
};

export function plannedSessionForDate(
  week: WeekPlan | null | undefined,
  localDate: string,
): DailySession | null {
  const day =
    week?.days.find((session) => session.localDate === localDate) ?? null;
  return restorePlannedSession(day, localDate);
}

const RUN_TYPES = new Set(["run", "trail_run", "treadmill"]);

export function inferExecutedKind(input: {
  activityType: string;
  durationS: number | null;
  distanceM: number | null;
  hrZoneShare: ActivityAnalysis["hrZoneShare"];
}): TrainingSessionKind {
  if (input.activityType === "strength") return "strength";
  if (input.activityType === "walk" || input.activityType === "hike") {
    return "active_recovery";
  }
  if (!RUN_TYPES.has(input.activityType)) return "easy_run";
  const hardShare = input.hrZoneShare
    .filter((zone) => zone.zone >= 4)
    .reduce((sum, zone) => sum + zone.pct, 0);
  if ((input.durationS ?? 0) >= 70 * 60 || (input.distanceM ?? 0) >= 16_000) {
    return "long_run";
  }
  if (hardShare >= 22) return "quality_run";
  return "easy_run";
}

export function classifyPlanFit(input: {
  planned: DailySession | null;
  executedKind: TrainingSessionKind;
  durationS: number | null;
}): { fit: PlanFit; note: string } {
  const planned = input.planned;
  if (planned == null || planned.title === "Klar för dagen") {
    return {
      fit: "unplanned",
      note: "Ingen träningsplan att jämföra mot för den här dagen.",
    };
  }
  if (planned.kind === "rest" || planned.kind === "active_recovery") {
    if (
      input.executedKind === "quality_run" ||
      input.executedKind === "long_run"
    ) {
      return {
        fit: "missed",
        note: `Planen var ${TRAINING_KIND_LABEL[planned.kind].toLowerCase()}, men passet blev mer krävande.`,
      };
    }
    return {
      fit: "partly",
      note: `Planen var ${TRAINING_KIND_LABEL[planned.kind].toLowerCase()}. Extra rörelse är okej om det hölls lätt.`,
    };
  }
  const kindMatch = planned.kind === input.executedKind;
  const durationMin = input.durationS != null ? input.durationS / 60 : null;
  const durationOk =
    planned.durationMin <= 0 ||
    durationMin == null ||
    Math.abs(durationMin - planned.durationMin) / planned.durationMin <= 0.25;
  if (kindMatch && durationOk) {
    return {
      fit: "followed",
      note: `Matchade ${TRAINING_KIND_LABEL[planned.kind].toLowerCase()} på cirka ${planned.durationMin} min.`,
    };
  }
  if (kindMatch || durationOk) {
    return {
      fit: "partly",
      note: kindMatch
        ? `Rätt typ (${TRAINING_KIND_LABEL[planned.kind]}), men tiden avvek från ${planned.durationMin} min.`
        : `Tiden var i närheten, men typen blev ${TRAINING_KIND_LABEL[input.executedKind].toLowerCase()} i stället för ${TRAINING_KIND_LABEL[planned.kind].toLowerCase()}.`,
    };
  }
  return {
    fit: "missed",
    note: `Planen var ${TRAINING_KIND_LABEL[planned.kind].toLowerCase()}, passet blev ${TRAINING_KIND_LABEL[input.executedKind].toLowerCase()}.`,
  };
}

function clampScore(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

const HEADLINES: Record<number, string> = {
  10: "Klockrent pass",
  9: "Riktigt starkt genomfört",
  8: "Solitt pass",
  7: "Bra jobbat",
  6: "Helt okej pass",
  5: "Gick i mål",
  4: "Lite spretigt",
  3: "Tungt pass",
  2: "Kämpigt idag",
  1: "Skakigt pass",
};

export function recapFingerprint(facts: ActivityRecapFacts): string {
  return [
    facts.activityId,
    facts.planned?.kind ?? "",
    facts.planned?.durationMin ?? "",
    facts.analysis.halves.splitKind ?? "",
    Math.round(facts.analysis.halves.decouplingPct ?? 0),
    Math.round(facts.analysis.compare.paceDeltaS ?? 0),
    Math.round(facts.durationS ?? 0),
  ].join("|");
}

export function recapPromptPayload(facts: ActivityRecapFacts) {
  const executedKind = inferExecutedKind({
    activityType: facts.activityType,
    durationS: facts.durationS,
    distanceM: facts.distanceM,
    hrZoneShare: facts.analysis.hrZoneShare,
  });
  const plan = classifyPlanFit({
    planned: facts.planned,
    executedKind,
    durationS: facts.durationS,
  });
  return {
    activityType: facts.activityType,
    localDate: facts.localDate,
    duration:
      facts.durationS != null ? formatDurationHms(facts.durationS) : null,
    distance:
      facts.distanceM != null ? formatDistanceKm(facts.distanceM, "km") : null,
    pace:
      facts.paceSPerKm != null
        ? `${formatPaceMinPerKm(facts.paceSPerKm)} /km`
        : null,
    avgHeartRateBpm: facts.avgHeartRateBpm,
    executedKind,
    planned: facts.planned
      ? {
          kind: facts.planned.kind,
          title: facts.planned.title,
          durationMin: facts.planned.durationMin,
          intensity: facts.planned.intensity,
        }
      : null,
    planFit: plan.fit,
    split: facts.analysis.halves.splitKind,
    decouplingPct: facts.analysis.halves.decouplingPct,
    vsSimilarPaceS: facts.analysis.compare.paceDeltaS,
    insights: facts.analysis.insights.slice(0, 4),
  };
}

export function buildRuleActivityRecap(
  facts: ActivityRecapFacts,
): ActivityRecap {
  const executedKind = inferExecutedKind({
    activityType: facts.activityType,
    durationS: facts.durationS,
    distanceM: facts.distanceM,
    hrZoneShare: facts.analysis.hrZoneShare,
  });
  const plan = classifyPlanFit({
    planned: facts.planned,
    executedKind,
    durationS: facts.durationS,
  });
  let score = 6;
  if (plan.fit === "followed") score += 2;
  else if (plan.fit === "partly") score += 1;
  else if (plan.fit === "missed") score -= 1;
  if (facts.analysis.halves.splitKind === "negative") score += 1;
  if (facts.analysis.halves.splitKind === "even") score += 1;
  if ((facts.analysis.halves.splitDeltaS ?? 0) > 12) score -= 1;
  if ((facts.analysis.halves.decouplingPct ?? 0) > 7) score -= 1;
  if (
    facts.analysis.halves.decouplingPct != null &&
    facts.analysis.halves.decouplingPct < 3
  ) {
    score += 1;
  }
  if ((facts.analysis.compare.paceDeltaS ?? 0) < -8) score += 1;
  if ((facts.analysis.compare.paceDeltaS ?? 0) > 25) score -= 1;
  score = clampScore(score);

  const bits = [...facts.analysis.insights.slice(0, 2)];
  if (facts.planned && facts.planned.title !== "Klar för dagen") {
    bits.unshift(plan.note);
  }
  if (bits.length === 0) {
    bits.push(
      "Passet är loggat. Vila, ät och låt det sjunka in till i morgon.",
    );
  }
  const coachTake = bits.join(" ");

  return activityRecapSchema.parse({
    score,
    headline: HEADLINES[score] ?? "Bra jobbat",
    coachTake: coachTake.slice(0, 600),
    planFit: plan.fit,
    planFitLabel: PLAN_FIT_LABEL[plan.fit],
    planFitNote: plan.note,
  });
}
