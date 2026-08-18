"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { buildGoalPayload } from "@/features/goals/map-goal";
import { graphqlRequest } from "@/lib/graphql/client";
import {
  COMPLETE_ONBOARDING,
  INSERT_AUDIT_EVENT,
  INSERT_FILE_INTEGRATION,
  INSERT_GOAL,
  INSERT_GOAL_SNAPSHOT,
  INSERT_PREFERENCES,
  INSERT_PRIVACY_ACKNOWLEDGEMENT,
  INSERT_PROFILE,
  UPDATE_GOAL,
  UPDATE_PREFERENCES,
  UPDATE_PROFILE,
} from "@/lib/graphql/mutations/profile";
import { GET_PROFILE_SETTINGS } from "@/lib/graphql/queries/profile";
import { createNhostClient } from "@/lib/nhost/server";
import {
  DEFAULT_LOCALE,
  PRIVACY_DOCUMENT_VERSION,
  type RaceType,
} from "@/lib/constants";
import { goalInputSchema, onboardingSchema } from "@/lib/validation/profile";

type ActionResult = { error?: string };

type ProfileSettingsData = {
  profiles: Array<{
    user_id: string;
    display_name: string | null;
    onboarding_completed_at: string | null;
  }>;
  user_preferences: Array<{ id: string }>;
  goals: Array<{ id: string }>;
};

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function isUniqueViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("uniqueness") ||
    message.includes("duplicate key") ||
    message.includes("unique constraint")
  );
}

