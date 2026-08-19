"use server";

import { revalidatePath } from "next/cache";

import { ensureFreshRecommendation } from "@/features/recommendations/service";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import sql from "@/lib/db";

export async function refreshRecommendationAction(): Promise<void> {
  let timezone = DEFAULT_TIMEZONE;
  try {
    const prefs = await sql`SELECT timezone FROM user_preferences LIMIT 1`;
    timezone = (prefs[0]?.timezone as string) || DEFAULT_TIMEZONE;
  } catch {
    timezone = DEFAULT_TIMEZONE;
  }

  await ensureFreshRecommendation({
    context: {
      timeZone: timezone,
      now: new Date(),
      goal: {
        weeklyRunDistanceM: null,
        targetPaceSPerKm: null,
        targetMassKg: null,
      },
    },
    force: true,
  });

  revalidatePath("/overview");
  revalidatePath("/report");
}
