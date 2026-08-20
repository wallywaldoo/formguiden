import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

import { TRAINING_AI_TIMEOUT_MS } from "@/lib/ai/training/types";
import type { DailySession, WeekPlan } from "@/lib/training-plan/schema";
import { snapshotPromptPayload } from "@/lib/training-plan/prompt";
import type { TrainingSnapshot } from "@/lib/training-plan/snapshot";

const COACH_SYSTEM = `Du är Formkurvans träningscoach. Svara kort på svenska, 1–3 stycken.
Utgå från dagens rekommendation och siffrorna i kontexten. Hitta inte på mätvärden.
Ge inte medicinska råd. Om användaren vill ändra dagens pass, håll dig inom allowedKindsToday.`;

export async function generateCoachChatReply(input: {
  message: string;
  snapshot: TrainingSnapshot;
  today: DailySession | null;
  week: WeekPlan | null;
}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRAINING_AI_TIMEOUT_MS);
  const model = process.env.TRAINING_AI_MODEL?.trim() || "gpt-4o-mini";
  try {
    const { text } = await generateText({
      model: openai(model),
      system: COACH_SYSTEM,
      prompt: JSON.stringify({
        question: input.message,
        todayPlan: input.today,
        weekPlan: input.week,
        data: snapshotPromptPayload(input.snapshot),
      }),
      abortSignal: controller.signal,
    });
    const reply = text.trim();
    if (!reply) {
      throw new Error("Tomt coachesvar.");
    }
    return reply;
  } finally {
    clearTimeout(timer);
  }
}
