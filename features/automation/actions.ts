"use server";

import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth";

export type AutomationActionResult = {
  error?: string;
  token?: string;
  expiresAt?: string;
};

export async function createAutomationTokenAction(
  _prev: AutomationActionResult,
  _formData: FormData,
): Promise<AutomationActionResult> {
  const ok = await getSession();
  if (!ok) {
    return { error: "Du är inte inloggad." };
  }
  // Single-user: PATs are managed via AUTH_PASSWORD env var — no per-user token table.
  return { error: "Automatiseringstokens är inte tillgängliga i denna version." };
}

export async function revokeAutomationTokenAction(
  _tokenId: string,
): Promise<AutomationActionResult> {
  const ok = await getSession();
  if (!ok) {
    return { error: "Du är inte inloggad." };
  }
  revalidatePath("/settings/integrations");
  return {};
}
