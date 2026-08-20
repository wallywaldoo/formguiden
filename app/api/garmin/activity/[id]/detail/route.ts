import { NextResponse } from "next/server";

import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
import { hydrateGarminActivityDetail } from "@/lib/garmin/detail";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authenticated = await getSession();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const activityRows = await sql`
    SELECT id, external_id, source
    FROM activities
    WHERE id = ${id}
    LIMIT 1
  `;
  const activity = activityRows[0] as
    | { id: string; external_id: string | null; source: string }
    | undefined;

  if (!activity) {
    return NextResponse.json({ error: "Aktiviteten hittades inte." }, { status: 404 });
  }
  if (activity.source !== "garmin-api" || !activity.external_id) {
    return NextResponse.json(
      { error: "Detaljhämtning stöds just nu bara för Garmin-syncade pass." },
      { status: 400 },
    );
  }

  try {
    const result = await hydrateGarminActivityDetail({
      activityId: activity.id,
      externalId: activity.external_id,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error:
            result.reason === "missing_detail"
              ? "Garmin hade ingen detaljdata att hämta för det här passet."
              : "FIT-filen innehöll ingen läsbar aktivitet.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      ok: true,
      laps: result.laps,
      trackpoints: result.trackpoints,
      samples: result.samples,
      warnings: result.warnings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
