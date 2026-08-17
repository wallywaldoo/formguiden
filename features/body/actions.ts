"use server";

import { revalidatePath } from "next/cache";

import { fromDatetimeLocal } from "@/lib/analytics/dates";
import { graphqlRequest } from "@/lib/graphql/client";
import {
  DELETE_BODY_MEASUREMENT,
  INSERT_MANUAL_BODY_MEASUREMENT,
} from "@/lib/graphql/mutations/logging";
import { createNhostClient } from "@/lib/nhost/server";
import { massToKg } from "@/lib/units/convert";
import { idSchema, weightEntrySchema } from "@/lib/validation/logging";

export type BodyActionState = { error?: string; ok?: boolean };

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
    await requireUserId();
    await graphqlRequest(INSERT_MANUAL_BODY_MEASUREMENT, {
      measured_at: fromDatetimeLocal(
        parsed.data.measuredAtLocal,
        parsed.data.timeZone,
      ),
      mass_kg: massToKg(parsed.data.mass, parsed.data.massUnit),
      body_fat_pct: parsed.data.bodyFatPct,
      notes: parsed.data.notes || null,
    });
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
    await requireUserId();
    await graphqlRequest(DELETE_BODY_MEASUREMENT, { id: parsed.data });
    revalidatePath("/body");
    revalidatePath("/overview");
    return {};
  } catch {
    return { error: "Kunde inte ta bort." };
  }
}
