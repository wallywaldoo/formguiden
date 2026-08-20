import { z } from "zod";

export const TRAINING_SESSION_KINDS = [
  "easy_run",
  "quality_run",
  "long_run",
  "strength",
  "active_recovery",
  "rest",
] as const;

export type TrainingSessionKind = (typeof TRAINING_SESSION_KINDS)[number];

export const ALL_TRAINING_KINDS: TrainingSessionKind[] = [
  ...TRAINING_SESSION_KINDS,
];

export const EASY_OR_REST_KINDS: TrainingSessionKind[] = [
  "easy_run",
  "active_recovery",
  "rest",
];

export const RECOVERY_ONLY_KINDS: TrainingSessionKind[] = [
  "active_recovery",
  "rest",
];

export const trainingSessionKindSchema = z.enum(TRAINING_SESSION_KINDS);

export const dailySessionSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: trainingSessionKindSchema,
  title: z.string().trim().min(1).max(80),
  durationMin: z.number().int().min(0).max(240),
  intensity: z.string().trim().min(1).max(60),
  steps: z.array(z.string().trim().min(1).max(160)).min(1).max(6),
  why: z.array(z.string().trim().min(1).max(160)).min(1).max(4),
});

export const weekPlanSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.array(dailySessionSchema).length(7),
});

export type DailySession = z.infer<typeof dailySessionSchema>;
export type WeekPlan = z.infer<typeof weekPlanSchema>;

export const TRAINING_KIND_LABEL: Record<TrainingSessionKind, string> = {
  easy_run: "Lätt löpning",
  quality_run: "Kvalitet",
  long_run: "Långpass",
  strength: "Styrka",
  active_recovery: "Aktiv vila",
  rest: "Vila",
};

export function hrefForKind(kind: TrainingSessionKind): string {
  switch (kind) {
    case "strength":
      return "/strength";
    case "active_recovery":
    case "rest":
      return "/recovery";
    default:
      return "/running";
  }
}

export function ctaForKind(_kind: TrainingSessionKind): string {
  return "Logga pass";
}

export function clampSessionToKinds(
  session: DailySession,
  allowed: TrainingSessionKind[],
  fallback: DailySession,
): DailySession {
  if (allowed.includes(session.kind)) {
    return { ...session, localDate: fallback.localDate };
  }
  return fallback;
}
