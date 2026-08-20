import { NextResponse } from "next/server";
import { z } from "zod";

import {
  generateCoachResponse,
  summarizeCoachSignals,
} from "@/features/assistant/coach-response";
import { getCoachContextData } from "@/features/assistant/queries";
import { loadTrainingSnapshotInput } from "@/features/training-plan/load";
import { ensureTrainingPlans } from "@/features/training-plan/service";
import { generateCoachChatReply } from "@/lib/ai/training/coach";
import { isTrainingAiEnabled } from "@/lib/ai/training/create-generator";
import { getSession } from "@/lib/auth";
import { buildTrainingSnapshot } from "@/lib/training-plan/snapshot";

export const maxDuration = 30;

const bodySchema = z.object({
  message: z.string().trim().min(1, "Skriv en fråga först.").max(2_000),
});

function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Logga in för att använda coachen." }, { status: 401 });
}

export async function POST(request: Request) {
  const authenticated = await getSession();
  if (!authenticated) {
    return unauthorized();
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Ogiltig begäran." },
      { status: 400 },
    );
  }

  try {
    const context = await getCoachContextData();
    const fallback = generateCoachResponse({
      message: parsed.data.message,
      context,
    });
    const summary = summarizeCoachSignals({ context });

    if (isTrainingAiEnabled() && process.env.TRAINING_AI_PROVIDER === "openai") {
      try {
        const plans = await ensureTrainingPlans();
        const snapshot = buildTrainingSnapshot(
          await loadTrainingSnapshotInput({ now: new Date() }),
        );
        const reply = await generateCoachChatReply({
          message: parsed.data.message,
          snapshot,
          today: plans?.today ?? null,
          week: plans?.week ?? null,
        });
        return NextResponse.json({
          reply,
          summary,
          generatedAt: new Date().toISOString(),
        });
      } catch {
        // Fall back to the deterministic coach if the model call fails.
      }
    }

    return NextResponse.json({
      reply: fallback.reply,
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Coachen kunde inte läsa din träningsdata just nu. Försök igen om en liten stund.",
      },
      { status: 500 },
    );
  }
}
