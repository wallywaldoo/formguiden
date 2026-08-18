import { describe, expect, it } from "vitest";

import { NotEligibleError } from "@/lib/import/adapters/types";
import { garminApiAdapter } from "@/lib/import/adapters/garmin-api";
import { parseCsv } from "@/lib/import/csv/parse";
import { parseFit } from "@/lib/import/fit/parse";
import { parseGpx } from "@/lib/import/gpx/parse";
import { parseTcx } from "@/lib/import/tcx/parse";
import { inspectAndParse } from "@/lib/import/parse-bytes";

import { encodeActivityFit, readFixture } from "../import-fixtures/helpers";

describe("import parsers", () => {
  it("parses a Garmin activity FIT encoded with the official SDK", () => {
    const parsed = parseFit(encodeActivityFit());
    expect(parsed.activities).toHaveLength(1);
    expect(parsed.activities[0]?.activityType).toBe("run");
    expect(parsed.activities[0]?.distanceM).toBeCloseTo(21097.5, 1);
    expect(parsed.activities[0]?.durationS).toBe(5400);
    expect(parsed.activities[0]?.avgHeartRateBpm).toBe(152);
    expect(parsed.activities[0]?.laps.length).toBeGreaterThan(0);
  });

  it("parses TCX distance, duration, pace and heart rate", () => {
    const parsed = parseTcx(readFixture("activity.tcx"));
    expect(parsed.activities).toHaveLength(1);
    const activity = parsed.activities[0]!;
    expect(activity.activityType).toBe("run");
    expect(activity.distanceM).toBe(21097.5);
    expect(activity.durationS).toBe(5400);
    expect(activity.avgPaceSPerKm).toBeCloseTo(256, 0);
    expect(activity.avgHeartRateBpm).toBe(152);
    expect(activity.notes).toBe("Halvmaratonpass");
  });

  it("parses GPX track points with haversine distance", () => {
    const parsed = parseGpx(readFixture("activity.gpx"));
    expect(parsed.activities).toHaveLength(1);
    expect(parsed.activities[0]?.durationS).toBe(600);
    expect(parsed.activities[0]?.distanceM).toBeGreaterThan(1000);
    expect(
      parsed.warnings.some((warning) => warning.code === "gpx_no_hr"),
    ).toBe(true);
  });

  it("parses a Garmin-style activity CSV", () => {
    const parsed = parseCsv(readFixture("activities.csv"));
    expect(parsed.activities).toHaveLength(2);
    expect(parsed.activities[0]?.activityType).toBe("run");
    expect(parsed.activities[0]?.distanceM).toBe(10000);
    expect(parsed.activities[0]?.durationS).toBe(3000);
    expect(parsed.activities[1]?.activityType).toBe("trail_run");
  });

  it("parses a weight CSV without activity type", () => {
    const parsed = parseCsv(readFixture("weight.csv"));
    expect(parsed.bodyMeasurements).toHaveLength(1);
    expect(parsed.bodyMeasurements[0]?.massKg).toBeCloseTo(72.4);
  });

  it("does not expand external XML entities", () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Running">
      <Id>2026-04-12T07:00:00Z</Id>
      <Notes>&xxe;</Notes>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;
    const parsed = parseTcx(new TextEncoder().encode(xml));
    const notes = parsed.activities[0]?.notes ?? "";
    expect(notes).not.toMatch(/root:/);
  });

  it("leaves the Garmin API adapter unwired", () => {
    expect(garminApiAdapter.detect(new Uint8Array([1, 2, 3, 4]))).toBeNull();
    expect(() =>
      garminApiAdapter.parse(new Uint8Array([1, 2, 3, 4]), { fileKind: "fit" }),
    ).toThrow(NotEligibleError);
  });

  it("inspects bytes without trusting ZIP contents as a single activity", async () => {
    const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const inspected = await inspectAndParse(zipHeader);
    expect(inspected.kind).toBe("zip");
    expect(inspected.parse.activities).toEqual([]);
  });
});
