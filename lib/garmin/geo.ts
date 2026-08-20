const SEMICIRCLE_TO_DEGREES = 180 / 2 ** 31;

export function toLatitude(value: number | null | undefined): number | null {
  return toCoordinate(value, 90);
}

export function toLongitude(value: number | null | undefined): number | null {
  return toCoordinate(value, 180);
}

function toCoordinate(
  value: number | null | undefined,
  maxAbs: number,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const degrees =
    Math.abs(value) <= maxAbs + 0.0001 ? value : value * SEMICIRCLE_TO_DEGREES;
  if (!Number.isFinite(degrees) || Math.abs(degrees) > maxAbs) {
    return null;
  }
  return degrees;
}

export function downsample<T>(items: T[], max = 500): T[] {
  if (items.length <= max) {
    return items;
  }
  const step = (items.length - 1) / (max - 1);
  const sampled: T[] = [];
  for (let index = 0; index < max; index += 1) {
    sampled.push(items[Math.round(index * step)]!);
  }
  return sampled;
}

export function fahrenheitToCelsius(value: number): number {
  return (value - 32) * (5 / 9);
}

export function weatherTempToCelsius(
  value: number,
  unit?: string | null,
): number {
  const normalized = (unit ?? "").trim().toUpperCase();
  if (normalized === "C" || normalized === "CELSIUS") {
    return value;
  }
  if (normalized === "F" || normalized === "FAHRENHEIT") {
    return fahrenheitToCelsius(value);
  }
  // Garmin's weather endpoint returns Fahrenheit with no unit.
  return value > 45 ? fahrenheitToCelsius(value) : value;
}
