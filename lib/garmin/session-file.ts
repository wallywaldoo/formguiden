import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  parseGarminSession,
  readGarminSessionFromEnv,
  type GarminSession,
} from "@/lib/garmin/session";

const TOKEN_FILE = () =>
  join(homedir(), ".garminconnect", "garmin_tokens.json");

export function loadGarminSession(): GarminSession | null {
  if (!(process.env.VITEST || process.env.NODE_ENV === "test")) {
    try {
      const file = TOKEN_FILE();
      if (existsSync(file)) {
        const fromFile = parseGarminSession(readFileSync(file, "utf8"));
        if (fromFile) return fromFile;
      }
    } catch {
      // Fall through to the env copy.
    }
  }
  return readGarminSessionFromEnv();
}

export function persistGarminSession(session: GarminSession): void {
  if (process.env.VITEST || process.env.NODE_ENV === "test") return;
  process.env.GARMIN_SESSION = JSON.stringify(session);
  try {
    const file = TOKEN_FILE();
    const dir = join(homedir(), ".garminconnect");
    if (!existsSync(file) && !existsSync(dir)) return;
    let current: Record<string, unknown> = {};
    if (existsSync(file)) {
      try {
        const parsed = JSON.parse(readFileSync(file, "utf8")) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          current = parsed as Record<string, unknown>;
        }
      } catch {
        current = {};
      }
    }
    writeFileSync(file, JSON.stringify({ ...current, ...session }, null, 2));
  } catch {
    // Best-effort local persist for python-garminconnect interop.
  }
}
