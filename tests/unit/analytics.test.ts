import { describe, expect, it } from "vitest";

import { dataCompleteness } from "@/lib/analytics/completeness";
import { isoWeekStart, toLocalDate } from "@/lib/analytics/dates";
import { primaryAction } from "@/lib/analytics/primary-action";
import { bodyWeightTrend } from "@/lib/analytics/body";
import { strengthFrequency } from "@/lib/analytics/strength";
import { hrvBaseline, sleepDurationMean } from "@/lib/analytics/recovery";
import {
  goalPaceGap,
  intensityDistribution,
  longRunConsistency,
  weeklyRunDistance,
} from "@/lib/analytics/running";
import { median } from "@/lib/analytics/stats";
import type {
  ActivityPoint,
  AnalyticsContext,
  HealthPoint,
} from "@/lib/analytics/types";

const now = new Date("2026-04-12T12:00:00.000Z");
const context: AnalyticsContext = {
  timeZone: "Europe/Stockholm",
  now,
  goal: {
    weeklyRunDistanceM: 40_000,
    targetPaceSPerKm: 256,
    targetMassKg: 72,
  },
};

function run(
  overrides: Partial<ActivityPoint> & Pick<ActivityPoint, "id" | "startedAt">,
): ActivityPoint {
  return {
    activityType: "run",
    distanceM: 10_000,
    durationS: 3000,
    avgPaceSPerKm: 300,
    avgHeartRateBpm: 150,
    ...overrides,
  };
}

describe("analytics dates", () => {
  it("converts ISO timestamps to Europe/Stockholm calendar dates", () => {
    expect(toLocalDate("2026-04-12T07:00:00.000Z", "Europe/Stockholm")).toBe(
      "2026-04-12",
    );
  });

  it("uses Monday as ISO week start", () => {
    expect(isoWeekStart("2026-04-12")).toBe("2026-04-06");
  });
});

describe("running formulas", () => {
  it("sums weekly run distance and excludes missing distances from the sum", () => {
    const activities = [
      run({
        id: "1",
        startedAt: "2026-04-12T07:00:00.000Z",
        distanceM: 10_000,
      }),
      run({ id: "2", startedAt: "2026-04-11T07:00:00.000Z", distanceM: null }),
      run({
        id: "3",
        startedAt: "2026-04-05T07:00:00.000Z",
        distanceM: 21_097.5,
      }),
    ];
    const result = weeklyRunDistance(activities, context);
    expect(result.value).toBe(10_000);
    expect(result.completeness).toBe(0.5);
  });

  it("counts long-run weeks at 30% of weekly target", () => {
    const activities = [
      run({
        id: "1",
        startedAt: "2026-04-12T07:00:00.000Z",
        distanceM: 12_000,
      }),
      run({
        id: "2",
        startedAt: "2026-04-04T07:00:00.000Z",
        distanceM: 5_000,
      }),
    ];
    const result = longRunConsistency(activities, context);
    expect(result.value).toBe(1);
    expect(result.completeness).toBe(0.5);
  });

  it("buckets intensity against target pace 4:16", () => {
    const activities = [
      run({
        id: "easy",
        startedAt: "2026-04-12T07:00:00.000Z",
        avgPaceSPerKm: 330,
      }),
      run({
        id: "goal",
        startedAt: "2026-04-11T07:00:00.000Z",
        avgPaceSPerKm: 256,
      }),
      run({
        id: "fast",
        startedAt: "2026-04-10T07:00:00.000Z",
        avgPaceSPerKm: 230,
      }),
      run({
        id: "no-pace",
        startedAt: "2026-04-09T07:00:00.000Z",
        avgPaceSPerKm: null,
      }),
    ];
    const result = intensityDistribution(activities, context);
    expect(result.value).toEqual({ easy: 1, target: 1, fast: 1 });
    expect(result.completeness).toBe(0.75);
  });

  it("computes goal-pace gap from a representative 5 km+ run", () => {
    const activities = [
      run({
        id: "short",
        startedAt: "2026-04-12T07:00:00.000Z",
        distanceM: 3_000,
        avgPaceSPerKm: 400,
      }),
      run({
        id: "rep",
        startedAt: "2026-04-11T07:00:00.000Z",
        distanceM: 10_000,
        avgPaceSPerKm: 280,
      }),
    ];
    const result = goalPaceGap(activities, context);
    expect(result.value).toBe(24);
  });
});

