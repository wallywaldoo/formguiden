import { NextResponse } from "next/server";

import { withAssistantAuth, withCors } from "@/lib/api/assistant-auth";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://chatgpt.com",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export async function POST(request: Request) {
  return withAssistantAuth(request, async () => {
    let body: { question?: string } = {};
    try {
      body = await request.json();
    } catch {
      return withCors(
        NextResponse.json({ error: "Ogiltig JSON." }, { status: 400 }),
      );
    }

    const question = body.question?.trim();
    if (!question) {
      return withCors(
        NextResponse.json(
          { error: "Fältet 'question' saknas." },
          { status: 400 },
        ),
      );
    }

    // TODO: replace with actual AI response using DB data
    const contextSummary = {
      recentActivities: [
        { title: "Morgonlöpning", distanceM: 12500, avgHeartRateBpm: 148 },
        { title: "Långpass", distanceM: 15000, avgHeartRateBpm: 152 },
        { title: "Intervaller 4x2km", distanceM: 8000, avgHeartRateBpm: 160 },
      ],
      healthTrend: {
        avgHrvLast7Days: 65,
        avgRestingHrLast7Days: 53,
        avgSleepHoursLast7Days: 7.2,
        trainingLoad: "moderate",
      },
      currentGoal: {
        raceType: "Halvmarathon",
        raceDate: "2026-10-04",
        targetPace: "5:00/km",
      },
    };

    return withCors(
      NextResponse.json({
        question,
        context: contextSummary,
        note: "Använd kontextdatan ovan för att svara på frågan i din GPT-instruktion.",
      }),
    );
  });
}
