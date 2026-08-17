"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ACCOUNT_DELETION_GRACE_DAYS } from "@/lib/constants";
import { graphqlRequest } from "@/lib/graphql/client";
import { INSERT_AUDIT_EVENT } from "@/lib/graphql/mutations/profile";
import {
  CANCEL_DELETION_REQUEST,
  INSERT_DELETION_REQUEST,
} from "@/lib/graphql/mutations/coaching";
import { createNhostClient } from "@/lib/nhost/server";
import { signInSchema } from "@/lib/validation/auth";

export type PrivacyActionResult = {
  error?: string;
  success?: string;
};

const cancelSchema = z.object({
  request_id: z.string().uuid(),
});

export async function requestAccountDeletionAction(
  _prev: PrivacyActionResult,
  formData: FormData,
): Promise<PrivacyActionResult> {
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

  try {
    await nhost.auth.signInEmailPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch {
    return { error: "Fel lösenord." };
  }

  const purgeAfter = new Date(
    Date.now() + ACCOUNT_DELETION_GRACE_DAYS * 86_400_000,
  ).toISOString();

  try {
    const created = await graphqlRequest<{
      insert_account_deletion_requests_one: { id: string };
    }>(INSERT_DELETION_REQUEST, { purge_after: purgeAfter });
    await graphqlRequest(INSERT_AUDIT_EVENT, {
      action: "account.delete.request",
      entity_type: "account_deletion_request",
      entity_id: created.insert_account_deletion_requests_one.id,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte registrera raderingsbegäran.",
    };
  }

  try {
    await nhost.auth.signOut({
      refreshToken: nhost.getUserSession()?.refreshToken,
      all: true,
    });
  } catch {
    nhost.clearSession();
  }

  redirect("/login?deleted=pending");
}

export async function cancelAccountDeletionAction(
  _prev: PrivacyActionResult,
  formData: FormData,
): Promise<PrivacyActionResult> {
  const parsed = cancelSchema.safeParse({
    request_id: formData.get("request_id"),
  });
  if (!parsed.success) {
    return { error: "Ogiltig begäran." };
  }

  try {
    await graphqlRequest(CANCEL_DELETION_REQUEST, {
      id: parsed.data.request_id,
      cancelled_at: new Date().toISOString(),
    });
    await graphqlRequest(INSERT_AUDIT_EVENT, {
      action: "account.delete.cancel",
      entity_type: "account_deletion_request",
      entity_id: parsed.data.request_id,
    });
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Kunde inte avbryta raderingen.",
    };
  }

  revalidatePath("/account/deletion-pending");
  revalidatePath("/overview");
  return { success: "Raderingen avbröts. Ditt konto är aktivt igen." };
}
