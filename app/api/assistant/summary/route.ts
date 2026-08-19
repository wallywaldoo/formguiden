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
    const [activityRows, healthRows, goalRows, profileRows] = await Promise.all([
      sql`
        SELECT
          id::text,
          started_at               AS "startedAt",
          activity_type            AS sport,
          duration_s::int          AS "durationS",
          distance_m::float        AS "distanceM",
          avg_heart_rate_bpm::float AS "avgHeartRateBpm",
          elevation_gain_m::float  AS "elevationGainM",
          notes                    AS title
        FROM activities
        ORDER BY started_at DESC
        LIMIT 5
      `,
      sql`
        SELECT
          AVG(hrv_rmssd_ms)::float          AS "avgHrvLast7Days",
          AVG(resting_heart_rate_bpm)::float AS "avgRestingHrLast7Days",
          AVG(sleep_duration_s)::float       AS "avgSleepSLast7Days",
          AVG(stress_avg)::float             AS "avgStressLast7Days"
        FROM daily_health_metrics
        WHERE local_date >= CURRENT_DATE - INTERVAL '7 days'
      `,
      sql`
        SELECT
          race_type              AS "raceType",
          race_date              AS "raceDate",
          target_pace_s_per_km   AS "targetPaceSPerKm",
          weekly_run_distance_m  AS "weeklyRunDistanceM"
        FROM goals
        WHERE status = 'active'
        LIMIT 1
      `,
      sql`SELECT display_name FROM profiles LIMIT 1`,
    ]);

    const health = healthRows[0] as {
      avgHrvLast7Days: number | null;
      avgRestingHrLast7Days: number | null;
      avgSleepSLast7Days: number | null;
      avgStressLast7Days: number | null;
    } | undefined;

    const goal = goalRows[0] as {
      raceType: string;
      raceDate: string | null;
      targetPaceSPerKm: number | null;
      weeklyRunDistanceM: number | null;
    } | undefined;

    const profile = profileRows[0] as { display_name: string } | undefined;

    const avgSleepH =
      health?.avgSleepSLast7Days != null
        ? Math.round((health.avgSleepSLast7Days / 3600) * 10) / 10
        : null;

    return withCors(
      NextResponse.json({
        generatedAt: new Date().toISOString(),
        recentActivities: activityRows,
        healthTrend: {
          avgHrvLast7Days: health?.avgHrvLast7Days
            ? Math.round(health.avgHrvLast7Days)
            : null,
          avgRestingHrLast7Days: health?.avgRestingHrLast7Days
            ? Math.round(health.avgRestingHrLast7Days)
            : null,
          avgSleepHoursLast7Days: avgSleepH,
          avgStressLast7Days: health?.avgStressLast7Days
            ? Math.round(health.avgStressLast7Days)
            : null,
        },
        currentGoal: goal ?? null,
        name: profile?.display_name ?? null,
      }),
    );
  });
}
