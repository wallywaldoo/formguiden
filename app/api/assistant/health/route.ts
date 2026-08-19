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
    const days = Math.min(parseInt(searchParams.get("days") ?? "7", 10), 30);

    const rows = await sql`
      SELECT
        local_date::text                                   AS date,
        resting_heart_rate_bpm::float                      AS "restingHeartRateBpm",
        hrv_rmssd_ms::float                                AS "hrvRmssdMs",
        sleep_duration_s::int                              AS "sleepDurationS",
        stress_avg::float                                  AS "stressAvg",
        body_battery_high::float                           AS "bodyBatteryHigh",
        steps::int                                         AS steps
      FROM daily_health_metrics
      ORDER BY local_date DESC
      LIMIT ${days}
    `;

    return withCors(NextResponse.json({ days: rows }));
  });
}
