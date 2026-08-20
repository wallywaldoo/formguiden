import { describe, expect, it } from "vitest";

import { analyzeActivity } from "@/lib/analytics/activity-detail";

function sample(overrides: {
  elapsedS: number;
  distanceM: number;
  heartRateBpm?: number;
  cadence?: number;
  speedMps?: number;
}) {
  const speedMps = overrides.speedMps ?? 3.2;
  return {
    elapsedS: overrides.elapsedS,
    distanceM: overrides.distanceM,
    heartRateBpm: overrides.heartRateBpm ?? 150,
    cadence: overrides.cadence ?? 170,
    speedMps,
    altitudeM: 20,
    powerW: null,
    temperatureC: 12,
  };
}

function evenRun(distanceM: number, paceSPerKm: number, hr: number) {
  const speed = 1000 / paceSPerKm;
  const points = [];
  for (let meters = 0; meters <= distanceM; meters += 25) {
    points.push(
      sample({
        elapsedS: (meters / 1000) * paceSPerKm,
        distanceM: meters,
        speedMps: speed,
        heartRateBpm: hr,
      }),
    );
  }
  return points;
}

describe("activity detail analysis", () => {
  it("builds kilometer splits and a negative split", () => {
    const first = evenRun(2500, 360, 145);
    const second = evenRun(2500, 330, 148).map((point) => ({
      ...point,
      elapsedS: (point.elapsedS ?? 0) + 900,
      distanceM: (point.distanceM ?? 0) + 2500,
    }));
    const analysis = analyzeActivity({
      samples: [...first, ...second],
      laps: [],
      durationS: 1725,
      movingDurationS: 1720,
      elapsedDurationS: 1740,
      distanceM: 5000,
      paceSPerKm: 345,
      avgHeartRateBpm: 146,
      maxHeartRateBpm: 168,
      elevationGainM: 12,
      elevationLossM: 10,
      recentRuns: [],
    });

    expect(analysis.kmSplits.length).toBeGreaterThanOrEqual(4);
    expect(analysis.halves.splitKind).toBe("negative");
    expect(analysis.bestEfforts.some((row) => row.label === "1 km")).toBe(true);
    expect(analysis.pauseS).toBe(20);
  });

  it("compares pace against similar recent runs and flags a positive split", () => {
    const analysis = analyzeActivity({
      samples: evenRun(4000, 400, 155).concat(
        evenRun(4000, 460, 168).map((point) => ({
          ...point,
          elapsedS: (point.elapsedS ?? 0) + 1600,
          distanceM: (point.distanceM ?? 0) + 4000,
        })),
      ),
      laps: [],
      durationS: 3440,
      movingDurationS: 3440,
      elapsedDurationS: 3440,
      distanceM: 8000,
      paceSPerKm: 430,
      avgHeartRateBpm: 160,
      maxHeartRateBpm: 178,
      elevationGainM: 8,
      elevationLossM: 8,
      recentRuns: [
        {
          id: "a",
          startedAt: "2026-08-01T07:00:00.000Z",
          distanceM: 8000,
          durationS: 3200,
          paceSPerKm: 400,
          avgHeartRateBpm: 152,
        },
        {
          id: "b",
          startedAt: "2026-08-08T07:00:00.000Z",
          distanceM: 8200,
          durationS: 3280,
          paceSPerKm: 400,
          avgHeartRateBpm: 150,
        },
        {
          id: "c",
          startedAt: "2026-08-12T07:00:00.000Z",
          distanceM: 7900,
          durationS: 3160,
          paceSPerKm: 400,
          avgHeartRateBpm: 151,
        },
      ],
    });

    expect(analysis.halves.splitKind).toBe("positive");
    expect(analysis.compare.sampleSize).toBe(3);
    expect(analysis.compare.paceDeltaS).toBeGreaterThan(20);
    expect(analysis.insights.some((row) => row.toLowerCase().includes("positiv"))).toBe(
      true,
    );
  });
});
