import { NextResponse } from "next/server";

import { withAssistantAuth, withCors } from "@/lib/api/assistant-auth";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "https://chatgpt.com",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    },
  });
}

export async function GET(request: Request) {
  return withAssistantAuth(request, async () => {
    // TODO: replace with DB query
    const profile = {
      name: "Viktor",
      currentGoal: {
        raceType: "Halvmarathon",
        raceDate: "2026-10-04",
        targetPace: "5:00/km",
      },
      weeklyRunDistanceM: 50000,
    };

    return withCors(NextResponse.json(profile));
  });
}
