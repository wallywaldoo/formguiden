// TODO [migration]: This file provided Nhost connection config.
// Keeping minimal exports so any lingering imports don't break the build.

export function getNhostConnection() {
  return { subdomain: "local", region: "local" };
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
};
