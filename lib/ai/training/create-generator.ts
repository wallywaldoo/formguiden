import { OpenAiTrainingPlanGenerator } from "@/lib/ai/training/openai";
import { StubTrainingPlanGenerator } from "@/lib/ai/training/stub";
import type { TrainingPlanGenerator } from "@/lib/ai/training/types";

export function isTrainingAiEnabled(): boolean {
  const provider = process.env.TRAINING_AI_PROVIDER;
  if (provider === "stub") return true;
  return provider === "openai" && Boolean(process.env.OPENAI_API_KEY);
}

export function createTrainingPlanGenerator(): TrainingPlanGenerator | null {
  const provider = process.env.TRAINING_AI_PROVIDER;
  if (provider === "stub") {
    return new StubTrainingPlanGenerator();
  }
  if (provider === "openai" && process.env.OPENAI_API_KEY) {
    return new OpenAiTrainingPlanGenerator();
  }
  return null;
}
