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
    // TODO: replace with DB queries for all sections

    const summary = {
      generatedAt: new Date().toISOString(),
      recentActivities: [
        {
          id: "act-001",
          startedAt: "2026-08-19T06:30:00Z",
          sport: "running",
          durationS: 3780,
          distanceM: 12500,
          avgHeartRateBpm: 148,
          elevationGainM: 95,
          title: "Morgonlöpning",
        },
        {
          id: "act-002",
          startedAt: "2026-08-17T08:00:00Z",
          sport: "running",
          durationS: 4500,
          distanceM: 15000,
          avgHeartRateBpm: 152,
          elevationGainM: 130,
          title: "Långpass",
        },
        {
          id: "act-003",
          startedAt: "2026-08-15T06:15:00Z",
          sport: "running",
          durationS: 2700,
          distanceM: 8000,
          avgHeartRateBpm: 160,
          elevationGainM: 60,
          title: "Intervaller 4x2km",
        },
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
      coachingContext:
        "Viktor tränar inför ett halvmarathon om 6 veckor. HRV-trenden de senaste dagarna visar god återhämtning (snitt 65 ms). De tre senaste löpningarna kördes i lugnt tempo förutom ett intervallpass. Veckovolymen ligger på ca 50 km.",
    };

    return withCors(NextResponse.json(summary));
  });
}
