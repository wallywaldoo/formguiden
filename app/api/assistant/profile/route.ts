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
    const [profileRows, goalRows] = await Promise.all([
      sql`SELECT display_name FROM profiles LIMIT 1`,
      sql`
        SELECT
          race_type           AS "raceType",
          race_date           AS "raceDate",
          target_duration_s   AS "targetDurationS",
          target_pace_s_per_km AS "targetPaceSPerKm",
          weekly_run_distance_m AS "weeklyRunDistanceM"
        FROM goals
        WHERE status = 'active'
        LIMIT 1
      `,
    ]);

    const profile = profileRows[0] as { display_name: string } | undefined;
    const goal = goalRows[0] as
      | {
          raceType: string;
          raceDate: string | null;
          targetDurationS: number | null;
          targetPaceSPerKm: number | null;
          weeklyRunDistanceM: number | null;
        }
      | undefined;

    return withCors(
      NextResponse.json({
        name: profile?.display_name ?? null,
        currentGoal: goal ?? null,
      }),
    );
  });
}
