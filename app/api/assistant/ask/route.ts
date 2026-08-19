import { NextResponse } from "next/server";

import { withAssistantAuth, withCors } from "@/lib/api/assistant-auth";
import sql from "@/lib/db";

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

    const [activityRows, healthRows, goalRows] = await Promise.all([
      sql`
        SELECT notes AS title, distance_m::float AS "distanceM", avg_heart_rate_bpm::float AS "avgHeartRateBpm"
        FROM activities
        ORDER BY started_at DESC
        LIMIT 3
      `,
      sql`
        SELECT
          AVG(hrv_rmssd_ms)::float           AS "avgHrvLast7Days",
          AVG(resting_heart_rate_bpm)::float  AS "avgRestingHrLast7Days",
          AVG(sleep_duration_s / 3600.0)::float AS "avgSleepHoursLast7Days"
        FROM daily_health_metrics
        WHERE local_date >= CURRENT_DATE - INTERVAL '7 days'
      `,
      sql`
        SELECT race_type AS "raceType", race_date AS "raceDate", target_pace_s_per_km AS "targetPaceSPerKm"
        FROM goals
        WHERE status = 'active'
        LIMIT 1
      `,
    ]);

    const health = healthRows[0] as {
      avgHrvLast7Days: number | null;
      avgRestingHrLast7Days: number | null;
      avgSleepHoursLast7Days: number | null;
    } | undefined;

    return withCors(
      NextResponse.json({
        question,
        context: {
          recentActivities: activityRows,
          healthTrend: {
            avgHrvLast7Days: health?.avgHrvLast7Days
              ? Math.round(health.avgHrvLast7Days)
              : null,
            avgRestingHrLast7Days: health?.avgRestingHrLast7Days
              ? Math.round(health.avgRestingHrLast7Days)
              : null,
            avgSleepHoursLast7Days:
              health?.avgSleepHoursLast7Days != null
                ? Math.round(health.avgSleepHoursLast7Days * 10) / 10
                : null,
          },
          currentGoal: goalRows[0] ?? null,
        },
      }),
    );
  });
}
