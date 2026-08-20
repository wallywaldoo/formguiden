import type { PrimaryAction } from "@/lib/analytics/primary-action";
import type { RecommendationDraft } from "@/lib/recommendations/types";

export type TrainingCue = {
  label: string;
  reason: string;
  href: string;
};

export function trainingCue(input: {
  action: PrimaryAction;
  recommendation: RecommendationDraft | null;
  lastRunAt: string | null;
  now: Date;
}): TrainingCue {
  const hoursSinceRun =
    input.lastRunAt == null
      ? null
      : (input.now.getTime() - new Date(input.lastRunAt).getTime()) / 3_600_000;
  const actionKey = input.recommendation?.actionKey;
  const href = input.action.href;

  if (hoursSinceRun != null && hoursSinceRun < 12) {
    return {
      label: "Återhämtning",
      reason: "Du har redan ett pass inne. Låt det sjunka in.",
      href: "/recovery",
    };
  }
  if (actionKey === "recovery_easy_day" || href === "/recovery") {
    return {
      label: "Vila",
      reason: input.action.reason,
      href: "/recovery",
    };
  }
  if (actionKey === "plan_strength_session" || href === "/strength") {
    return {
      label: "Styrka",
      reason: input.action.reason,
      href: "/strength",
    };
  }
  if (
    href.startsWith("/running") ||
    actionKey === "increase_weekly_volume" ||
    actionKey === "maintain_training" ||
    actionKey === "review_pace_gap"
  ) {
    return {
      label: "Löpning",
      reason: input.action.reason,
      href: "/running",
    };
  }
  return {
    label: input.action.label,
    reason: input.action.reason,
    href,
  };
}
