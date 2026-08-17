import { createServerClient, type NhostClient } from "@nhost/nhost-js";
import {
  DEFAULT_SESSION_KEY,
  type StoredSession,
} from "@nhost/nhost-js/session";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

import { getNhostConnection, SESSION_COOKIE_OPTIONS } from "@/lib/nhost/config";

const sessionCookieName = DEFAULT_SESSION_KEY;

function parseStoredSession(
  raw: string | null | undefined,
): StoredSession | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

/**
 * Nhost client for Server Components, Server Actions, and Route Handlers.
 * Session is read from cookies. Follows the official Next.js App Router recipe:
 * https://docs.nhost.io/getting-started/tutorials/nextjs/2-protected-routes/
 */
export async function createNhostClient(): Promise<NhostClient> {
  const cookieStore = await cookies();
  const connection = getNhostConnection();

  return createServerClient({
    region: connection.region,
    subdomain: connection.subdomain,
    storage: {
      get: (): StoredSession | null => {
        return parseStoredSession(cookieStore.get(sessionCookieName)?.value);
      },
      set: (value: StoredSession) => {
        cookieStore.set(
          sessionCookieName,
          JSON.stringify(value),
          SESSION_COOKIE_OPTIONS,
        );
      },
      remove: () => {
        cookieStore.delete(sessionCookieName);
      },
    },
  });
}

/**
 * Token refresh for Next.js proxy. Must run before pages render.
 * Cookie is not HttpOnly — see SESSION_COOKIE_OPTIONS.
 */
export async function handleNhostProxy(
  request: NextRequest,
  response: NextResponse,
): Promise<StoredSession | null> {
  const connection = getNhostConnection();

  const nhost = createServerClient({
    region: connection.region,
    subdomain: connection.subdomain,
    storage: {
      get: (): StoredSession | null => {
        return parseStoredSession(
          request.cookies.get(sessionCookieName)?.value,
        );
      },
      set: (value: StoredSession) => {
        response.cookies.set({
          name: sessionCookieName,
          value: JSON.stringify(value),
          ...SESSION_COOKIE_OPTIONS,
        });
      },
      remove: () => {
        response.cookies.delete(sessionCookieName);
      },
    },
  });

  return nhost.refreshSession(60);
}

export async function getSessionUserId(): Promise<string | null> {
  const nhost = await createNhostClient();
  return nhost.getUserSession()?.user?.id ?? null;
}
