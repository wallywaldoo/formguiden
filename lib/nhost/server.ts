import { getSession } from "@/lib/auth";

// TODO [migration]: This file is a compatibility shim. Once all GraphQL queries
// are replaced with direct SQL, remove createNhostClient/getSessionUserId entirely.

function notImplemented(method: string): never {
  throw new Error(
    `nhost.${method}() is disabled. Migrate to direct SQL / lib/auth.ts.`,
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

function methodProxy(prefix: string): Record<string, AnyFn> {
  return new Proxy(
    {},
    { get: (_t, prop) => () => notImplemented(`${prefix}.${String(prop)}`) },
  );
}

/**
 * Compatibility shim: returns a minimal object with getUserSession().
 * Components that call createNhostClient().getUserSession() to check auth
 * will get a truthy result when the session cookie is present.
 * Any call to auth/graphql/storage methods throws at runtime with a clear
 * migration message.
 */
export async function createNhostClient() {
  const authenticated = await getSession();
  return {
    getUserSession: () =>
      authenticated
        ? {
            user: {
              id: "single-user",
              email: "",
              displayName: "Viktor",
              avatarUrl: "",
            },
            accessToken: "local",
            refreshToken: "",
          }
        : null,
    clearSession: () => {},
    auth: methodProxy("auth"),
    graphql: methodProxy("graphql"),
    storage: methodProxy("storage"),
  };
}

export async function getSessionUserId(): Promise<string | null> {
  const authenticated = await getSession();
  return authenticated ? "single-user" : null;
}

/**
 * Proxy shim for middleware — no longer does token refresh.
 * Returns truthy when a session cookie exists on the request.
 */
export async function handleNhostProxy(
  request: Pick<Request, "headers">,
  _response: unknown,
): Promise<{ user: { id: string } } | null> {
  const { hasSessionCookie } = await import("@/lib/auth");
  if (hasSessionCookie(request)) {
    return { user: { id: "single-user" } };
  }
  return null;
}
