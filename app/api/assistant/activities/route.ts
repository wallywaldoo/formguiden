import { NextResponse } from "next/server";

import { withAssistantAuth, withCors } from "@/lib/api/assistant-auth";
import sql from "@/lib/db";

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

    const [rows, countRows] = await Promise.all([
      sql`
        SELECT
          id::text,
          started_at                   AS "startedAt",
          activity_type                AS sport,
          duration_s::int              AS "durationS",
          distance_m::float            AS "distanceM",
          avg_heart_rate_bpm::float    AS "avgHeartRateBpm",
          elevation_gain_m::float      AS "elevationGainM",
          notes                        AS title
        FROM activities
        ORDER BY started_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`SELECT COUNT(*)::int AS total FROM activities`,
    ]);

    const total = (countRows[0] as { total: number })?.total ?? 0;

    return withCors(NextResponse.json({ activities: rows, total }));
  });
}
