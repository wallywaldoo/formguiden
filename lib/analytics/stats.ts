export function sortedNumbers(
  values: Array<number | null | undefined>,
): number[] {
  return values
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    )
    .sort((a, b) => a - b);
}

export function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function median(values: number[]): number | null {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return null;
  }
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

export function sampleStdDev(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }
  const avg = mean(values);
  if (avg == null) {
    return null;
  }
  const variance =
    values.reduce((sum, value) => sum + (value - avg) ** 2, 0) /
    (values.length - 1);
  return Math.sqrt(variance);
}

/** Ordinary least squares slope. `x` is independent (e.g. day index). */
export function linearSlope(
  points: Array<{ x: number; y: number }>,
): number | null {
  if (points.length < 2) {
    return null;
  }
  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXy = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumXx = points.reduce((sum, point) => sum + point.x * point.x, 0);
  const denominator = n * sumXx - sumX * sumX;
  if (denominator === 0) {
    return 0;
  }
  return (n * sumXy - sumX * sumY) / denominator;
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}
