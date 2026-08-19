import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { handleNhostProxy } from "@/lib/auth";

const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/callback",
];

/**
 * Routes that authenticate with a bearer token instead of the session cookie.
 * They must bypass the proxy entirely: there is no cookie to refresh, and
 * redirecting an API call to /login would hand the caller an HTML login page
 * instead of a 401 it can act on.
 */
const tokenAuthRoutes = ["/api/ingest"];

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const path = request.nextUrl.pathname;

  if (
    tokenAuthRoutes.some(
      (route) => path === route || path.startsWith(`${route}/`),
    )
  ) {
    return response;
  }

  const isPublicRoute = publicRoutes.some(
    (route) => path === route || path.startsWith(`${route}/`),
  );

  const session = await handleNhostProxy(request, response);

  if (isPublicRoute) {
    return response;
  }

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
