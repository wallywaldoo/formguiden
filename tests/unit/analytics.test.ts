import { describe, expect, it } from "vitest";

import { dataCompleteness } from "@/lib/analytics/completeness";
import { isoWeekStart, toLocalDate } from "@/lib/analytics/dates";
import { primaryAction } from "@/lib/analytics/primary-action";
import { bodyWeightTrend } from "@/lib/analytics/body";
import { strengthFrequency } from "@/lib/analytics/strength";
import { hrvBaseline, sleepDurationMean } from "@/lib/analytics/recovery";
import { buildRaceComparison, buildRaceEstimates } from "@/lib/analytics/race-estimates";
import { dailyEnergyBalance, mifflinStJeorBmr, toIsoDate } from "@/lib/analytics/daily-energy";
import { raceProgress } from "@/lib/analytics/race-progress";
import {
  goalPaceGap,
  historyDistanceSeries,
  intensityDistribution,
  longRunConsistency,
  weeklyRunDistance,
  filterActivitiesByRange,
  weekRunSummary,
} from "@/lib/analytics/running";
import { trainingCue } from "@/lib/analytics/training-cue";
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

  it("filters runs to the selected rolling window", () => {
    const activities = [
      run({ id: "today", startedAt: "2026-04-12T07:00:00.000Z" }),
      run({ id: "two-months", startedAt: "2026-02-20T07:00:00.000Z" }),
      run({ id: "last-year", startedAt: "2025-04-12T07:00:00.000Z" }),
    ];
    expect(
      filterActivitiesByRange(activities, context, "90d").map((item) => item.id),
    ).toEqual(["today", "two-months"]);
    expect(
      filterActivitiesByRange(activities, context, "7d").map((item) => item.id),
    ).toEqual(["today"]);
    expect(filterActivitiesByRange(activities, context, "all")).toHaveLength(3);
  });

  it("summarises the last seven local days", () => {
    const summary = weekRunSummary(
      [
        run({
          id: "1",
          startedAt: "2026-04-12T07:00:00.000Z",
          distanceM: 10_000,
          durationS: 3000,
          avgPaceSPerKm: 300,
        }),
        run({
          id: "2",
          startedAt: "2026-04-04T07:00:00.000Z",
          distanceM: 8_000,
        }),
      ],
      context,
    );
    expect(summary.runCount).toBe(1);
    expect(summary.totalDistanceM).toBe(10_000);
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

describe("history distance series", () => {
  it("starts at the oldest run instead of padding to 90 days", () => {
    const series = historyDistanceSeries(
      [
        run({
          id: "old",
          startedAt: "2026-04-01T07:00:00.000Z",
          distanceM: 5_000,
        }),
        run({
          id: "new",
          startedAt: "2026-04-12T07:00:00.000Z",
          distanceM: 10_000,
        }),
      ],
      context,
    );
    expect(series[0]?.date).toBe("2026-04-01");
    expect(series.at(-1)?.date).toBe("2026-04-12");
    expect(series).toHaveLength(12);
    expect(series[0]?.distanceKm).toBe(5);
  });

  it("buckets long history by ISO week from the first run", () => {
    const series = historyDistanceSeries(
      [
        run({
          id: "old",
          startedAt: "2025-11-01T07:00:00.000Z",
          distanceM: 8_000,
        }),
        run({
          id: "new",
          startedAt: "2026-04-12T07:00:00.000Z",
          distanceM: 10_000,
        }),
      ],
      context,
    );
    expect(series[0]?.date).toBe(isoWeekStart("2025-11-01"));
    expect(series[0]?.distanceKm).toBe(8);
    expect(series.at(-1)?.date).toBe(isoWeekStart("2026-04-12"));
    expect(series.length).toBeGreaterThan(12);
    expect(series.length).toBeLessThan(90);
  });
});

describe("daily energy", () => {
  it("adds activity calories on top of sedentary maintenance", () => {
    const balance = dailyEnergyBalance({
      massKg: 75,
      heightCm: 180,
      birthDate: "1990-01-15",
      sex: "male",
      loggedKcal: 1800,
      activityKcal: 450,
      now: new Date("2026-04-12T12:00:00.000Z"),
    });
    expect(balance).not.toBeNull();
    expect(balance!.maintenanceKcal).toBe(
      Math.round(mifflinStJeorBmr({ massKg: 75, heightCm: 180, ageYears: 36, sex: "male" }) * 1.2),
    );
    expect(balance!.budgetKcal).toBe(balance!.maintenanceKcal + 450);
    expect(balance!.remainingKcal).toBe(balance!.budgetKcal - 1800);
  });

  it("returns null when profile inputs are incomplete", () => {
    expect(
      dailyEnergyBalance({
        massKg: 75,
        heightCm: null,
        birthDate: "1990-01-15",
        sex: "male",
        loggedKcal: 0,
        activityKcal: 0,
        now: new Date("2026-04-12T12:00:00.000Z"),
      }),
    ).toBeNull();
  });

  it("accepts Date and ISO timestamp birth dates from Postgres", () => {
    expect(toIsoDate(new Date("1993-12-24T00:00:00.000Z"))).toBe("1993-12-24");
    expect(toIsoDate("1993-12-24T00:00:00.000Z")).toBe("1993-12-24");
    const balance = dailyEnergyBalance({
      massKg: 84,
      heightCm: 177,
      birthDate: new Date("1993-12-24T00:00:00.000Z"),
      sex: "male",
      loggedKcal: 0,
      activityKcal: 0,
      now: new Date("2026-08-19T12:00:00.000Z"),
    });
    expect(balance).not.toBeNull();
    expect(balance!.remainingKcal).toBe(balance!.budgetKcal);
  });
});

describe("race estimates", () => {
  it("uses Riegel estimates from representative pace, not Garmin predictions", () => {
    const estimates = buildRaceEstimates({
      paceSPerKm: 300,
      goalRaceType: "half_marathon",
    });
    const fiveK = estimates.find((item) => item.key === "5k");
    const tenK = estimates.find((item) => item.key === "10k");
    expect(fiveK?.estimatedS).toBe(1500);
    expect(fiveK?.source).toBe("pace");
    expect(tenK?.estimatedS).toBeCloseTo(1500 * 2 ** 1.06, 5);
    expect(estimates.find((item) => item.key === "half_marathon")?.isGoal).toBe(
      true,
    );
  });

  it("returns empty clocks when pace is missing", () => {
    const estimates = buildRaceEstimates({
      paceSPerKm: null,
      goalRaceType: "10k",
    });
    expect(estimates.find((item) => item.key === "10k")?.estimatedS).toBeNull();
    expect(estimates.find((item) => item.key === "10k")?.source).toBeNull();
  });

  it("lines estimated times up with Garmin records by distance", () => {
    const rows = buildRaceComparison({
      paceSPerKm: 300,
      goalRaceType: "half_marathon",
      records: {
        time1K: 189.95,
        timeMile: 313,
        time5K: 1344.68,
        time10K: 2779.44,
        timeHalfMarathon: 6435.24,
        timeMarathon: null,
        longestRunM: 21709,
      },
    });
    expect(rows.map((row) => row.key)).toEqual([
      "1k",
      "5k",
      "10k",
      "half_marathon",
      "marathon",
    ]);
    expect(rows.find((row) => row.key === "5k")?.recordS).toBe(1344.68);
    expect(rows.find((row) => row.key === "5k")?.estimatedS).toBe(1500);
    expect(rows.find((row) => row.key === "marathon")?.recordS).toBeNull();
    expect(rows.find((row) => row.key === "half_marathon")?.isGoal).toBe(true);
  });
});

describe("race progress", () => {
  it("compares predicted half marathon time against a 1:30 goal", () => {
    const progress = raceProgress({
      raceType: "half_marathon",
      raceDistanceM: 21_097.5,
      targetDurationS: 90 * 60,
      targetPaceSPerKm: null,
      currentPaceSPerKm: 270,
    });
    expect(progress?.label).toBe("Halvmaraton");
    expect(progress?.targetLabel).toBe("1:30");
    expect(progress?.ratio).toBeCloseTo(5400 / (270 * 21.0975), 5);
    expect(progress?.ratio).toBeLessThan(1);
  });

  it("is complete when current pace is already faster than target", () => {
    const progress = raceProgress({
      raceType: "half_marathon",
      raceDistanceM: 21_097.5,
      targetDurationS: 90 * 60,
      targetPaceSPerKm: null,
      currentPaceSPerKm: 240,
    });
    expect(progress?.ratio).toBe(1);
    expect(progress?.detail).toContain("Före målet");
  });
});

describe("training cue", () => {
  const action = {
    href: "/running",
    label: "Öppna löpning",
    reason: "Veckan ligger efter målet.",
  };

  it("suggests recovery shortly after a run", () => {
    const cue = trainingCue({
      action,
      recommendation: null,
      lastRunAt: "2026-04-12T08:00:00.000Z",
      now,
    });
    expect(cue.label).toBe("Återhämtning");
    expect(cue.href).toBe("/recovery");
  });

  it("maps a recovery recommendation to rest", () => {
    const cue = trainingCue({
      action: { ...action, href: "/recovery", label: "Ta en lugn dag" },
      recommendation: {
        ruleId: "sleep_debt_limit_intensity",
        actionKey: "recovery_easy_day",
        actionSv: "Ta en lugn dag",
        href: "/recovery",
        comparisonPeriodDays: 7,
        completeness: 1,
        confidence: "medium",
        disclaimerKey: "d",
        signals: [],
        formulaKeys: [],
        priority: 1,
      },
      lastRunAt: "2026-04-10T07:00:00.000Z",
      now,
    });
    expect(cue.label).toBe("Vila");
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
