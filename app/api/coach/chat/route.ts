import { NextResponse } from "next/server";
import { z } from "zod";

import {
  generateCoachResponse,
  summarizeCoachSignals,
} from "@/features/assistant/coach-response";
import { getCoachContextData } from "@/features/assistant/queries";
import { getSession } from "@/lib/auth";

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
    const result = generateCoachResponse({
      message: parsed.data.message,
      context,
    });

    return NextResponse.json({
      reply: result.reply,
      summary: summarizeCoachSignals({ context }),
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
