import { NextResponse } from "next/server";

import { runGarminSync } from "./sync";

/**
 * Vercel Cron handler — called every 6 hours by the platform.
 * Protected by CRON_SECRET which Vercel sets automatically and sends as
 * `Authorization: Bearer <secret>` on every cron invocation.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runGarminSync({ days: 14 });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[garmin-sync cron] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
