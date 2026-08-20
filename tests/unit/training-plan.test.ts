import { describe, expect, it } from "vitest";

import type {
  ActivityPoint,
  AnalyticsContext,
  HealthPoint,
} from "@/lib/analytics/types";
import { isoWeekday } from "@/lib/analytics/dates";
import { applyTodayCaps, fallbackWeek } from "@/lib/training-plan/fallback";
import { clampSessionToKinds } from "@/lib/training-plan/schema";
import {
  allowedKindsFromRules,
  buildTrainingSnapshot,
} from "@/lib/training-plan/snapshot";

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

function night(localDate: string, hours: number): HealthPoint {
  return {
    localDate,
    sleepDurationS: hours * 3600,
    sleepStartAt: null,
    hrvRmssdMs: 40,
    restingHeartRateBpm: 52,
    steps: null,
    stressAvg: null,
    bodyBatteryHigh: null,
    bodyBatteryLow: null,
  };
}

describe("training snapshot caps", () => {
  it("forces recovery after a session today", () => {
    const snapshot = buildTrainingSnapshot({
      activities: [run({ id: "today", startedAt: "2026-04-15T06:00:00.000Z" })],
      health: [night("2026-04-15", 7.5)],
      strengthSessions: [],
      context,
      weeklyStrengthTarget: 2,
      pendingImportId: null,
      distanceUnit: "km",
      raceType: "half_marathon",
      raceDate: null,
      feedback: null,
    });
    expect(snapshot.alreadyTrainedToday).toBe(true);
    expect(snapshot.allowedKinds).toEqual(["active_recovery", "rest"]);
  });

  it("limits intensity after sleep debt and a fast run", () => {
    const snapshot = buildTrainingSnapshot({
      activities: [
        run({
          id: "fast",
          startedAt: "2026-04-14T06:00:00.000Z",
          avgPaceSPerKm: 240,
        }),
      ],
      health: [night("2026-04-15", 5), night("2026-04-14", 5)],
      strengthSessions: [],
      context,
      weeklyStrengthTarget: 2,
      pendingImportId: null,
      distanceUnit: "km",
      raceType: "half_marathon",
      raceDate: null,
      feedback: null,
    });
    expect(snapshot.allowedKinds).toEqual([
      "easy_run",
      "active_recovery",
      "rest",
    ]);
  });
});

describe("training plan fallback", () => {
  it("builds a 7-day week starting Monday", () => {
    const snapshot = buildTrainingSnapshot({
      activities: [run({ id: "mon", startedAt: "2026-04-13T06:00:00.000Z" })],
      health: [night("2026-04-14", 7)],
      strengthSessions: [],
      context,
      weeklyStrengthTarget: 2,
      pendingImportId: null,
      distanceUnit: "km",
      raceType: "half_marathon",
      raceDate: null,
      feedback: null,
    });
    const week = fallbackWeek(snapshot);
    expect(week.weekStart).toBe("2026-04-13");
    expect(week.days).toHaveLength(7);
    expect(week.days[0]?.localDate).toBe("2026-04-13");
    expect(week.days[6]?.kind).toBe("rest");
  });

  it("clamps a quality session when only recovery is allowed", () => {
    const snapshot = buildTrainingSnapshot({
      activities: [run({ id: "today", startedAt: "2026-04-15T07:00:00.000Z" })],
      health: [night("2026-04-15", 8)],
      strengthSessions: [],
      context,
      weeklyStrengthTarget: 2,
      pendingImportId: null,
      distanceUnit: "km",
      raceType: null,
      raceDate: null,
      feedback: null,
    });
    const quality = {
      localDate: snapshot.localDate,
      kind: "quality_run" as const,
      title: "Intervaller",
      durationMin: 50,
      intensity: "hård",
      steps: ["Intervaller"],
      why: ["Test"],
    };
    const clamped = applyTodayCaps(quality, snapshot);
    expect(["active_recovery", "rest"]).toContain(clamped.kind);
  });
});

describe("schema helpers", () => {
  it("keeps an allowed kind", () => {
    const session = {
      localDate: "2026-04-15",
      kind: "easy_run" as const,
      title: "Lätt",
      durationMin: 40,
      intensity: "Z2",
      steps: ["Jogga"],
      why: ["Sömn ok"],
    };
    const fallback = { ...session, kind: "rest" as const, title: "Vila" };
    expect(
      clampSessionToKinds(session, ["easy_run", "rest"], fallback).kind,
    ).toBe("easy_run");
  });

  it("knows Wednesday 15 Apr 2026 is weekday 3", () => {
    expect(isoWeekday("2026-04-15")).toBe(3);
  });
});

describe("allowedKindsFromRules", () => {
  it("opens all kinds without a veto", () => {
    const result = allowedKindsFromRules({
      alreadyTrainedToday: false,
      hoursSinceLastActivity: 30,
      recommendation: null,
    });
    expect(result.allowedKinds).toHaveLength(6);
    expect(result.vetoReason).toBeNull();
  });
});
