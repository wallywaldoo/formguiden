import { describe, expect, it } from "vitest";

import {
  INGEST_MAX_IMPORTS_PER_DAY,
  isOverIngestRateLimit,
} from "@/lib/api/ingest-limit";
import { detectFileKind } from "@/lib/import/detect";
import { parseGarminConnectUpload } from "@/lib/import/garmin-connect";
import { inspectAndParse } from "@/lib/import/parse-bytes";
import { runWithSession, hasContextSession } from "@/lib/nhost/session-context";
import type { StoredSession } from "@nhost/nhost-js/session";

const encoder = new TextEncoder();

function payload(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    provenance: {
      engine: "python-garminconnect",
      engineVersion: "0.3.2",
      scriptVersion: "1",
    },
    dailyHealth: [
      {
        localDate: "2026-08-18",
        steps: 9589,
        restingHeartRateBpm: 63,
        stressAvg: 34,
        bodyBatteryHigh: 54,
        bodyBatteryLow: 14,
        sleepDurationS: 34620,
        sleepStartAt: "2026-08-17T21:03:00Z",
        sleepEndAt: "2026-08-18T06:45:00Z",
      },
    ],
    bodyMeasurements: [
      {
        measuredAt: "2026-08-17T18:13:02Z",
        massKg: 84,
      },
    ],
    ...overrides,
  };
}

describe("garmin-connect JSON ingest", () => {
  it("detects a top-level JSON object", () => {
    expect(detectFileKind(encoder.encode('{"schemaVersion":1}'))).toBe("json");
  });

  it("maps a valid payload onto the canonical model", async () => {
    const bytes = encoder.encode(JSON.stringify(payload()));
    const inspected = await inspectAndParse(bytes);
    expect(inspected.source).toBe("garmin-connect");
    expect(inspected.parse.dailyHealth).toHaveLength(1);
    expect(inspected.parse.dailyHealth[0]?.steps).toBe(9589);
    expect(inspected.parse.dailyHealth[0]?.externalId).toBe(
      "garmin-connect:day:2026-08-18",
    );
    expect(inspected.parse.bodyMeasurements[0]?.massKg).toBe(84);
    expect(inspected.parse.activities).toEqual([]);
  });

  it("rejects a naive timestamp instead of guessing a timezone", () => {
    expect(() =>
      parseGarminConnectUpload(
        encoder.encode(
          JSON.stringify(
            payload({
              bodyMeasurements: [
                { measuredAt: "2026-08-17T18:13:02", massKg: 84 },
              ],
            }),
          ),
        ),
      ),
    ).toThrow(/UTC-offset/);
  });

  it("drops empty days so they do not look like measured zeros", async () => {
    const inspected = await inspectAndParse(
      encoder.encode(
        JSON.stringify(
          payload({
            dailyHealth: [{ localDate: "2026-08-01" }],
            bodyMeasurements: [],
          }),
        ),
      ),
    );
    expect(inspected.parse.dailyHealth).toEqual([]);
  });
});

describe("ingest rate limit", () => {
  it("trips after the daily cap", () => {
    const now = new Date("2026-08-19T10:00:00Z");
    const stamps = Array.from({ length: INGEST_MAX_IMPORTS_PER_DAY }, (_, i) =>
      new Date(now.getTime() - i * 60_000).toISOString(),
    );
    expect(isOverIngestRateLimit(stamps, now)).toBe(true);
    expect(isOverIngestRateLimit(stamps.slice(1), now)).toBe(false);
  });
});

describe("session context isolation", () => {
  it("does not leak a session outside runWithSession", async () => {
    const session = {
      accessToken: "token",
      accessTokenExpiresIn: 900,
      refreshToken: "refresh",
      refreshTokenId: "11111111-1111-1111-1111-111111111111",
      user: { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
      decodedToken: {},
    } as unknown as StoredSession;

    expect(hasContextSession()).toBe(false);
    await runWithSession(session, async () => {
      expect(hasContextSession()).toBe(true);
    });
    expect(hasContextSession()).toBe(false);
  });
});
