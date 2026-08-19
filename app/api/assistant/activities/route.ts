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
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    // TODO: replace with DB query
    const allActivities = [
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
      {
        id: "act-004",
        startedAt: "2026-08-13T07:00:00Z",
        sport: "running",
        durationS: 3300,
        distanceM: 10500,
        avgHeartRateBpm: 145,
        elevationGainM: 80,
        title: "Lätt löpning",
      },
      {
        id: "act-005",
        startedAt: "2026-08-11T06:45:00Z",
        sport: "running",
        durationS: 5400,
        distanceM: 18000,
        avgHeartRateBpm: 150,
        elevationGainM: 175,
        title: "Söndagslångpass",
      },
    ];

    const paged = allActivities.slice(offset, offset + limit);

    return withCors(
      NextResponse.json({ activities: paged, total: allActivities.length }),
    );
  });
}
