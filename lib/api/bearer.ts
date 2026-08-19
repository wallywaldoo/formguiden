import { createServerClient } from "@nhost/nhost-js";
import { MemoryStorage, type StoredSession } from "@nhost/nhost-js/session";
import { NextResponse } from "next/server";

import { getNhostConnection } from "@/lib/nhost/config";
import { runWithSession } from "@/lib/nhost/session-context";

export type BearerContext = {
  userId: string;
};

const BEARER_PREFIX = /^Bearer\s+(.+)$/i;

/**
 * Nhost issues personal access tokens as UUIDs. Checking the shape before
 * spending a network round trip keeps scanners cheap to reject.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** JWT tokens start with eyJ (base64url of {"alg": or {"typ":) */
const JWT_PREFIX = /^eyJ/;

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Ogiltig eller saknad token." },
    { status: 401 },
  );
}

/**
 * Authenticates a request with an Nhost personal access token and runs the
 * handler under that user's session.
 *
 * The PAT is exchanged for a real session, so every downstream query still
 * carries a user JWT and Hasura row permissions apply unchanged. No admin
 * secret is involved, which means a stolen token cannot read across tenants.
 *
 * Note that an Nhost PAT grants the user's whole account, not just import.
 * That trade-off is documented in docs/security-model.md.
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

  const connection = getNhostConnection();
  const storage = new MemoryStorage();
  const nhost = createServerClient({
    region: connection.region,
    subdomain: connection.subdomain,
    storage,
  });

  if (JWT_PREFIX.test(token)) {
    // Caller already has a JWT — skip the PAT exchange round-trip.
    // Decode the user ID from the payload without re-verifying; Hasura will
    // reject the token on any downstream GraphQL call if it is invalid.
    try {
      const payloadB64 = token.split(".")[1];
      if (!payloadB64) return unauthorized();
      const payload = JSON.parse(
        Buffer.from(payloadB64, "base64url").toString("utf8"),
      ) as Record<string, unknown>;
      const userId =
        typeof payload.sub === "string" ? payload.sub : undefined;
      if (!userId) return unauthorized();

      // Construct a minimal StoredSession so runWithSession/createNhostClient
      // can inject the JWT into downstream requests.
      const session = {
        accessToken: token,
        accessTokenExpiresIn: 900,
        refreshToken: "",
        refreshTokenId: "",
        user: {
          id: userId,
          email: "",
          displayName: "",
          avatarUrl: "",
          locale: "sv",
          createdAt: "",
          isAnonymous: false,
          defaultRole: "user",
          roles: ["user"],
          emailVerified: false,
          phoneNumberVerified: false,
          activeMfaType: null,
          metadata: null,
        },
      } as unknown as StoredSession;
      return runWithSession(session, () => handler({ userId }));
    } catch {
      return unauthorized();
    }
  }

  if (!UUID.test(token)) {
    return unauthorized();
  }

  try {
    await nhost.auth.signInPAT({ personalAccessToken: token });
  } catch {
    return unauthorized();
  }

  const session = nhost.getUserSession();
  const userId = session?.user?.id;
  if (!session || !userId) {
    return unauthorized();
  }

  return runWithSession(session, () => handler({ userId }));
}
