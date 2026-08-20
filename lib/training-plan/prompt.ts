import type { TrainingSnapshot } from "@/lib/training-plan/snapshot";
import { dailySessionSchema, weekPlanSchema } from "@/lib/training-plan/schema";

export function snapshotPromptPayload(snapshot: TrainingSnapshot) {
  return {
    today: snapshot.localDate,
    weekStart: snapshot.weekStart,
    weekday: snapshot.weekday,
    alreadyTrainedToday: snapshot.alreadyTrainedToday,
    hoursSinceLastActivity: snapshot.hoursSinceLastActivity,
    lastActivity: snapshot.lastActivity,
    weeklyDistanceM: snapshot.weeklyDistanceM,
    weeklyDistanceGoalM: snapshot.weeklyDistanceGoalM,
    weeklyStrengthCount: snapshot.weeklyStrengthCount,
    weeklyStrengthTarget: snapshot.weeklyStrengthTarget,
    sleepLastNightHours:
      snapshot.sleepLastNightS != null
        ? Math.round((snapshot.sleepLastNightS / 3600) * 10) / 10
        : null,
    sleepAvg7dHours:
      snapshot.sleepAvg7dS != null
        ? Math.round((snapshot.sleepAvg7dS / 3600) * 10) / 10
        : null,
    hrvMs: snapshot.hrvMs,
    hrvBaselineMs: snapshot.hrvBaselineMs,
    rule: snapshot.recommendation,
    allowedKindsToday: snapshot.allowedKinds,
    vetoReason: snapshot.vetoReason,
    preferredKind: snapshot.preferredKind,
    recentActivities: snapshot.recentActivities,
    recentHealth: snapshot.recentHealth,
    goal: snapshot.goal,
    feedback: snapshot.feedback,
    distanceUnit: snapshot.distanceUnit,
  };
}

export const TRAINING_PLAN_SYSTEM = `Du är Formkurvans träningscoach. Du skriver korta, konkreta pass på svenska.
Du ger inte medicinska råd. Du hittar inte på mätvärden. Använd bara siffrorna i kontexten.
Dagens pass MÅSTE ha kind som finns i allowedKindsToday, utom när alreadyTrainedToday är true.
Om alreadyTrainedToday är true: dagens pass är redan genomfört. Rekommendera inte ett nytt pass och flytta inte morgondagens pass till idag. Behåll dagens ursprungliga pass-typ i veckoplanen (till exempel lätt löpning). Sätt inte aktiv vila eller vila på idag bara för att passet är gjort.
Veckan får ha variation: lätt löpning, kvalitet, långpass, styrka, aktiv vila, vila.
Svara bara med strukturen som efterfrågas.`;

export { dailySessionSchema, weekPlanSchema };
