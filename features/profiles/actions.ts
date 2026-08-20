"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildGoalPayload,
  goalSnapshotFields,
} from "@/features/goals/map-goal";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
import {
  DEFAULT_LOCALE,
  type RaceType,
} from "@/lib/constants";
import { goalInputSchema, onboardingSchema, profileSchema } from "@/lib/validation/profile";

type ActionResult = { error?: string };

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

async function requireSession(): Promise<void> {
  const ok = await getSession();
  if (!ok) throw new Error("Du är inte inloggad.");
}

async function ensureProfileRow() {
  const profiles = await sql`SELECT id FROM profiles LIMIT 1`;
  if (profiles[0]) {
    return profiles[0].id as string;
  }

  const inserted = await sql`
    INSERT INTO profiles (display_name)
    VALUES (NULL)
    RETURNING id
  `;
  return inserted[0]!.id as string;
}

async function ensurePreferencesRow() {
  const prefs = await sql`SELECT id FROM user_preferences LIMIT 1`;
  if (prefs[0]) {
    return prefs[0].id as string;
  }

  const inserted = await sql`
    INSERT INTO user_preferences DEFAULT VALUES
    RETURNING id
  `;
  return inserted[0]!.id as string;
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

  try {
    await requireSession();
  } catch {
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
  const goalSnapshot = goalSnapshotFields(goal);

  if (goal.race_distance_m <= 0) {
    return { error: "Ange en giltig loppdistans." };
  }

  try {
    const profiles = await sql`SELECT id FROM profiles LIMIT 1`;
    const profile = profiles[0];

    if (profile) {
      await sql`
        UPDATE profiles SET display_name = ${parsed.data.displayName || null}
        WHERE id = ${profile.id}
      `;
    } else {
      await sql`
        INSERT INTO profiles (display_name, onboarding_completed_at)
        VALUES (${parsed.data.displayName || null}, NULL)
      `;
    }

    const prefs = await sql`SELECT id FROM user_preferences LIMIT 1`;
    const pref = prefs[0];
    if (pref) {
      await sql`
        UPDATE user_preferences SET
          timezone = ${parsed.data.timezone},
          distance_unit = ${parsed.data.distanceUnit},
          mass_unit = ${parsed.data.massUnit},
          elevation_unit = ${parsed.data.elevationUnit},
          volume_unit = ${parsed.data.volumeUnit},
          temperature_unit = ${parsed.data.temperatureUnit}
        WHERE id = ${pref.id}
      `;
    } else {
      await sql`
        INSERT INTO user_preferences
          (timezone, locale, week_starts_on, distance_unit, mass_unit, elevation_unit, volume_unit, temperature_unit)
        VALUES
          (${parsed.data.timezone}, ${DEFAULT_LOCALE}, 1, ${parsed.data.distanceUnit},
           ${parsed.data.massUnit}, ${parsed.data.elevationUnit}, ${parsed.data.volumeUnit},
           ${parsed.data.temperatureUnit})
      `;
    }

    const goals = await sql`SELECT id FROM goals WHERE status = 'active' LIMIT 1`;
    const existingGoal = goals[0];
    if (existingGoal) {
      await sql`
        UPDATE goals SET
          race_type = ${goal.race_type},
          race_distance_m = ${goal.race_distance_m},
          race_date = ${goal.race_date},
          target_duration_s = ${goal.target_duration_s},
          target_pace_s_per_km = ${goal.target_pace_s_per_km},
          target_mass_kg = ${goal.target_mass_kg},
          weekly_run_distance_m = ${goal.weekly_run_distance_m},
          weekly_run_duration_s = ${goal.weekly_run_duration_s},
          weekly_strength_sessions = ${goal.weekly_strength_sessions},
          weekly_strength_duration_s = ${goal.weekly_strength_duration_s},
          notes = ${goal.notes}
        WHERE id = ${existingGoal.id}
      `;
      await sql`
        INSERT INTO goal_snapshots
          (goal_id, source, race_type, race_distance_m, race_date, target_duration_s,
           target_pace_s_per_km, target_mass_kg, weekly_run_distance_m, weekly_run_duration_s,
           weekly_strength_sessions, weekly_strength_duration_s)
        VALUES
          (${existingGoal.id}, 'user_edit', ${goalSnapshot.race_type}, ${goalSnapshot.race_distance_m},
           ${goalSnapshot.race_date}, ${goalSnapshot.target_duration_s}, ${goalSnapshot.target_pace_s_per_km},
           ${goalSnapshot.target_mass_kg}, ${goalSnapshot.weekly_run_distance_m}, ${goalSnapshot.weekly_run_duration_s},
           ${goalSnapshot.weekly_strength_sessions}, ${goalSnapshot.weekly_strength_duration_s})
      `;
    } else {
      const inserted = await sql`
        INSERT INTO goals
          (status, race_type, race_distance_m, race_date, target_duration_s, target_pace_s_per_km,
           target_mass_kg, weekly_run_distance_m, weekly_run_duration_s, weekly_strength_sessions,
           weekly_strength_duration_s, notes)
        VALUES
          ('active', ${goal.race_type}, ${goal.race_distance_m}, ${goal.race_date},
           ${goal.target_duration_s}, ${goal.target_pace_s_per_km}, ${goal.target_mass_kg},
           ${goal.weekly_run_distance_m}, ${goal.weekly_run_duration_s}, ${goal.weekly_strength_sessions},
           ${goal.weekly_strength_duration_s}, ${goal.notes})
        RETURNING id
      `;
      const goalId = inserted[0]!.id;
      await sql`
        INSERT INTO goal_snapshots
          (goal_id, source, race_type, race_distance_m, race_date, target_duration_s,
           target_pace_s_per_km, target_mass_kg, weekly_run_distance_m, weekly_run_duration_s,
           weekly_strength_sessions, weekly_strength_duration_s)
        VALUES
          (${goalId}, 'user_edit', ${goalSnapshot.race_type}, ${goalSnapshot.race_distance_m},
           ${goalSnapshot.race_date}, ${goalSnapshot.target_duration_s}, ${goalSnapshot.target_pace_s_per_km},
           ${goalSnapshot.target_mass_kg}, ${goalSnapshot.weekly_run_distance_m}, ${goalSnapshot.weekly_run_duration_s},
           ${goalSnapshot.weekly_strength_sessions}, ${goalSnapshot.weekly_strength_duration_s})
      `;
    }

    // Ensure garmin-file integration exists (ignore unique conflict)
    await sql`
      INSERT INTO integrations (provider, status)
      VALUES ('garmin-file', 'active')
      ON CONFLICT (provider) DO NOTHING
    `;

    // Mark onboarding complete
    await sql`
      UPDATE profiles SET onboarding_completed_at = now()
      WHERE onboarding_completed_at IS NULL
    `;
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
  try {
    await requireSession();
  } catch {
    return { error: "Du är inte inloggad." };
  }

  try {
    const parsed = profileSchema.safeParse({
      displayName: formString(formData, "displayName"),
      dateOfBirth: formString(formData, "dateOfBirth"),
      sexAtBirth: formString(formData, "sexAtBirth"),
      heightCm: formString(formData, "heightCm"),
    });
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message ?? "Ogiltiga profiluppgifter.",
      };
    }

    const prefsId = await ensurePreferencesRow();
    await ensureProfileRow();

    await sql`
      UPDATE profiles SET
        display_name = ${parsed.data.displayName || null},
        date_of_birth = ${parsed.data.dateOfBirth || null},
        sex_at_birth = ${parsed.data.sexAtBirth || null},
        height_cm = ${parsed.data.heightCm}
      WHERE id = (SELECT id FROM profiles LIMIT 1)
    `;
    await sql`
      UPDATE user_preferences SET
        timezone = ${formString(formData, "timezone")},
        distance_unit = ${formString(formData, "distanceUnit")},
        mass_unit = ${formString(formData, "massUnit")},
        elevation_unit = ${formString(formData, "elevationUnit")},
        volume_unit = ${formString(formData, "volumeUnit")},
        temperature_unit = ${formString(formData, "temperatureUnit")}
      WHERE id = ${prefsId}
    `;
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
  const goalSnapshot = goalSnapshotFields(goal);

  try {
    await requireSession();
  } catch {
    return { error: "Du är inte inloggad." };
  }

  try {
    const goals = await sql`SELECT id FROM goals WHERE status = 'active' LIMIT 1`;
    const current = goals[0];
    if (!current) {
      const inserted = await sql`
        INSERT INTO goals
          (status, race_type, race_distance_m, race_date, target_duration_s, target_pace_s_per_km,
           target_mass_kg, weekly_run_distance_m, weekly_run_duration_s, weekly_strength_sessions,
           weekly_strength_duration_s, notes)
        VALUES
          ('active', ${goal.race_type}, ${goal.race_distance_m}, ${goal.race_date},
           ${goal.target_duration_s}, ${goal.target_pace_s_per_km}, ${goal.target_mass_kg},
           ${goal.weekly_run_distance_m}, ${goal.weekly_run_duration_s}, ${goal.weekly_strength_sessions},
           ${goal.weekly_strength_duration_s}, ${goal.notes})
        RETURNING id
      `;
      const goalId = inserted[0]!.id;
      await sql`
        INSERT INTO goal_snapshots
          (goal_id, source, race_type, race_distance_m, race_date, target_duration_s,
           target_pace_s_per_km, target_mass_kg, weekly_run_distance_m, weekly_run_duration_s,
           weekly_strength_sessions, weekly_strength_duration_s)
        VALUES
          (${goalId}, 'user_edit', ${goalSnapshot.race_type}, ${goalSnapshot.race_distance_m},
           ${goalSnapshot.race_date}, ${goalSnapshot.target_duration_s}, ${goalSnapshot.target_pace_s_per_km},
           ${goalSnapshot.target_mass_kg}, ${goalSnapshot.weekly_run_distance_m}, ${goalSnapshot.weekly_run_duration_s},
           ${goalSnapshot.weekly_strength_sessions}, ${goalSnapshot.weekly_strength_duration_s})
      `;
    } else {
      await sql`
        UPDATE goals SET
          race_type = ${goal.race_type},
          race_distance_m = ${goal.race_distance_m},
          race_date = ${goal.race_date},
          target_duration_s = ${goal.target_duration_s},
          target_pace_s_per_km = ${goal.target_pace_s_per_km},
          target_mass_kg = ${goal.target_mass_kg},
          weekly_run_distance_m = ${goal.weekly_run_distance_m},
          weekly_run_duration_s = ${goal.weekly_run_duration_s},
          weekly_strength_sessions = ${goal.weekly_strength_sessions},
          weekly_strength_duration_s = ${goal.weekly_strength_duration_s},
          notes = ${goal.notes}
        WHERE id = ${current.id}
      `;
      await sql`
        INSERT INTO goal_snapshots
          (goal_id, source, race_type, race_distance_m, race_date, target_duration_s,
           target_pace_s_per_km, target_mass_kg, weekly_run_distance_m, weekly_run_duration_s,
           weekly_strength_sessions, weekly_strength_duration_s)
        VALUES
          (${current.id}, 'user_edit', ${goalSnapshot.race_type}, ${goalSnapshot.race_distance_m},
           ${goalSnapshot.race_date}, ${goalSnapshot.target_duration_s}, ${goalSnapshot.target_pace_s_per_km},
           ${goalSnapshot.target_mass_kg}, ${goalSnapshot.weekly_run_distance_m}, ${goalSnapshot.weekly_run_duration_s},
           ${goalSnapshot.weekly_strength_sessions}, ${goalSnapshot.weekly_strength_duration_s})
      `;
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
