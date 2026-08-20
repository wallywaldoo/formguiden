import { describe, expect, it } from "vitest";

import {
  generateCoachResponse,
  summarizeCoachSignals,
} from "@/features/assistant/coach-response";
import type { CoachContextData } from "@/features/assistant/queries";

function makeContext(
  overrides: Partial<CoachContextData> = {},
): CoachContextData {
  return {
    profile: { displayName: "Viktor" },
    preferences: {
      timezone: "Europe/Stockholm",
      distanceUnit: "km",
      elevationUnit: "m",
    },
    goal: {
      raceType: "10k",
      raceDate: "2026-09-01",
      targetPaceSPerKm: 300,
      weeklyRunDistanceM: 40_000,
    },
    activities: [
      {
        id: "run-1",
        activityType: "run",
        startedAt: "2026-08-18T07:00:00.000Z",
        durationS: 4_800,
        distanceM: 14_000,
        avgPaceSPerKm: 295,
        avgHeartRateBpm: 152,
        trainingLoad: 160,
        perceivedEffort: 8,
        notes: "Progression",
      },
    ],
    health: Array.from({ length: 14 }).map((_, index) => ({
      localDate: `2026-08-${String(19 - index).padStart(2, "0")}`,
      sleepDurationS: index === 0 ? 5.8 * 3600 : 7.6 * 3600,
      hrvRmssdMs: index === 0 ? 38 : 52,
      restingHeartRateBpm: index === 0 ? 53 : 48,
      steps: 9_000,
      stressAvg: index === 0 ? 46 : 28,
      bodyBatteryHigh: index === 0 ? 48 : 75,
      bodyBatteryLow: 20,
    })),
    body: [],
    pendingImport: null,
    ...overrides,
  };
}

describe("coach response", () => {
  it("recommends an easier day when recovery signals are weak", () => {
    const result = generateCoachResponse({
      message: "Vad bör jag träna idag?",
      context: makeContext(),
      now: new Date("2026-08-19T08:00:00.000Z"),
    });

    expect(result.reply).toContain("Viktor");
    expect(result.reply).toContain("lätt");
    expect(result.reply).toContain("Hoppa över hårda intervaller");
  });

  it("summarises the latest session when asked", () => {
    const result = generateCoachResponse({
      message: "Hur såg mitt senaste pass ut?",
      context: makeContext(),
      now: new Date("2026-08-19T08:00:00.000Z"),
    });

    expect(result.reply).toContain("Senaste passet var");
    expect(result.reply).toContain("14,0 km");
    expect(result.reply).toContain("Progression");
  });

  it("gracefully handles missing data", () => {
    const result = summarizeCoachSignals({
      context: makeContext({
        activities: [],
        health: [],
      }),
      now: new Date("2026-08-19T08:00:00.000Z"),
    });

    expect(result).toContain("Jag saknar återhämtningsdata");
    expect(result).toContain("inga löppass");
  });
});
