"use server";

import { revalidatePath } from "next/cache";

import { ensureFreshRecommendation } from "@/features/recommendations/service";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { graphqlRequest } from "@/lib/graphql/client";
import { GET_PROFILE_SETTINGS } from "@/lib/graphql/queries/profile";

export async function refreshRecommendationAction(): Promise<void> {
  let timezone = DEFAULT_TIMEZONE;
  try {
    const profile = await graphqlRequest<{
      user_preferences: Array<{ timezone: string }>;
    }>(GET_PROFILE_SETTINGS);
    timezone = profile.user_preferences[0]?.timezone || DEFAULT_TIMEZONE;
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
