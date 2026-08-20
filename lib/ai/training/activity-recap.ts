import { generateText, Output } from "ai";
import { openai } from "@ai-sdk/openai";

import { TRAINING_AI_TIMEOUT_MS } from "@/lib/ai/training/types";
import {
  activityRecapSchema,
  buildRuleActivityRecap,
  recapPromptPayload,
  type ActivityRecap,
  type ActivityRecapFacts,
} from "@/lib/analytics/activity-recap";
import { isTrainingAiEnabled } from "@/lib/ai/training/create-generator";

const SYSTEM = `Du är Formkurvans träningscoach. Skriv kort på svenska.
Bedöm BARA utifrån siffrorna i JSON. Hitta inte på mätvärden.
Ge inte medicinska råd.
score är ett heltal 1–10 för hur bra passet genomfördes mot planen och utförandet.
planFit: followed | partly | missed | unplanned.
coachTake: 2–3 korta meningar om vad du tycker och vad som var bra eller sämre.
headline: tre till fem ord.`;

export async function generateActivityRecap(
  facts: ActivityRecapFacts,
): Promise<{
  recap: ActivityRecap;
  source: "rules" | "openai";
  model: string | null;
}> {
  const fallback = buildRuleActivityRecap(facts);
  if (!isTrainingAiEnabled() || process.env.TRAINING_AI_PROVIDER !== "openai") {
    return { recap: fallback, source: "rules", model: null };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TRAINING_AI_TIMEOUT_MS);
  const model = process.env.TRAINING_AI_MODEL?.trim() || "gpt-4o-mini";
  try {
    const { output } = await generateText({
      model: openai(model),
      output: Output.object({ schema: activityRecapSchema }),
      system: SYSTEM,
      prompt: JSON.stringify({
        ruleHint: fallback,
        facts: recapPromptPayload(facts),
      }),
      abortSignal: controller.signal,
    });
    if (!output) {
      return { recap: fallback, source: "rules", model: null };
    }
    return {
      recap: activityRecapSchema.parse(output),
      source: "openai",
      model,
    };
  } catch {
    return { recap: fallback, source: "rules", model: null };
  } finally {
    clearTimeout(timer);
  }
}
