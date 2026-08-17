"use server";

import { revalidatePath } from "next/cache";

import { fromDatetimeLocal } from "@/lib/analytics/dates";
import { graphqlRequest } from "@/lib/graphql/client";
import {
  DELETE_HYDRATION_ENTRY,
  INSERT_HYDRATION_ENTRY,
} from "@/lib/graphql/mutations/logging";
import { createNhostClient } from "@/lib/nhost/server";
import { volumeToMl } from "@/lib/units/convert";
import { hydrationEntrySchema, idSchema } from "@/lib/validation/logging";

export type HydrationActionState = { error?: string; ok?: boolean };

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
    await requireUserId();
    await graphqlRequest(INSERT_HYDRATION_ENTRY, {
      consumed_at: fromDatetimeLocal(
        parsed.data.consumedAtLocal,
        parsed.data.timeZone,
      ),
      volume_ml: volumeToMl(parsed.data.volume, parsed.data.volumeUnit),
      beverage_type: parsed.data.beverageType,
      caffeine_mg: parsed.data.caffeineMg,
      notes: parsed.data.notes || null,
    });
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
    await requireUserId();
    await graphqlRequest(DELETE_HYDRATION_ENTRY, { id: parsed.data });
    revalidatePath("/nutrition");
    revalidatePath("/overview");
    return {};
  } catch {
    return { error: "Kunde inte ta bort." };
  }
}
