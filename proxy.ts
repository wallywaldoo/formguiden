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

export async function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const path = request.nextUrl.pathname;

  if (path === "/api" || path.startsWith("/api/")) {
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
    "/((?!api|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
  ],
};
