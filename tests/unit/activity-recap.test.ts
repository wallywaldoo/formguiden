import { describe, expect, it } from "vitest";

import type { ActivityAnalysis } from "@/lib/analytics/activity-detail";
import {
  buildRuleActivityRecap,
  classifyPlanFit,
  inferExecutedKind,
  plannedSessionForDate,
  type ActivityRecapFacts,
} from "@/lib/analytics/activity-recap";
import type { DailySession, WeekPlan } from "@/lib/training-plan/schema";

function session(
  overrides: Partial<DailySession> & Pick<DailySession, "kind" | "title">,
): DailySession {
  return {
    localDate: "2026-08-20",
    durationMin: 45,
    intensity: "Z2 / prattempo",
    steps: ["Håll det lätt"],
    why: ["Baserat på veckoplanen."],
    ...overrides,
  };
}

function analysis(
  overrides: Partial<{
    halves: ActivityAnalysis["halves"];
    compare: ActivityAnalysis["compare"];
    insights: string[];
    hrZoneShare: ActivityAnalysis["hrZoneShare"];
    pace: ActivityAnalysis["pace"];
    cadence: ActivityAnalysis["cadence"];
  }> = {},
): ActivityRecapFacts["analysis"] {
  return {
    halves: {
      firstPaceSPerKm: 330,
      secondPaceSPerKm: 328,
      firstHr: 142,
      secondHr: 146,
      splitDeltaS: 2,
      splitKind: "even",
      decouplingPct: 2,
      ...overrides.halves,
    },
    compare: {
      sampleSize: 4,
      paceDeltaS: -4,
      hrDeltaBpm: 1,
      similarPaceSPerKm: 334,
      similarHr: 145,
      ...overrides.compare,
    },
    insights: overrides.insights ?? ["Jämn split och stabil puls."],
    hrZoneShare: overrides.hrZoneShare ?? [
      { zone: 1, secs: 120, pct: 8 },
      { zone: 2, secs: 1200, pct: 80 },
      { zone: 3, secs: 180, pct: 12 },
      { zone: 4, secs: 0, pct: 0 },
      { zone: 5, secs: 0, pct: 0 },
    ],
    pace: {
      avg: 330,
      min: 310,
      max: 350,
      median: 329,
      stdDev: 8,
      cvPct: 2.4,
      ...overrides.pace,
    },
    cadence: {
      avg: 172,
      min: 168,
      max: 176,
      median: 172,
      stdDev: 2,
      cvPct: 1.1,
      ...overrides.cadence,
    },
  };
}

describe("activity recap plan fit", () => {
  it("marks an easy run of similar duration as followed", () => {
    const executedKind = inferExecutedKind({
      activityType: "run",
      durationS: 45 * 60,
      distanceM: 8_000,
      hrZoneShare: analysis().hrZoneShare,
    });
    expect(executedKind).toBe("easy_run");
    expect(
      classifyPlanFit({
        planned: session({ kind: "easy_run", title: "Lätt löpning 45 min" }),
        executedKind,
        durationS: 45 * 60,
      }).fit,
    ).toBe("followed");
  });

  it("treats a quality session on a rest day as missed", () => {
    expect(
      classifyPlanFit({
        planned: session({
          kind: "rest",
          title: "Vila",
          durationMin: 0,
        }),
        executedKind: "quality_run",
        durationS: 50 * 60,
      }).fit,
    ).toBe("missed");
  });

  it("restores the original weekday plan after a completed-day rewrite", () => {
    const week: WeekPlan = {
      weekStart: "2026-08-17",
      days: Array.from({ length: 7 }, (_, index) =>
        session({
          localDate: `2026-08-${String(17 + index).padStart(2, "0")}`,
          kind: index === 3 || index === 4 ? "active_recovery" : "rest",
          title: index === 3 || index === 4 ? "Aktiv vila 30 min" : "Vila",
          durationMin: index === 3 || index === 4 ? 30 : 0,
        }),
      ),
    };
    expect(plannedSessionForDate(week, "2026-08-20")?.kind).toBe("easy_run");
    expect(plannedSessionForDate(week, "2026-08-21")?.kind).toBe(
      "active_recovery",
    );
  });
});

describe("rule activity recap", () => {
  it("scores a plan-matching even run highly", () => {
    const recap = buildRuleActivityRecap({
      activityId: "run-1",
      activityType: "run",
      localDate: "2026-08-20",
      durationS: 45 * 60,
      distanceM: 8_000,
      paceSPerKm: 330,
      avgHeartRateBpm: 144,
      planned: session({ kind: "easy_run", title: "Lätt löpning 45 min" }),
      analysis: analysis(),
    });
    expect(recap.planFit).toBe("followed");
    expect(recap.score).toBeGreaterThanOrEqual(8);
    expect(recap.score).toBeLessThanOrEqual(10);
    expect(recap.headline.length).toBeGreaterThan(0);
  });

  it("clamps a messy off-plan session to 1–10", () => {
    const recap = buildRuleActivityRecap({
      activityId: "run-2",
      activityType: "run",
      localDate: "2026-08-20",
      durationS: 20 * 60,
      distanceM: 3_000,
      paceSPerKm: 420,
      avgHeartRateBpm: 168,
      planned: session({
        kind: "rest",
        title: "Vila",
        durationMin: 0,
      }),
      analysis: analysis({
        halves: {
          firstPaceSPerKm: 380,
          secondPaceSPerKm: 460,
          firstHr: 150,
          secondHr: 172,
          splitDeltaS: 80,
          splitKind: "positive",
          decouplingPct: 12,
        },
        compare: {
          sampleSize: 3,
          paceDeltaS: 40,
          hrDeltaBpm: 12,
          similarPaceSPerKm: 380,
          similarHr: 156,
        },
        insights: ["Positiv split och hög puls mot slutet."],
        hrZoneShare: [
          { zone: 1, secs: 0, pct: 0 },
          { zone: 2, secs: 120, pct: 10 },
          { zone: 3, secs: 180, pct: 15 },
          { zone: 4, secs: 600, pct: 50 },
          { zone: 5, secs: 300, pct: 25 },
        ],
      }),
    });
    expect(recap.planFit).toBe("missed");
    expect(recap.score).toBeGreaterThanOrEqual(1);
    expect(recap.score).toBeLessThanOrEqual(10);
  });

  it("labels a session without a plan as unplanned", () => {
    const recap = buildRuleActivityRecap({
      activityId: "run-3",
      activityType: "run",
      localDate: "2026-08-20",
      durationS: 40 * 60,
      distanceM: 7_000,
      paceSPerKm: 340,
      avgHeartRateBpm: 148,
      planned: null,
      analysis: analysis({ insights: [] }),
    });
    expect(recap.planFit).toBe("unplanned");
    expect(recap.planFitLabel).toBe("Utanför planen");
  });
});
