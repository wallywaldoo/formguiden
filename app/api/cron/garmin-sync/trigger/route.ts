import { NextResponse } from "next/server";

import { runGarminSync } from "../sync";

/**
 * Manual sync trigger — accessible with ASSISTANT_API_KEY Bearer auth.
 * Useful for triggering a sync from ChatGPT or curl without waiting for the
 * next scheduled cron invocation.
 *
 * POST /api/cron/garmin-sync/trigger
 * Body (optional): { "days": 14 }
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedKey = process.env.ASSISTANT_API_KEY;

  if (!expectedKey || authHeader !== `Bearer ${expectedKey}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let days = 14;
  try {
    const body = await request.json().catch(() => ({}));
    if (typeof body?.days === "number" && body.days > 0 && body.days <= 90) {
      days = body.days;
    }
  } catch {
    // ignore parse errors — use default
  }

  try {
    const result = await runGarminSync({ days });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[garmin-sync trigger] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
