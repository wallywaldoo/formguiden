import { describe, expect, it } from "vitest";

import {
  PACE_GAP_RECOMMENDATION_S,
  SLEEP_DEBT_THRESHOLD_S,
  evaluateRecommendation,
} from "@/lib/recommendations/rules";
import type {
  ActivityPoint,
  AnalyticsContext,
  HealthPoint,
} from "@/lib/analytics/types";

const now = new Date("2026-04-15T12:00:00.000Z");
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

describe("recommendation rules", () => {
  it("prioritises sleep debt over weekly volume", () => {
    const health: HealthPoint[] = [
      {
        localDate: "2026-04-15",
        sleepDurationS: 5 * 3600,
        sleepStartAt: null,
        hrvRmssdMs: null,
        restingHeartRateBpm: null,
        steps: null,
        stressAvg: null,
        bodyBatteryHigh: null,
        bodyBatteryLow: null,
      },
      {
        localDate: "2026-04-14",
        sleepDurationS: 5 * 3600,
        sleepStartAt: null,
        hrvRmssdMs: null,
        restingHeartRateBpm: null,
        steps: null,
        stressAvg: null,
        bodyBatteryHigh: null,
        bodyBatteryLow: null,
      },
    ];
    const activities = [
      run({
        id: "fast",
        startedAt: "2026-04-15T06:00:00.000Z",
        avgPaceSPerKm: 240,
        distanceM: 8000,
      }),
    ];
    const result = evaluateRecommendation({
      activities,
      health,
      body: [],
      strengthSessions: [],
      context,
      weeklyStrengthTarget: 2,
      pendingImportId: null,
    });
    expect(result?.ruleId).toBe("sleep_debt_limit_intensity");
    expect(result?.signals[0]?.observedValue ?? 0).toBeLessThan(
      SLEEP_DEBT_THRESHOLD_S / 3600,
    );
  });

  it("flags weekly volume behind mid-week", () => {
    const result = evaluateRecommendation({
      activities: [
        run({
          id: "short",
          startedAt: "2026-04-14T06:00:00.000Z",
          distanceM: 3000,
        }),
      ],
      health: [],
      body: [],
      strengthSessions: [],
      context,
      weeklyStrengthTarget: null,
      pendingImportId: null,
    });
    expect(result?.ruleId).toBe("weekly_volume_behind");
  });

  it("suggests pace review when gap exceeds threshold", () => {
    const result = evaluateRecommendation({
      activities: [
        run({
          id: "slow",
          startedAt: "2026-04-14T06:00:00.000Z",
          distanceM: 10_000,
          avgPaceSPerKm: 256 + PACE_GAP_RECOMMENDATION_S + 5,
        }),
        run({
          id: "volume",
          startedAt: "2026-04-13T06:00:00.000Z",
          distanceM: 20_000,
          avgPaceSPerKm: 280,
        }),
        run({
          id: "volume2",
          startedAt: "2026-04-12T06:00:00.000Z",
          distanceM: 20_000,
          avgPaceSPerKm: 280,
        }),
      ],
      health: Array.from({ length: 7 }).map((_, index) => ({
        localDate: `2026-04-${String(9 + index).padStart(2, "0")}`,
        sleepDurationS: 8 * 3600,
        sleepStartAt: null,
        hrvRmssdMs: 50,
        restingHeartRateBpm: 48,
        steps: 8000,
        stressAvg: null,
        bodyBatteryHigh: null,
        bodyBatteryLow: null,
      })),
      body: [],
      strengthSessions: [{ startedAt: "2026-04-12T07:00:00.000Z" }],
      context,
      weeklyStrengthTarget: null,
      pendingImportId: null,
    });
    expect(result?.ruleId).toBe("pace_gap_review");
  });

  it("returns null while an import preview is pending", () => {
    const result = evaluateRecommendation({
      activities: [run({ id: "1", startedAt: "2026-04-14T06:00:00.000Z" })],
      health: [],
      body: [],
      strengthSessions: [],
      context,
      weeklyStrengthTarget: null,
      pendingImportId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result).toBeNull();
  });
});
