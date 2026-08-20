import { calculateTargetPaceSecondsPerKm } from "@/lib/units/pace";

/** FIT epoch through a date Postgres timestamptz can store. */
export const PLAUSIBLE_TIMESTAMP_MIN_MS = Date.UTC(1989, 11, 31);
export const PLAUSIBLE_TIMESTAMP_MAX_MS = Date.UTC(2100, 0, 1);

export function isPlausibleUnixMs(ms: number): boolean {
  return (
    Number.isFinite(ms) &&
    ms >= PLAUSIBLE_TIMESTAMP_MIN_MS &&
    ms <= PLAUSIBLE_TIMESTAMP_MAX_MS
  );
}

function isoFromMs(ms: number): string | null {
  if (!isPlausibleUnixMs(ms)) return null;
  return new Date(ms).toISOString();
}

export function toIso(
  value: Date | string | number | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date) {
    return isoFromMs(value.getTime());
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : isoFromMs(parsed.getTime());
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1000;
    return isoFromMs(millis);
  }
  return null;
}

export function toLocalDate(iso: string): string {
  return iso.slice(0, 10);
}

export function positiveNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

export function positiveInt(value: unknown): number | null {
  const number = positiveNumber(value);
  if (number == null) {
    return null;
  }
  return Math.round(number);
}

export function derivedPace(
  distanceM: number | null,
  durationS: number | null,
): number | null {
  if (distanceM == null || durationS == null) {
    return null;
  }
  return calculateTargetPaceSecondsPerKm(distanceM, durationS);
}

export function escapeZipPath(path: string): string {
  return path.replaceAll("\\", "/").replaceAll("\0", "");
}
