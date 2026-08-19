import { type NextRequest, NextResponse } from "next/server";

// TODO [migration]: This callback route handled PKCE token exchange for Nhost.
// It's no longer needed for single-user auth. Keeping it as a redirect stub
// so any old email links don't 404.
export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/login", request.url));
}
