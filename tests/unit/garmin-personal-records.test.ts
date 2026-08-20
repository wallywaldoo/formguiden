import { describe, expect, it } from "vitest";

import { formatRaceClock } from "@/lib/analytics/race-estimates";
import { readGarminFitnessMetadata } from "@/lib/garmin/fitness";
import { parseGarminPersonalRecords } from "@/lib/garmin/personal-records";

describe("parseGarminPersonalRecords", () => {
  it("maps Garmin type ids to running records", () => {
    expect(
      parseGarminPersonalRecords([
        { type_id: 1, raw_value: 189.95 },
        { typeId: 3, value: 1344.68 },
        { typeId: 4, value: 2779.44 },
        { typeId: 5, value: 6435.24 },
        { typeId: 7, value: 21709.04 },
        { typeId: 12, value: 36354 },
      ]),
    ).toEqual({
      time1K: 189.95,
      timeMile: null,
      time5K: 1344.68,
      time10K: 2779.44,
      timeHalfMarathon: 6435.24,
      timeMarathon: null,
      longestRunM: 21709.04,
    });
  });

  it("returns null when no running records are present", () => {
    expect(
      parseGarminPersonalRecords([{ typeId: 12, value: 36354 }]),
    ).toBeNull();
    expect(parseGarminPersonalRecords(null)).toBeNull();
  });
});

describe("readGarminFitnessMetadata", () => {
  it("reads stored personal records from integration metadata", () => {
    const fitness = readGarminFitnessMetadata({
      fitness: {
        syncedAt: "2026-08-19T10:00:00.000Z",
        vo2Max: 48.2,
        trainingStatus: "Produktiv",
        fitnessAge: 28,
        chronologicalAge: 32,
        racePredictions: null,
        personalRecords: {
          time1K: 189.95,
          timeMile: 313.42,
          time5K: 1344.68,
          time10K: 2779.44,
          timeHalfMarathon: 6435.24,
          timeMarathon: null,
          longestRunM: 21709.04,
        },
      },
    });
    expect(fitness?.personalRecords?.time5K).toBe(1344.68);
    expect(fitness?.trainingStatus).toBe("Produktiv");
    expect(fitness?.vo2Max).toBe(48.2);
    expect(fitness?.fitnessAge).toBe(28);
    expect(fitness?.chronologicalAge).toBe(32);
    expect(formatRaceClock(fitness!.personalRecords!.timeHalfMarathon!)).toBe(
      "1:47:15",
    );
  });
});
