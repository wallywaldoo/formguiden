import { describe, expect, it } from "vitest";

import type { HealthPoint } from "@/lib/analytics/types";
import {
  buildWeekRecap,
  completedWeeks,
  isMondayRecapDay,
  lastCompletedWeek,
  medalForScore,
  scoreFromRatio,
} from "@/lib/analytics/week-recap";

function night(localDate: string, hours: number, steps = 9_000): HealthPoint {
  return {
    localDate,
    sleepDurationS: hours * 3600,
    sleepStartAt: null,
    hrvRmssdMs: 40,
    restingHeartRateBpm: 52,
    steps,
    stressAvg: null,
    bodyBatteryHigh: null,
    bodyBatteryLow: null,
  };
}

describe("recap week timing", () => {
  it("treats Monday as the recap day for last week", () => {
    expect(isMondayRecapDay("2026-08-17")).toBe(true);
    expect(isMondayRecapDay("2026-08-20")).toBe(false);
    expect(lastCompletedWeek("2026-08-17")).toEqual({
      start: "2026-08-10",
      end: "2026-08-16",
    });
  });

  it("keeps last completed week as the previous ISO week mid-week", () => {
    expect(lastCompletedWeek("2026-08-20")).toEqual({
      start: "2026-08-10",
      end: "2026-08-16",
    });
  });

  it("lists completed weeks newest first", () => {
    expect(completedWeeks("2026-08-17", 2)).toEqual([
      { start: "2026-08-10", end: "2026-08-16" },
      { start: "2026-08-03", end: "2026-08-09" },
    ]);
  });
});

describe("week recap scoring", () => {
  it("maps ratios onto 1–10", () => {
    expect(scoreFromRatio(0)).toBe(1);
    expect(scoreFromRatio(1)).toBe(10);
    expect(scoreFromRatio(0.5)).toBe(6);
  });

  it("awards medals from the overall score", () => {
    expect(medalForScore(10)).toBe("gold");
    expect(medalForScore(8)).toBe("silver");
    expect(medalForScore(6)).toBe("bronze");
    expect(medalForScore(3)).toBe("none");
  });

  it("scores a complete strong week highly", () => {
    const recap = buildWeekRecap({
      weekStart: "2026-08-17",
      weekEnd: "2026-08-23",
      timeZone: "Europe/Stockholm",
      activities: [
        {
          startedAt: "2026-08-17T06:00:00.000Z",
          activityType: "run",
          distanceM: 10_000,
          caloriesKcal: 700,
        },
        {
          startedAt: "2026-08-19T06:00:00.000Z",
          activityType: "run",
          distanceM: 12_000,
          caloriesKcal: 800,
        },
        {
          startedAt: "2026-08-21T06:00:00.000Z",
          activityType: "run",
          distanceM: 18_000,
          caloriesKcal: 1_100,
        },
      ],
      nutrition: [
        "2026-08-17",
        "2026-08-18",
        "2026-08-19",
        "2026-08-20",
        "2026-08-21",
        "2026-08-22",
        "2026-08-23",
      ].flatMap((date) => [{ at: `${date}T08:00:00.000Z`, amount: 2_400 }]),
      hydration: [
        "2026-08-17",
        "2026-08-18",
        "2026-08-19",
        "2026-08-20",
        "2026-08-21",
        "2026-08-22",
        "2026-08-23",
      ].map((date) => ({ at: `${date}T18:00:00.000Z`, amount: 2_600 })),
      health: [
        "2026-08-17",
        "2026-08-18",
        "2026-08-19",
        "2026-08-20",
        "2026-08-21",
        "2026-08-22",
        "2026-08-23",
      ].map((date) => night(date, 7.5)),
      planDays: [
        { localDate: "2026-08-17", kind: "easy_run" },
        { localDate: "2026-08-18", kind: "rest" },
        { localDate: "2026-08-19", kind: "quality_run" },
        { localDate: "2026-08-20", kind: "rest" },
        { localDate: "2026-08-21", kind: "long_run" },
        { localDate: "2026-08-22", kind: "rest" },
        { localDate: "2026-08-23", kind: "rest" },
      ],
      weeklyGoalM: 40_000,
      dailyBudgetKcal: 2_200,
    });

    expect(recap.score).toBeGreaterThanOrEqual(8);
    expect(recap.medal).toMatch(/gold|silver/);
    expect(recap.headline).toMatch(/vecka/);
    expect(recap.dimensions.find((d) => d.key === "sessions")?.score).toBe(10);
    expect(recap.dimensions.find((d) => d.key === "water")?.score).toBe(10);
  });

  it("punishes missing food and water logs", () => {
    const recap = buildWeekRecap({
      weekStart: "2026-08-17",
      weekEnd: "2026-08-23",
      timeZone: "Europe/Stockholm",
      activities: [
        {
          startedAt: "2026-08-17T06:00:00.000Z",
          activityType: "run",
          distanceM: 40_000,
          caloriesKcal: 2_000,
        },
      ],
      nutrition: [],
      hydration: [],
      health: [night("2026-08-17", 7.5)],
      planDays: [{ localDate: "2026-08-17", kind: "easy_run" }],
      weeklyGoalM: 40_000,
      dailyBudgetKcal: 2_200,
    });

    expect(recap.dimensions.find((d) => d.key === "calories")?.score).toBe(1);
    expect(recap.dimensions.find((d) => d.key === "water")?.score).toBe(1);
    expect(recap.score).toBeLessThan(8);
  });

  it("omits sleep and steps when there is no health data", () => {
    const recap = buildWeekRecap({
      weekStart: "2026-08-17",
      weekEnd: "2026-08-23",
      timeZone: "Europe/Stockholm",
      activities: [],
      nutrition: [],
      hydration: [],
      health: [],
      planDays: null,
      weeklyGoalM: null,
      dailyBudgetKcal: null,
    });

    expect(recap.dimensions.map((d) => d.key)).toEqual([
      "sessions",
      "calories",
      "water",
    ]);
  });
});
