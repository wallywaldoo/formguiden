"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { fromDatetimeLocal } from "@/lib/analytics/dates";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
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

async function requireSession(): Promise<void> {
  const ok = await getSession();
  if (!ok) throw new Error("Du är inte inloggad.");
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
    await requireSession();
    const created = await sql`
      INSERT INTO strength_sessions (started_at, duration_s, perceived_effort, notes, source)
      VALUES (
        ${fromDatetimeLocal(parsed.data.startedAtLocal, parsed.data.timeZone)},
        ${parsed.data.durationMinutes != null ? parsed.data.durationMinutes * 60 : null},
        ${parsed.data.perceivedEffort},
        ${parsed.data.notes || null},
        'manual'
      )
      RETURNING id
    `;
    sessionId = created[0]!.id;
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
    await requireSession();
    await sql`
      UPDATE strength_sessions SET
        started_at = ${fromDatetimeLocal(parsed.data.startedAtLocal, parsed.data.timeZone)},
        duration_s = ${parsed.data.durationMinutes != null ? parsed.data.durationMinutes * 60 : null},
        perceived_effort = ${parsed.data.perceivedEffort},
        notes = ${parsed.data.notes || null}
      WHERE id = ${id.data}
    `;
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
    await requireSession();
    await sql`DELETE FROM strength_sessions WHERE id = ${parsed.data}`;
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
    await requireSession();
    const rows = await sql`
      SELECT COALESCE(MAX(set_index), 0) AS max_index
      FROM strength_sets
      WHERE session_id = ${parsed.data.sessionId}
    `;
    const nextIndex = (rows[0]!.max_index as number) + 1;
    await sql`
      INSERT INTO strength_sets (session_id, set_index, exercise_name, repetitions, mass_kg, rpe, notes)
      VALUES (
        ${parsed.data.sessionId},
        ${nextIndex},
        ${parsed.data.exerciseName},
        ${parsed.data.repetitions},
        ${parsed.data.mass != null ? massToKg(parsed.data.mass, parsed.data.massUnit) : null},
        ${parsed.data.rpe},
        ${parsed.data.notes || null}
      )
    `;
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
    await requireSession();
    await sql`DELETE FROM strength_sets WHERE id = ${parsed.data}`;
    revalidatePath(`/strength/${sessionId.data}`);
    revalidatePath("/strength");
    return {};
  } catch {
    return { error: "Kunde inte ta bort setet." };
  }
}
