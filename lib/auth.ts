import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "fk_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Verify a password against the AUTH_PASSWORD env var.
 * For a single-user app, a simple constant-time string comparison suffices.
 */
export function verifyPassword(password: string): boolean {
  const expected = process.env.AUTH_PASSWORD;
  if (!expected || !password) return false;
  if (expected.length !== password.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ password.charCodeAt(i);
  }
  return mismatch === 0;
}

function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Create a session cookie after successful login.
 * The token value doesn't matter for a single-user app — its mere presence
 * proves the user authenticated. We still use a random token so the cookie
 * can't be trivially guessed.
 */
export async function createSession(): Promise<void> {
  const token = generateSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Check if the current request has a valid session.
 * For single-user: any non-empty session cookie means authenticated.
 */
export async function getSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  return Boolean(token);
}

/**
 * Check session from a NextRequest (for middleware, which can't use cookies()).
 */
export function hasSessionCookie(
  request: Pick<Request, "headers">,
): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";
  return cookieHeader.includes(`${SESSION_COOKIE_NAME}=`);
}

export { SESSION_COOKIE_NAME };

// TODO [migration]: Consider adding session token storage in DB for revocation.
