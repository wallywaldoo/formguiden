import { afterEach, describe, expect, it, vi } from "vitest";

import { GarminClient, type GarminSession } from "@/lib/garmin/client";

function makeJwt(expOffsetSeconds = 3600) {
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
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

  it("refreshes expired tokens at the current Garmin OAuth endpoint", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: makeJwt(3600),
            refresh_token: "new-refresh",
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ displayName: "runner.name" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ totalSteps: 100 }), { status: 200 }),
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new GarminClient({
      di_token: makeJwt(-60),
      di_refresh_token: "refresh-token",
      di_client_id: "client-id",
    });
    const stats = await client.getDailyStats("2026-08-20");

    expect(stats.steps).toBe(100);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://diauth.garmin.com/di-oauth2-service/oauth/token",
    );
    expect(fetchMock.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: `Basic ${Buffer.from("client-id:").toString("base64")}`,
        }),
      }),
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

  it("reads VO2 max from maxmet daily generic payload", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            generic: {
              calendarDate: "2026-08-20",
              vo2MaxPreciseValue: 51.0,
              vo2MaxValue: 51.0,
            },
          },
        ]),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new GarminClient(makeSession());
    await expect(client.getVo2MaxOptional()).resolves.toBe(51);

    expect(fetchMock.mock.calls[0]?.[0]).toMatch(
      /\/metrics-service\/metrics\/maxmet\/daily\/\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("falls back to training status for VO2 max", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (input) => {
        const url = String(input);
        if (url.includes("/maxmet/daily/")) {
          return new Response("[]", { status: 200 });
        }
        if (url.includes("/trainingstatus/aggregated/")) {
          return new Response(
            JSON.stringify({
              mostRecentVO2Max: {
                generic: { vo2MaxPreciseValue: 48.6, vo2MaxValue: 49 },
              },
            }),
            { status: 200 },
          );
        }
        return new Response("{}", { status: 404 });
      });
    vi.stubGlobal("fetch", fetchMock);

    const client = new GarminClient(makeSession());
    await expect(client.getVo2MaxOptional()).resolves.toBe(48.6);
  });

  it("reads training status from the aggregated Garmin endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          mostRecentTrainingStatus: {
            latestTrainingStatusData: {
              "1": {
                trainingStatusFeedbackPhrase: "MAINTAINING_2",
                primaryTrainingDevice: true,
              },
            },
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new GarminClient(makeSession());
    await expect(client.getTrainingStatusOptional()).resolves.toEqual({
      label: "Bibehåller",
      feedbackPhrase: "MAINTAINING_2",
    });

    expect(fetchMock.mock.calls[0]?.[0]).toMatch(
      /\/metrics-service\/metrics\/trainingstatus\/aggregated\/\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("reads fitness age from the fitnessage endpoint", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          chronologicalAge: 32,
          fitnessAge: 28,
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const client = new GarminClient(makeSession());
    await expect(client.getFitnessAgeOptional()).resolves.toEqual({
      fitnessAge: 28,
      chronologicalAge: 32,
    });

    expect(fetchMock.mock.calls[0]?.[0]).toMatch(
      /\/fitnessage-service\/fitnessage\/\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("uses the same weight range endpoint as python-garminconnect", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
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

  it("uses Garmin activity detail endpoints", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementation(
        async () => new Response(JSON.stringify({}), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const client = new GarminClient(makeSession());
    await client.getActivitySummary("24012623261");
    await client.getActivityDetails("24012623261");
    await client.getActivitySplits("24012623261");
    await client.getActivityHrZones("24012623261");
    await client.getActivityWeather("24012623261");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://connectapi.garmin.com/activity-service/activity/24012623261",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://connectapi.garmin.com/activity-service/activity/24012623261/details?maxChartSize=2000&maxPolylineSize=4000",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://connectapi.garmin.com/activity-service/activity/24012623261/splits",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://connectapi.garmin.com/activity-service/activity/24012623261/hrTimeInZones",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://connectapi.garmin.com/activity-service/activity/24012623261/weather",
      expect.any(Object),
    );
  });

  it("reads personal records from the Connect PR endpoint", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ displayName: "runner.name" }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            { typeId: 3, value: 1344.68, activityId: 1 },
            { typeId: 4, value: 2779.44, activityId: 2 },
            { typeId: 5, value: 6435.24, activityId: 3 },
            { typeId: 7, value: 21709.04, activityId: 4 },
          ]),
          { status: 200 },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const client = new GarminClient(makeSession());
    await expect(client.getPersonalRecordsOptional()).resolves.toEqual({
      time1K: null,
      timeMile: null,
      time5K: 1344.68,
      time10K: 2779.44,
      timeHalfMarathon: 6435.24,
      timeMarathon: null,
      longestRunM: 21709.04,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://connectapi.garmin.com/personalrecord-service/personalrecord/prs/runner.name",
      expect.any(Object),
    );
  });
});
