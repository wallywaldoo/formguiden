import { AsyncLocalStorage } from "node:async_hooks";

type SessionHolder = { current: { user: { id: string } } };

const sessionStore = new AsyncLocalStorage<SessionHolder>();

export function runWithSession<T>(
  session: { user: { id: string } },
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