describe("recovery and body", () => {
  it("averages sleep over nights with data and reports 7-day completeness", () => {
    const health: HealthPoint[] = [
      {
        localDate: "2026-04-12",
        sleepDurationS: 7 * 3600,
        sleepStartAt: "2026-04-11T22:00:00.000Z",
        hrvRmssdMs: null,
        restingHeartRateBpm: null,
        steps: null,
        stressAvg: null,
        bodyBatteryHigh: null,
        bodyBatteryLow: null,
      },
      {
        localDate: "2026-04-11",
        sleepDurationS: 8 * 3600,
        sleepStartAt: null,
        hrvRmssdMs: null,
        restingHeartRateBpm: null,
        steps: null,
        stressAvg: null,
        bodyBatteryHigh: null,
        bodyBatteryLow: null,
      },
    ];
    const result = sleepDurationMean(health, context);
    expect(result.value).toBe(((7 + 8) * 3600) / 2);
    expect(result.completeness).toBeCloseTo(2 / 7);
  });

  it("requires 14 HRV points for a baseline", () => {
    const health: HealthPoint[] = Array.from({ length: 13 }, (_, index) => {
      const date = new Date(Date.UTC(2026, 3, 12));
      date.setUTCDate(date.getUTCDate() - index);
      return {
        localDate: date.toISOString().slice(0, 10),
        sleepDurationS: null,
        sleepStartAt: null,
        hrvRmssdMs: 40,
        restingHeartRateBpm: null,
        steps: null,
        stressAvg: null,
        bodyBatteryHigh: null,
        bodyBatteryLow: null,
      };
    });
    expect(hrvBaseline(health, context).value).toBeNull();
    health.push({
      localDate: "2026-03-30",
      sleepDurationS: null,
      sleepStartAt: null,
      hrvRmssdMs: 50,
      restingHeartRateBpm: null,
      steps: null,
      stressAvg: null,
      bodyBatteryHigh: null,
      bodyBatteryLow: null,
    });
    expect(
      median([40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 40, 50]),
    ).toBe(40);
    expect(hrvBaseline(health, context).value).toBe(40);
  });

  it("reports body-weight slope in kg per week", () => {
    const points = [
      { measuredAt: "2026-03-16T07:00:00.000Z", massKg: 74, bodyFatPct: null },
      {
        measuredAt: "2026-03-23T07:00:00.000Z",
        massKg: 73.5,
        bodyFatPct: null,
      },
      { measuredAt: "2026-03-30T07:00:00.000Z", massKg: 73, bodyFatPct: null },
      {
        measuredAt: "2026-04-06T07:00:00.000Z",
        massKg: 72.5,
        bodyFatPct: null,
      },
    ];
    const result = bodyWeightTrend(points, context);
    expect(result.value).toBeCloseTo(-0.5, 5);
  });
});

describe("completeness and primary action", () => {
  it("always returns a completeness fraction between 0 and 1", () => {
    const empty = { value: null, completeness: 0, explanationKey: "x" };
    const result = dataCompleteness({
      weeklyDistance: empty,
      paceGap: empty,
      sleep: empty,
      hrv: empty,
      rhr: empty,
      body: empty,
    });
    expect(result.value).toBe(0);
  });

  it("points empty accounts to Garmin file import", () => {
    const action = primaryAction({
      activities: [],
      pendingImportId: null,
      completeness: {
        value: 0,
        completeness: 1,
        explanationKey: "data_completeness",
      },
      paceGap: {
        value: null,
        completeness: 0,
        explanationKey: "goal_pace_gap",
      },
    });
    expect(action.href).toBe("/import");
  });
});

describe("strength frequency", () => {
  it("counts sessions in the last 7 local days against the weekly target", () => {
    const result = strengthFrequency(
      [
        { startedAt: "2026-04-12T07:00:00.000Z" },
        { startedAt: "2026-04-10T07:00:00.000Z" },
        { startedAt: "2026-04-01T07:00:00.000Z" },
      ],
      context,
      3,
    );
    expect(result.value).toBe(2);
    expect(result.completeness).toBeCloseTo(2 / 3);
  });
});
