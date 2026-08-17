"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fromDatetimeLocal } from "@/lib/analytics/dates";
import { graphqlRequest } from "@/lib/graphql/client";
import {
  DELETE_STRENGTH_SESSION,
  DELETE_STRENGTH_SET,
  INSERT_STRENGTH_SESSION,
  INSERT_STRENGTH_SET,
  UPDATE_STRENGTH_SESSION,
} from "@/lib/graphql/mutations/logging";
import { GET_STRENGTH_SESSION } from "@/lib/graphql/queries/logging";
import { createNhostClient } from "@/lib/nhost/server";
import { massToKg } from "@/lib/units/convert";
import {
  idSchema,
  strengthSessionSchema,
  strengthSetSchema,
} from "@/lib/validation/logging";

export type StrengthActionState = { error?: string; ok?: boolean };

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

async function requireUserId() {
  const nhost = await createNhostClient();
  if (!nhost.getUserSession()?.user?.id) {
    throw new Error("Du är inte inloggad.");
  }
}

export async function createStrengthSessionAction(
  _prev: StrengthActionState,
  formData: FormData,
): Promise<StrengthActionState> {
  const parsed = strengthSessionSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Kunde inte spara passet.",
    };
  }
  let sessionId: string | undefined;
  try {
    await requireUserId();
    const created = await graphqlRequest<{
      insert_strength_sessions_one: { id: string };
    }>(INSERT_STRENGTH_SESSION, {
      started_at: fromDatetimeLocal(
        parsed.data.startedAtLocal,
        parsed.data.timeZone,
      ),
      duration_s:
        parsed.data.durationMinutes != null
          ? parsed.data.durationMinutes * 60
          : null,
      perceived_effort: parsed.data.perceivedEffort,
      notes: parsed.data.notes || null,
    });
    sessionId = created.insert_strength_sessions_one.id;
  } catch {
    return { error: "Kunde inte spara passet." };
  }
  revalidatePath("/strength");
  revalidatePath("/overview");
  if (!sessionId) {
    return { error: "Kunde inte spara passet." };
  }
  redirect(`/strength/${sessionId}`);
}

export async function updateStrengthSessionAction(
  _prev: StrengthActionState,
  formData: FormData,
): Promise<StrengthActionState> {
  const id = idSchema.safeParse(formData.get("id"));
  const parsed = strengthSessionSchema.safeParse(formValues(formData));
  if (!id.success || !parsed.success) {
    return {
      error: parsed.success
        ? "Kunde inte spara passet."
        : parsed.error.issues[0]?.message,
    };
  }
  try {
    await requireUserId();
    await graphqlRequest(UPDATE_STRENGTH_SESSION, {
      id: id.data,
      started_at: fromDatetimeLocal(
        parsed.data.startedAtLocal,
        parsed.data.timeZone,
      ),
      duration_s:
        parsed.data.durationMinutes != null
          ? parsed.data.durationMinutes * 60
          : null,
      perceived_effort: parsed.data.perceivedEffort,
      notes: parsed.data.notes || null,
    });
    revalidatePath(`/strength/${id.data}`);
    revalidatePath("/strength");
    return { ok: true };
  } catch {
    return { error: "Kunde inte spara passet." };
  }
}

export async function deleteStrengthSessionAction(
  formData: FormData,
): Promise<StrengthActionState> {
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) {
    return { error: "Kunde inte ta bort passet." };
  }
  try {
    await requireUserId();
    await graphqlRequest(DELETE_STRENGTH_SESSION, { id: parsed.data });
  } catch {
    return { error: "Kunde inte ta bort passet." };
  }
  revalidatePath("/strength");
  revalidatePath("/overview");
  redirect("/strength");
}

export async function addStrengthSetAction(
  _prev: StrengthActionState,
  formData: FormData,
): Promise<StrengthActionState> {
  const parsed = strengthSetSchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Kunde inte spara setet.",
    };
  }
  try {
    await requireUserId();
    const existing = await graphqlRequest<{
      strength_sets: Array<{ set_index: number }>;
    }>(GET_STRENGTH_SESSION, { id: parsed.data.sessionId });
    const nextIndex =
      existing.strength_sets.reduce(
        (max, set) => Math.max(max, set.set_index),
        0,
      ) + 1;
    await graphqlRequest(INSERT_STRENGTH_SET, {
      session_id: parsed.data.sessionId,
      set_index: nextIndex,
      exercise_name: parsed.data.exerciseName,
      repetitions: parsed.data.repetitions,
      mass_kg:
        parsed.data.mass != null
          ? massToKg(parsed.data.mass, parsed.data.massUnit)
          : null,
      rpe: parsed.data.rpe,
      notes: parsed.data.notes || null,
    });
    revalidatePath(`/strength/${parsed.data.sessionId}`);
    revalidatePath("/strength");
    return { ok: true };
  } catch {
    return { error: "Kunde inte spara setet." };
  }
}

export async function deleteStrengthSetAction(
  formData: FormData,
): Promise<StrengthActionState> {
  const parsed = idSchema.safeParse(formData.get("id"));
  const sessionId = idSchema.safeParse(formData.get("sessionId"));
  if (!parsed.success || !sessionId.success) {
    return { error: "Kunde inte ta bort setet." };
  }
  try {
    await requireUserId();
    await graphqlRequest(DELETE_STRENGTH_SET, { id: parsed.data });
    revalidatePath(`/strength/${sessionId.data}`);
    revalidatePath("/strength");
    return {};
  } catch {
    return { error: "Kunde inte ta bort setet." };
  }
}
