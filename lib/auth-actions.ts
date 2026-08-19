"use server";

import { redirect } from "next/navigation";

import {
  createSession,
  destroySession,
  hasConfiguredPassword,
  verifyPassword,
} from "@/lib/auth";

export type ActionResult = {
  error?: string;
  success?: string;
};

export async function signInAction(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  if (!hasConfiguredPassword()) {
    return { error: "AUTH_PASSWORD saknas i servermiljonen." };
  }

  const password = formData.get("password");
  if (typeof password !== "string" || !password) {
    return { error: "Ange ditt lösenord." };
  }

  if (!verifyPassword(password)) {
    return { error: "Fel lösenord." };
  }

  await createSession();
  redirect("/overview");
}

export async function signOutAction() {
  await destroySession();
  redirect("/login");
}

// TODO [migration]: Remove forgotPasswordAction and resetPasswordAction — not needed for single-user.
// Keeping stubs so existing form imports don't break during transition.
export async function forgotPasswordAction(
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  return { error: "Inte tillgängligt i enbrukarläge." };
}

export async function resetPasswordAction(
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  return { error: "Inte tillgängligt i enbrukarläge." };
}

export async function signUpAction(
  _prev: ActionResult,
  _formData: FormData,
): Promise<ActionResult> {
  return { error: "Registrering är inte tillgänglig." };
}
