import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";

import { addDays } from "@/lib/analytics/dates";
import { TRAINING_AI_TIMEOUT_MS } from "@/lib/ai/training/types";
import type { TrainingPlanGenerator } from "@/lib/ai/training/types";
import {
  dailySessionSchema,
  weekPlanSchema,
  type DailySession,
  type WeekPlan,
} from "@/lib/training-plan/schema";
import {
  snapshotPromptPayload,
  TRAINING_PLAN_SYSTEM,
} from "@/lib/training-plan/prompt";
import type { TrainingSnapshot } from "@/lib/training-plan/snapshot";

const DEFAULT_MODEL = "gpt-4o-mini";

function withTimeout() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRAINING_AI_TIMEOUT_MS);
  return {
    signal: controller.signal,
    done() {
      clearTimeout(timer);
    },
  };
}

export class OpenAiTrainingPlanGenerator implements TrainingPlanGenerator {
  readonly provider = "openai" as const;
  readonly model = process.env.TRAINING_AI_MODEL?.trim() || DEFAULT_MODEL;

  async generateToday(snapshot: TrainingSnapshot): Promise<DailySession> {
    const timeout = withTimeout();
    try {
      const { output } = await generateText({
        model: openai(this.model),
        output: Output.object({ schema: dailySessionSchema }),
        system: TRAINING_PLAN_SYSTEM,
        prompt: `Skapa Dagens pass. localDate måste vara ${snapshot.localDate}.\n${JSON.stringify(snapshotPromptPayload(snapshot))}`,
        abortSignal: timeout.signal,
      });
      if (!output) {
        throw new Error("Tomt AI-svar för dagens pass.");
      }
      return dailySessionSchema.parse({
        ...output,
        localDate: snapshot.localDate,
      });
    } finally {
      timeout.done();
    }
  }

  async generateWeek(snapshot: TrainingSnapshot): Promise<WeekPlan> {
    const timeout = withTimeout();
    try {
      const { output } = await generateText({
        model: openai(this.model),
        output: Output.object({ schema: weekPlanSchema }),
        system: TRAINING_PLAN_SYSTEM,
        prompt: `Skapa en veckoplan med exakt 7 dagar. weekStart måste vara ${snapshot.weekStart}. Dag 0 är måndag.\n${JSON.stringify(snapshotPromptPayload(snapshot))}`,
        abortSignal: timeout.signal,
      });
      if (!output) {
        throw new Error("Tomt AI-svar för veckoplanen.");
      }
      const days = Array.from({ length: 7 }, (_, index) => {
        const localDate = addDays(snapshot.weekStart, index);
        const raw = output.days[index] ?? output.days[0];
        return { ...raw, localDate };
      });
      return weekPlanSchema.parse({
        weekStart: snapshot.weekStart,
        days,
      });
    } finally {
      timeout.done();
    }
  }
}
