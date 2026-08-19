"use server";

import { revalidatePath } from "next/cache";

import { fromDatetimeLocal } from "@/lib/analytics/dates";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
import { massToKg } from "@/lib/units/convert";
import { idSchema, weightEntrySchema } from "@/lib/validation/logging";

export type BodyActionState = { error?: string; ok?: boolean };

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

async function requireSession(): Promise<void> {
  const ok = await getSession();
  if (!ok) throw new Error("Du är inte inloggad.");
}

export async function createWeightEntryAction(
  _prev: BodyActionState,
  formData: FormData,
): Promise<BodyActionState> {
  const parsed = weightEntrySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Kunde inte spara vikten.",
    };
  }
  try {
    await requireSession();
    await sql`
      INSERT INTO body_measurements (measured_at, source, mass_kg, body_fat_pct, notes)
      VALUES (
        ${fromDatetimeLocal(parsed.data.measuredAtLocal, parsed.data.timeZone)},
        'manual',
        ${massToKg(parsed.data.mass, parsed.data.massUnit)},
        ${parsed.data.bodyFatPct},
        ${parsed.data.notes || null}
      )
    `;
    revalidatePath("/body");
    revalidatePath("/overview");
    return { ok: true };
  } catch {
    return { error: "Kunde inte spara vikten." };
  }
}

export async function deleteWeightEntryAction(
  formData: FormData,
): Promise<BodyActionState> {
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) {
    return { error: "Kunde inte ta bort." };
  }
  try {
    await requireSession();
    await sql`DELETE FROM body_measurements WHERE id = ${parsed.data}`;
    revalidatePath("/body");
    revalidatePath("/overview");
    return {};
  } catch {
    return { error: "Kunde inte ta bort." };
  }
}
