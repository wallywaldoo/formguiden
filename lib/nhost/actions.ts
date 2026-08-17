"use server";

import { generatePKCEPair } from "@nhost/nhost-js/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { PKCE_VERIFIER_COOKIE } from "@/lib/constants";
import { getAppUrl } from "@/lib/nhost/config";
import { createNhostClient } from "@/lib/nhost/server";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/validation/auth";

export type ActionResult = {
  error?: string;
  success?: string;
};

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function setPkceVerifierCookie(verifier: string) {
  const cookieStore = await cookies();
  cookieStore.set(PKCE_VERIFIER_COOKIE, verifier, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15,
  });
}

export async function signInAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter." };
  }

  try {
    const nhost = await createNhostClient();
    await nhost.auth.signInEmailPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
  } catch (error) {
    return {
      error: errorMessage(
        error,
        "Kunde inte logga in. Kontrollera e-post och lösenord.",
      ),
    };
  }

  redirect("/overview");
}

export async function signUpAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ogiltiga uppgifter." };
  }

  try {
    const { verifier, challenge } = await generatePKCEPair();
    await setPkceVerifierCookie(verifier);
    const nhost = await createNhostClient();
    await nhost.auth.signUpEmailPassword({
      email: parsed.data.email,
      password: parsed.data.password,
      codeChallenge: challenge,
      options: {
        locale: "sv",
        defaultRole: "user",
        allowedRoles: ["user"],
        redirectTo: `${getAppUrl()}/callback?flow=verify`,
      },
    });
  } catch (error) {
    return {
      error: errorMessage(error, "Kunde inte skapa kontot. Försök igen."),
    };
  }

  redirect(
    `/signup?verify=success&email=${encodeURIComponent(parsed.data.email)}`,
  );
}

export async function signOutAction() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();
  try {
    await nhost.auth.signOut({
      refreshToken: session?.refreshToken,
      all: true,
    });
  } catch {
    nhost.clearSession();
  }
  redirect("/login");
}

export async function forgotPasswordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Ogiltig e-postadress.",
    };
  }

  try {
    const { verifier, challenge } = await generatePKCEPair();
    await setPkceVerifierCookie(verifier);
    const nhost = await createNhostClient();
    await nhost.auth.sendPasswordResetEmail({
      email: parsed.data.email,
      codeChallenge: challenge,
      options: {
        redirectTo: `${getAppUrl()}/callback?flow=reset`,
      },
    });
  } catch {
    // Generic success to avoid account enumeration.
  }

  return {
    success:
      "Om adressen finns skickar vi en länk för att återställa lösenordet.",
  };
}

export async function resetPasswordAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ogiltigt lösenord." };
  }

  try {
    const nhost = await createNhostClient();
    if (!nhost.getUserSession()) {
      return { error: "Sessionen saknas. Begär en ny återställningslänk." };
    }
    await nhost.auth.changeUserPassword({
      newPassword: parsed.data.password,
    });
  } catch (error) {
    return {
      error: errorMessage(error, "Kunde inte byta lösenord. Försök igen."),
    };
  }

  redirect("/overview");
}
