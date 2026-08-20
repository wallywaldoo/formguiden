export interface GarminSession {
  di_token: string;
  di_refresh_token: string;
  di_client_id: string;
}

export const GARMIN_SESSION_INVALID_MESSAGE =
  "Garmin-sessionen i miljön är ogiltig. Sätt GARMIN_SESSION till token-JSON från python-garminconnect (filen garmin_tokens.json).";

export function decodeGarminSessionRaw(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }
  return Buffer.from(trimmed, "base64").toString("utf-8");
}

export function parseGarminSession(
  raw: string | undefined | null,
): GarminSession | null {
  if (!raw?.trim()) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeGarminSessionRaw(raw);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoded);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const record = parsed as Record<string, unknown>;
  const di_token =
    typeof record.di_token === "string" ? record.di_token.trim() : "";
  const di_refresh_token =
    typeof record.di_refresh_token === "string"
      ? record.di_refresh_token.trim()
      : "";
  const di_client_id =
    typeof record.di_client_id === "string" ? record.di_client_id.trim() : "";

  if (!di_token || !di_refresh_token || !di_client_id) {
    return null;
  }

  return { di_token, di_refresh_token, di_client_id };
}

export function readGarminSessionFromEnv(): GarminSession | null {
  return parseGarminSession(process.env.GARMIN_SESSION);
}

/** Env-only. File tokens are loaded on the server via `session-file`. */
export function readGarminSession(): GarminSession | null {
  return readGarminSessionFromEnv();
}

export function garminSessionConfigurationError(
  raw: string | undefined | null = process.env.GARMIN_SESSION,
): string | null {
  if (parseGarminSession(raw) || readGarminSessionFromEnv()) return null;
  if (raw?.trim()) return GARMIN_SESSION_INVALID_MESSAGE;
  return null;
}

export function userFacingGarminError(message: string): string {
  if (
    message.includes("not valid Garmin session JSON") ||
    message.includes("GARMIN_SESSION env var is not set") ||
    message.includes("GARMIN_SESSION environment variable") ||
    message.includes("token refresh failed")
  ) {
    if (message.includes("not set")) {
      return "Garmin Connect är inte konfigurerat i miljön.";
    }
    if (message.includes("token refresh failed")) {
      return "Garmin-sessionen har gått ut. Förnya token från python-garminconnect.";
    }
    return GARMIN_SESSION_INVALID_MESSAGE;
  }
  return message;
}
