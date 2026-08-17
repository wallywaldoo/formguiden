import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import { PKCE_VERIFIER_COOKIE } from "@/lib/constants";
import { createNhostClient } from "@/lib/nhost/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const flow = request.nextUrl.searchParams.get("flow") ?? "verify";
  const errorUrl = new URL("/callback/error", request.url);

  if (!code) {
    errorUrl.searchParams.set("message", "Ingen auktoriseringskod i länken.");
    return NextResponse.redirect(errorUrl);
  }

  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get(PKCE_VERIFIER_COOKIE)?.value;

  if (!codeVerifier) {
    errorUrl.searchParams.set(
      "message",
      "PKCE-verifieraren saknas. Öppna länken i samma webbläsare som du startade från.",
    );
    return NextResponse.redirect(errorUrl);
  }

  try {
    const nhost = await createNhostClient();
    await nhost.auth.tokenExchange({ code, codeVerifier });
    cookieStore.delete(PKCE_VERIFIER_COOKIE);
  } catch (error) {
    errorUrl.searchParams.set(
      "message",
      error instanceof Error ? error.message : "Verifieringen misslyckades.",
    );
    return NextResponse.redirect(errorUrl);
  }

  const destination = flow === "reset" ? "/reset-password" : "/onboarding";
  return NextResponse.redirect(new URL(destination, request.url));
}
