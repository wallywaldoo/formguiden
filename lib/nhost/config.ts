export function getNhostConnection() {
  return {
    subdomain:
      process.env.NHOST_SUBDOMAIN ||
      process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN ||
      "local",
    region:
      process.env.NHOST_REGION ||
      process.env.NEXT_PUBLIC_NHOST_REGION ||
      "local",
  };
}

export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  // Official Nhost Next.js App Router recipe requires a client-readable session
  // cookie. HttpOnly would break documented client session access. XSS can steal
  // this cookie — treat injection as full account compromise. See docs/security-model.md.
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
};
