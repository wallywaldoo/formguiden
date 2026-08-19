// TODO [migration]: This file provided the browser-side Nhost client.
// No longer needed — the app uses HttpOnly session cookies and server actions.
// Keeping as a no-op export so any lingering client imports don't crash.

export function createBrowserNhostClient() {
  return {
    getUserSession: () => null,
  };
}
