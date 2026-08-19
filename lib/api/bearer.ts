import { NextResponse } from "next/server";

import { runWithSession } from "@/lib/nhost/session-context";

// TODO [migration]: Replace Nhost PAT auth with a simple API key check
// using INGEST_API_KEY env var.

export type BearerContext = {
  userId: string;
};

const BEARER_PREFIX = /^Bearer\s+(.+)$/i;

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Ogiltig eller saknad token." },
    { status: 401 },
  );
}

/**
 * Simple bearer token auth for the ingest API.
 * Checks the token against INGEST_API_KEY env var.
 */
export async function withBearerAuth(
  request: Request,
  handler: (context: BearerContext) => Promise<NextResponse>,
): Promise<NextResponse> {
  const header = request.headers.get("authorization");
  const match = header ? BEARER_PREFIX.exec(header) : null;
  const token = match?.[1]?.trim();

  if (!token) {
    return unauthorized();
  }

  const expectedKey = process.env.INGEST_API_KEY;
  if (!expectedKey || token !== expectedKey) {
    return unauthorized();
  }

  const session = { user: { id: "single-user" } };
  return runWithSession(session, () =>
    handler({ userId: "single-user" }),
  );
}
