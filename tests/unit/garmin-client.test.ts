import { afterEach, describe, expect, it, vi } from "vitest";

import { GarminClient, type GarminSession } from "@/lib/garmin/client";

function makeJwt(expOffsetSeconds = 3600) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" }))
    .toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ exp: Math.floor(Date.now() / 1000) + expOffsetSeconds }),
  ).toString("base64url");
  return `${header}.${payload}.sig`;
}

function makeSession(): GarminSession {
  return {
    di_token: makeJwt(),
    di_refresh_token: "refresh-token",
    di_client_id: "client-id",
  };
}

describe("GarminClient", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses social profile displayName for stats and sleep", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ displayName: "runner.name" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            restingHeartRate: 52,
            averageStressLevel: 27,
            bodyBatteryHighestValue: 88,
            bodyBatteryLowestValue: 25,
            totalSteps: 12345,
            avgWakingRespirationValue: 13.4,
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            dailySleepDTO: {
              sleepTimeSeconds: 28800,
              sleepStartTimestampGMT: "2026-08-18T21:00:00Z",
              sleepEndTimestampGMT: "2026-08-19T05:00:00Z",
              restingHeartRate: 50,
            },
          }),
          { status: 200 },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new GarminClient(makeSession());
    await client.getDailyStats("2026-08-19");
    await client.getSleepData("2026-08-19");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://connectapi.garmin.com/userprofile-service/socialProfile",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://connectapi.garmin.com/usersummary-service/usersummary/daily/runner.name?calendarDate=2026-08-19",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://connectapi.garmin.com/wellness-service/wellness/dailySleepData/runner.name?date=2026-08-19&nonSleepBufferMinutes=60",
      expect.any(Object),
    );
  });

  it("treats empty HRV responses as missing data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(new Response("", { status: 200 })),
    );

    const client = new GarminClient(makeSession());

    await expect(client.getHrvData("2026-08-19")).resolves.toEqual({
      localDate: "2026-08-19",
      hrvRmssdMs: null,
    });
  });

  it("uses the same weight range endpoint as python-garminconnect", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ dailyWeightSummaries: [] }), {
          status: 200,
        }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new GarminClient(makeSession());
    await client.getWeightRange("2026-08-01", "2026-08-19");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://connectapi.garmin.com/weight-service/weight/range/2026-08-01/2026-08-19?includeAll=true",
      expect.any(Object),
    );
  });
});
