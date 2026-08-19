"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSession, destroySession } from "@/lib/auth";

export type PrivacyActionResult = {
  error?: string;
  success?: string;
};

export async function requestAccountDeletionAction(
  _prev: PrivacyActionResult,
  _formData: FormData,
): Promise<PrivacyActionResult> {
  const ok = await getSession();
  if (!ok) {
    return { error: "Du är inte inloggad." };
  }

  // Single-user: account deletion is handled by clearing the session and
  // displaying instructions to the operator to delete the database.
  await destroySession();
  redirect("/login?deleted=pending");
}

export async function cancelAccountDeletionAction(
  _prev: PrivacyActionResult,
  _formData: FormData,
): Promise<PrivacyActionResult> {
  revalidatePath("/account/deletion-pending");
  revalidatePath("/overview");
  return { success: "Raderingen avbröts. Ditt konto är aktivt igen." };
}
