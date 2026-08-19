"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { graphqlRequest } from "@/lib/graphql/client";
import { INSERT_AUDIT_EVENT } from "@/lib/graphql/mutations/profile";
import {
  INSERT_AUTOMATION_TOKEN,
  REVOKE_AUTOMATION_TOKEN,
} from "@/lib/graphql/mutations/automation";
import { createNhostClient } from "@/lib/nhost/server";
import { signInSchema } from "@/lib/validation/auth";

export type AutomationActionResult = {
  error?: string;
  token?: string;
  expiresAt?: string;
};

const PAT_TTL_DAYS = 90;

export async function createAutomationTokenAction(
  _prev: AutomationActionResult,
  formData: FormData,
): Promise<AutomationActionResult> {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();
  const email = session?.user?.email;
  if (!email) {
    return { error: "Du är inte inloggad." };
  }

  const parsed = signInSchema.safeParse({
    email,
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ogiltigt lösenord." };
  }

  const labelParsed = z
    .string()
    .trim()
    .min(1)
    .max(64)
    .safeParse(formData.get("label") || "garmin-sync");
  if (!labelParsed.success) {
    return { error: "Ogiltigt namn på tokenen." };
  }

  try {
    await nhost.auth.signInEmailPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch {
    return { error: "Fel lösenord." };
  }

  const expiresAt = new Date(
    Date.now() + PAT_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  try {
    const created = await nhost.auth.createPAT({
      expiresAt,
      metadata: { name: labelParsed.data, "used-by": "garmin-sync" },
    });
    const body = created.body;
    if (!body.id || !body.personalAccessToken) {
      return { error: "Kunde inte skapa tokenen." };
    }

    await graphqlRequest(INSERT_AUTOMATION_TOKEN, {
      nhost_pat_id: body.id,
      label: labelParsed.data,
      expires_at: expiresAt,
    });
    await graphqlRequest(INSERT_AUDIT_EVENT, {
      action: "automation.token.create",
      entity_type: "automation_tokens",
      entity_id: body.id,
    });

    revalidatePath("/settings/integrations");
    return { token: body.personalAccessToken, expiresAt };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Kunde inte skapa tokenen.",
    };
  }
}

export async function revokeAutomationTokenAction(
  tokenId: string,
): Promise<AutomationActionResult> {
  const parsed = z.string().uuid().safeParse(tokenId);
  if (!parsed.success) {
    return { error: "Ogiltig token." };
  }

  const nhost = await createNhostClient();
  if (!nhost.getUserSession()?.user?.id) {
    return { error: "Du är inte inloggad." };
  }

  try {
    await graphqlRequest(REVOKE_AUTOMATION_TOKEN, {
      id: parsed.data,
      revoked_at: new Date().toISOString(),
    });
    await graphqlRequest(INSERT_AUDIT_EVENT, {
      action: "automation.token.revoke",
      entity_type: "automation_tokens",
      entity_id: parsed.data,
    });
    revalidatePath("/settings/integrations");
    return {};
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte återkalla tokenen.",
    };
  }
}
