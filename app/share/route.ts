import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth";

export const maxDuration = 60;

// TODO [migration]: Reimplement file upload share route with Vercel Blob or
// local file storage instead of Nhost Storage.

export async function GET(request: Request) {
  return NextResponse.redirect(new URL("/import", request.url));
}

export async function POST(request: Request) {
  const login = new URL("/login", request.url);
  login.searchParams.set("next", "/import");

  const authenticated = await getSession();
  if (!authenticated) {
    return NextResponse.redirect(login, 303);
  }

  const failed = new URL("/import", request.url);
  failed.searchParams.set(
    "error",
    "Filuppladdning via delning är inte implementerad ännu.",
  );
  return NextResponse.redirect(failed, 303);
}
