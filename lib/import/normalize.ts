import { calculateTargetPaceSecondsPerKm } from "@/lib/units/pace";

export function toIso(
  value: Date | string | number | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const millis = value > 1e12 ? value : value * 1000;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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
