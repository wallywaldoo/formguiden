import { describe, expect, it } from "vitest";

import { HALF_MARATHON_DISTANCE_M } from "@/lib/constants";
import {
  calculateTargetPaceSecondsPerKm,
  formatDurationHms,
  formatPaceMinPerKm,
  parseDurationToSeconds,
} from "@/lib/units/pace";

describe("calculateTargetPaceSecondsPerKm", () => {
  it("gives about 4:16 min/km for 1:30 on a half marathon", () => {
    const durationS = parseDurationToSeconds("01:30:00");
    const pace = calculateTargetPaceSecondsPerKm(
      HALF_MARATHON_DISTANCE_M,
      durationS,
    );

    expect(pace).not.toBeNull();
    expect(formatPaceMinPerKm(pace!)).toBe("4:16");
    expect(pace!).toBeCloseTo(255.95, 1);
  });

  it("returns null when duration or distance is missing", () => {
    expect(
      calculateTargetPaceSecondsPerKm(HALF_MARATHON_DISTANCE_M, null),
    ).toBeNull();
    expect(calculateTargetPaceSecondsPerKm(0, 5400)).toBeNull();
  });
});

describe("parseDurationToSeconds", () => {
  it("parses HH:MM:SS and MM:SS", () => {
    expect(parseDurationToSeconds("01:30:00")).toBe(5400);
    expect(parseDurationToSeconds("4:16")).toBe(256);
  });

  it("rejects invalid values", () => {
    expect(parseDurationToSeconds("")).toBeNull();
    expect(parseDurationToSeconds("1:99")).toBeNull();
    expect(parseDurationToSeconds("nope")).toBeNull();
  });
});

describe("formatDurationHms", () => {
  it("zero-pads hours, minutes, and seconds", () => {
    expect(formatDurationHms(5400)).toBe("01:30:00");
  });
});
