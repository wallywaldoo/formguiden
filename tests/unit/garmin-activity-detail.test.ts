import { describe, expect, it } from "vitest";

import {
  downsample,
  toLatitude,
  toLongitude,
  weatherTempToCelsius,
} from "@/lib/garmin/geo";
import {
  parseGarminHrZones,
  parseGarminPolyline,
  parseGarminSplits,
  parseGarminSummary,
  parseGarminWeather,
} from "@/lib/garmin/payload";

describe("garmin geo helpers", () => {
  it("keeps degree coordinates and converts FIT semicircles", () => {
    expect(toLatitude(57.7)).toBeCloseTo(57.7, 5);
    expect(toLongitude(11.97)).toBeCloseTo(11.97, 5);
    expect(toLatitude(688_000_000)).toBeCloseTo(57.6, 0);
    expect(toLatitude(999_999_999_999)).toBeNull();
  });

  it("treats Garmin weather Fahrenheit as Celsius when needed", () => {
    expect(weatherTempToCelsius(64, "F")).toBeCloseTo(17.8, 1);
    expect(weatherTempToCelsius(17.8, "C")).toBeCloseTo(17.8, 1);
    expect(weatherTempToCelsius(64)).toBeCloseTo(17.8, 1);
  });

  it("downsamples long series while keeping endpoints", () => {
    const items = Array.from({ length: 11 }, (_, index) => index);
    expect(downsample(items, 5)).toEqual([0, 3, 5, 8, 10]);
  });
});

describe("garmin activity parsers", () => {
  it("reads nested Garmin summaryDTO fields", () => {
    const parsed = parseGarminSummary({
      activityName: "Göteborg Löpning",
      summaryDTO: {
        movingDuration: 2287.8,
        elapsedDuration: 2289.6,
        averageSpeed: 2.62,
        maxSpeed: 3.25,
        minHR: 96,
        maxRunCadence: 165,
        avgStrideLength: 99,
        steps: 6054,
        aerobicTrainingEffect: 3.6,
        anaerobicTrainingEffect: 0,
        elevationGain: 56.28,
        elevationLoss: 69.8,
      },
    });

    expect(parsed.name).toBe("Göteborg Löpning");
    expect(parsed.movingDurationS).toBeCloseTo(2287.8);
    expect(parsed.steps).toBe(6054);
    expect(parsed.trainingEffect).toBeCloseTo(3.6);
  });

  it("parses HR zones, weather and kilometer splits", () => {
    expect(
      parseGarminHrZones([
        { zoneNumber: 4, secsInZone: 1091, zoneLowBoundary: 168 },
        { zoneNumber: 1, secsInZone: 78, zoneLowBoundary: 105 },
      ]),
    ).toEqual([
      { zoneNumber: 1, secsInZone: 78, zoneLowBoundary: 105 },
      { zoneNumber: 4, secsInZone: 1091, zoneLowBoundary: 168 },
    ]);

    expect(
      parseGarminWeather({
        temp: 64,
        relativeHumidity: 60,
        windSpeed: 2,
        weatherTypeDTO: { desc: "Mostly Clear" },
        stationName: "Goteborg / Save",
      })?.temperatureC,
    ).toBeCloseTo(17.8, 1);

    const splits = parseGarminSplits({
      lapDTOs: [
        { lapIndex: 1, distance: 1000, duration: 397.5, averageHR: 130 },
      ],
    });
    expect(splits).toHaveLength(1);
    expect(splits[0]?.kind).toBe("split");
    expect(splits[0]?.avgPaceSPerKm).toBeCloseTo(398, 0);
  });

  it("extracts a GPS polyline from Garmin details", () => {
    const points = parseGarminPolyline(
      {
        geoPolylineDTO: {
          polyline: [
            { lat: 57.71, lon: 11.97, altitude: 12, timeOffsetInSeconds: 0 },
            { lat: 57.72, lon: 11.98, altitude: 14, timeOffsetInSeconds: 30 },
          ],
        },
      },
      "2026-08-17T16:25:26.000Z",
    );
    expect(points).toHaveLength(2);
    expect(points[0]?.latitude).toBeCloseTo(57.71);
    expect(points[1]?.recordedAt).toBe("2026-08-17T16:25:56.000Z");
  });
});