export async function completeOnboardingAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = onboardingSchema.safeParse({
    privacyAccepted: formData.get("privacyAccepted") === "on",
    displayName: formString(formData, "displayName"),
    timezone: formString(formData, "timezone"),
    distanceUnit: formString(formData, "distanceUnit") || "km",
    massUnit: formString(formData, "massUnit") || "kg",
    elevationUnit: formString(formData, "elevationUnit") || "m",
    volumeUnit: formString(formData, "volumeUnit") || "ml",
    temperatureUnit: formString(formData, "temperatureUnit") || "c",
    raceType: formString(formData, "raceType") || "half_marathon",
    customDistanceKm: formString(formData, "customDistanceKm"),
    raceDate: formString(formData, "raceDate"),
    targetDuration: formString(formData, "targetDuration"),
    targetMassKg: formString(formData, "targetMassKg"),
    weeklyRunDistanceKm: formString(formData, "weeklyRunDistanceKm"),
    weeklyRunDuration: formString(formData, "weeklyRunDuration"),
    weeklyStrengthSessions: formString(formData, "weeklyStrengthSessions"),
    weeklyStrengthDuration: formString(formData, "weeklyStrengthDuration"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter." };
  }

  const nhost = await createNhostClient();
  const userId = nhost.getUserSession()?.user?.id;
  if (!userId) {
    return { error: "Du är inte inloggad." };
  }

  const goal = buildGoalPayload({
    raceType: parsed.data.raceType,
    customDistanceKm: parsed.data.customDistanceKm,
    raceDate: parsed.data.raceDate,
    targetDuration: parsed.data.targetDuration,
    targetMassKg: parsed.data.targetMassKg,
    weeklyRunDistanceKm: parsed.data.weeklyRunDistanceKm,
    weeklyRunDuration: parsed.data.weeklyRunDuration,
    weeklyStrengthSessions: parsed.data.weeklyStrengthSessions,
    weeklyStrengthDuration: parsed.data.weeklyStrengthDuration,
  });
  const { notes: _onboardingNotes, ...goalSnapshot } = goal;

  if (goal.race_distance_m <= 0) {
    return { error: "Ange en giltig loppdistans." };
  }

  try {
    try {
      await graphqlRequest(INSERT_PRIVACY_ACKNOWLEDGEMENT, {
        document_version: PRIVACY_DOCUMENT_VERSION,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }

    const existing =
      await graphqlRequest<ProfileSettingsData>(GET_PROFILE_SETTINGS);
    const profile = existing.profiles[0];
    const preferences = existing.user_preferences[0];
    const existingGoal = existing.goals[0];

    if (profile) {
      await graphqlRequest(UPDATE_PROFILE, {
        user_id: userId,
        display_name: parsed.data.displayName || null,
      });
    } else {
      await graphqlRequest(INSERT_PROFILE, {
        display_name: parsed.data.displayName || null,
      });
    }

    if (preferences) {
      await graphqlRequest(UPDATE_PREFERENCES, {
        id: preferences.id,
        timezone: parsed.data.timezone,
        distance_unit: parsed.data.distanceUnit,
        mass_unit: parsed.data.massUnit,
        elevation_unit: parsed.data.elevationUnit,
        volume_unit: parsed.data.volumeUnit,
        temperature_unit: parsed.data.temperatureUnit,
      });
    } else {
      await graphqlRequest(INSERT_PREFERENCES, {
        timezone: parsed.data.timezone,
        locale: DEFAULT_LOCALE,
        distance_unit: parsed.data.distanceUnit,
        mass_unit: parsed.data.massUnit,
        elevation_unit: parsed.data.elevationUnit,
        volume_unit: parsed.data.volumeUnit,
        temperature_unit: parsed.data.temperatureUnit,
      });
    }

    if (existingGoal) {
      await graphqlRequest(UPDATE_GOAL, { id: existingGoal.id, ...goal });
      await graphqlRequest(INSERT_GOAL_SNAPSHOT, {
        goal_id: existingGoal.id,
        ...goalSnapshot,
      });
    } else {
      const inserted = await graphqlRequest<{
        insert_goals_one: { id: string };
      }>(INSERT_GOAL, { status: "active", ...goal });
      await graphqlRequest(INSERT_GOAL_SNAPSHOT, {
        goal_id: inserted.insert_goals_one.id,
        ...goalSnapshot,
      });
    }

    try {
      await graphqlRequest(INSERT_FILE_INTEGRATION);
    } catch {
      // Unique (user_id, provider) — already present is fine.
    }

    await graphqlRequest(COMPLETE_ONBOARDING, {
      user_id: userId,
      completed_at: new Date().toISOString(),
    });

    await graphqlRequest(INSERT_AUDIT_EVENT, {
      action: "onboarding.complete",
      entity_type: "profiles",
      entity_id: userId,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte spara onboarding. Försök igen.",
    };
  }

  redirect("/overview");
}

export async function updateProfileSettingsAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const nhost = await createNhostClient();
  const userId = nhost.getUserSession()?.user?.id;
  if (!userId) {
    return { error: "Du är inte inloggad." };
  }

  try {
    const existing =
      await graphqlRequest<ProfileSettingsData>(GET_PROFILE_SETTINGS);
    const preferences = existing.user_preferences[0];
    if (!preferences) {
      return { error: "Inställningar saknas. Gå igenom onboarding igen." };
    }

    await graphqlRequest(UPDATE_PROFILE, {
      user_id: userId,
      display_name: formString(formData, "displayName") || null,
    });
    await graphqlRequest(UPDATE_PREFERENCES, {
      id: preferences.id,
      timezone: formString(formData, "timezone"),
      distance_unit: formString(formData, "distanceUnit"),
      mass_unit: formString(formData, "massUnit"),
      elevation_unit: formString(formData, "elevationUnit"),
      volume_unit: formString(formData, "volumeUnit"),
      temperature_unit: formString(formData, "temperatureUnit"),
    });
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Kunde inte spara profilen.",
    };
  }

  revalidatePath("/settings/profile");
  revalidatePath("/overview");
  return {};
}

export async function updateGoalAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = goalInputSchema.safeParse({
    raceType: formString(formData, "raceType"),
    customDistanceKm: formString(formData, "customDistanceKm"),
    raceDate: formString(formData, "raceDate"),
    targetDuration: formString(formData, "targetDuration"),
    targetMassKg: formString(formData, "targetMassKg"),
    weeklyRunDistanceKm: formString(formData, "weeklyRunDistanceKm"),
    weeklyRunDuration: formString(formData, "weeklyRunDuration"),
    weeklyStrengthSessions: formString(formData, "weeklyStrengthSessions"),
    weeklyStrengthDuration: formString(formData, "weeklyStrengthDuration"),
    notes: formString(formData, "notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ogiltiga mål." };
  }

  const goal = buildGoalPayload({
    raceType: parsed.data.raceType as RaceType,
    customDistanceKm: parsed.data.customDistanceKm,
    raceDate: parsed.data.raceDate,
    targetDuration: parsed.data.targetDuration,
    targetMassKg: parsed.data.targetMassKg,
    weeklyRunDistanceKm: parsed.data.weeklyRunDistanceKm,
    weeklyRunDuration: parsed.data.weeklyRunDuration,
    weeklyStrengthSessions: parsed.data.weeklyStrengthSessions,
    weeklyStrengthDuration: parsed.data.weeklyStrengthDuration,
    notes: parsed.data.notes,
  });
  const { notes: _notes, ...goalSnapshot } = goal;

  try {
    const existing =
      await graphqlRequest<ProfileSettingsData>(GET_PROFILE_SETTINGS);
    const current = existing.goals[0];
    if (!current) {
      const inserted = await graphqlRequest<{
        insert_goals_one: { id: string };
      }>(INSERT_GOAL, { status: "active", ...goal });
      await graphqlRequest(INSERT_GOAL_SNAPSHOT, {
        goal_id: inserted.insert_goals_one.id,
        ...goalSnapshot,
      });
    } else {
      await graphqlRequest(UPDATE_GOAL, { id: current.id, ...goal });
      await graphqlRequest(INSERT_GOAL_SNAPSHOT, {
        goal_id: current.id,
        ...goalSnapshot,
      });
    }
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Kunde inte spara målen.",
    };
  }

  revalidatePath("/goals");
  revalidatePath("/overview");
  return {};
}
