import { NextResponse } from "next/server";

const BEARER_PREFIX = /^Bearer\s+(.+)$/i;

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "Ogiltig eller saknad token." },
    { status: 401 },
  );
}

/**
 * Bearer token auth for the ChatGPT Custom GPT assistant API.
 * Checks the token against ASSISTANT_API_KEY env var.
 */
export async function withAssistantAuth(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  const header = request.headers.get("authorization");
  const match = header ? BEARER_PREFIX.exec(header) : null;
  const token = match?.[1]?.trim();

  if (!token) {
    return unauthorized();
  }

  const expectedKey = process.env.ASSISTANT_API_KEY;
  if (!expectedKey || token !== expectedKey) {
    return unauthorized();
  }

  return handler();
}

export function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "https://chatgpt.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
  };
}

export function withCors(response: NextResponse): NextResponse {
  const headers = corsHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
