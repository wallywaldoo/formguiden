import { AsyncLocalStorage } from "node:async_hooks";
import type { StoredSession } from "@nhost/nhost-js/session";

/**
 * Request-scoped session for callers that authenticate with a bearer token
 * instead of the session cookie, such as the automation ingest API.
 *
 * Every data access path in the app funnels through `createNhostClient`, which
 * reads `cookies()`. A token-authenticated request has no cookie, and calling
 * `cookies()` for it would either throw or silently resolve to an anonymous
 * client. Putting the session here lets the existing Server Action and import
 * pipeline code run unchanged under a token identity, with Hasura row
 * permissions still derived from the JWT.
 */
const sessionStore = new AsyncLocalStorage<SessionHolder>();

/**
 * Mutable so the Nhost SDK can write a refreshed session back during the
 * request without reaching for cookies it must not touch here.
 */
type SessionHolder = { current: StoredSession };

export function runWithSession<T>(
  session: StoredSession,
  fn: () => Promise<T>,
): Promise<T> {
  return sessionStore.run({ current: session }, fn);
}

export function getSessionHolder(): SessionHolder | null {
  return sessionStore.getStore() ?? null;
}

export function hasContextSession(): boolean {
  return sessionStore.getStore() !== undefined;
}
