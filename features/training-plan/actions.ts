"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";
import { ensureTrainingPlans } from "@/features/training-plan/service";

export async function regenerateTrainingPlanAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const ok = await getSession();
  if (!ok) {
    return { error: "Du är inte inloggad." };
  }
  const raw = formData.get("feedback");
  const feedback =
    typeof raw === "string" && raw.trim().length > 0 ? raw.trim().slice(0, 280) : null;
  const result = await ensureTrainingPlans({ force: true, feedback });
  if (!result) {
    return { error: "Kunde inte räkna om rekommendationen just nu." };
  }
  revalidatePath("/overview");
  revalidatePath("/coach");
  return {};
}
