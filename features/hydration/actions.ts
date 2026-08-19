"use server";

import { revalidatePath } from "next/cache";

import { fromDatetimeLocal } from "@/lib/analytics/dates";
import sql from "@/lib/db";
import { getSession } from "@/lib/auth";
import { volumeToMl } from "@/lib/units/convert";
import { hydrationEntrySchema, idSchema } from "@/lib/validation/logging";

export type HydrationActionState = { error?: string; ok?: boolean };

function formValues(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)]),
  );
}

async function requireSession(): Promise<void> {
  const ok = await getSession();
  if (!ok) throw new Error("Du är inte inloggad.");
}

export async function createHydrationEntryAction(
  _prev: HydrationActionState,
  formData: FormData,
): Promise<HydrationActionState> {
  const parsed = hydrationEntrySchema.safeParse(formValues(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Kunde inte spara vätska.",
    };
  }
  try {
    await requireSession();
    await sql`
      INSERT INTO hydration_entries (consumed_at, volume_ml, beverage_type, caffeine_mg, notes)
      VALUES (
        ${fromDatetimeLocal(parsed.data.consumedAtLocal, parsed.data.timeZone)},
        ${volumeToMl(parsed.data.volume, parsed.data.volumeUnit)},
        ${parsed.data.beverageType},
        ${parsed.data.caffeineMg},
        ${parsed.data.notes || null}
      )
    `;
    revalidatePath("/nutrition");
    revalidatePath("/overview");
    return { ok: true };
  } catch {
    return { error: "Kunde inte spara vätska." };
  }
}

export async function deleteHydrationEntryAction(
  formData: FormData,
): Promise<HydrationActionState> {
  const parsed = idSchema.safeParse(formData.get("id"));
  if (!parsed.success) {
    return { error: "Kunde inte ta bort." };
  }
  try {
    await requireSession();
    await sql`DELETE FROM hydration_entries WHERE id = ${parsed.data}`;
    revalidatePath("/nutrition");
    revalidatePath("/overview");
    return {};
  } catch {
    return { error: "Kunde inte ta bort." };
  }
}
