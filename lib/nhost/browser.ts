import { createClient } from "@nhost/nhost-js";
import { CookieStorage, DEFAULT_SESSION_KEY } from "@nhost/nhost-js/session";

export function createBrowserNhostClient() {
  return createClient({
    subdomain: process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN || "local",
    region: process.env.NEXT_PUBLIC_NHOST_REGION || "eu-central-1",
    storage: new CookieStorage({
      cookieName: DEFAULT_SESSION_KEY,
      expirationDays: 30,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    }),
  });
}
