import { reject } from "@/lib/import/garmindb/errors";

/**
 * GarminDB writes unit-bearing values in whichever system the user configured.
 * `Weight.weight` is `kgs_or_lbs(measurement_system)`, so the same column means
 * kilograms for one user and pounds for another.
 *
 * The system is stored in `attributes.measurement_system` as Python's
 * `str(DisplayMeasure.metric)`, which yields the enum-prefixed form
 * `DisplayMeasure.metric`. Both the prefixed and bare spellings are accepted.
 *
 * A missing or unrecognised value is a hard rejection. Guessing would import a
 * 70 kg runner as 70 lb, and the error would be invisible until the analytics
 * looked wrong months later.
 */

export const MEASUREMENT_SYSTEMS = ["metric", "statute"] as const;

export type MeasurementSystem = (typeof MEASUREMENT_SYSTEMS)[number];

const POUNDS_TO_KILOGRAMS = 0.45359237;

export function resolveMeasurementSystem(
  raw: string | null,
): MeasurementSystem {
  const normalized = (raw ?? "").trim().split(".").pop()?.toLowerCase().trim();

  if (normalized === "metric" || normalized === "statute") {
    return normalized;
  }

  reject(
    "measurement_system_unknown",
    "Formkurvan kan inte avgöra om din GarminDB-fil använder metriska eller brittiska enheter, och importerar inte hellre än att gissa fel på din vikt. Kör GarminDB:s import igen så att profilinformationen kommer med.",
  );
}

/**
 * Converts a mass value in the file's own system to canonical kilograms.
 * Returned unrounded; the caller rounds once so no double-rounding creeps in.
 */
export function massToKilograms(
  value: number,
  system: MeasurementSystem,
): number {
  return system === "metric" ? value : value * POUNDS_TO_KILOGRAMS;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function describeMeasurementSystem(system: MeasurementSystem): string {
  return system === "metric"
    ? "Din GarminDB-fil använder metriska enheter (kg)."
    : "Din GarminDB-fil använder brittiska enheter (lb). Vikter räknas om till kilogram.";
}
