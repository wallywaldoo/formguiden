import type { DailySession, WeekPlan } from "@/lib/training-plan/schema";
import type { TrainingSnapshot } from "@/lib/training-plan/snapshot";

export const TRAINING_AI_TIMEOUT_MS = 8_000;

export interface TrainingPlanGenerator {
  readonly provider: "stub" | "openai";
  readonly model: string;
  generateToday(snapshot: TrainingSnapshot): Promise<DailySession>;
  generateWeek(snapshot: TrainingSnapshot): Promise<WeekPlan>;
}
