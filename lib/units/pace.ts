/**
 * Target pace in seconds per kilometer.
 * Formula: target_duration_s / (race_distance_m / 1000)
 * Missing duration or non-positive distance → null (no invented precision).
 */
export function calculateTargetPaceSecondsPerKm(
  raceDistanceM: number,
  targetDurationS: number | null | undefined,
): number | null {
  if (!Number.isFinite(raceDistanceM) || raceDistanceM <= 0) {
    return null;
  }
  if (
    targetDurationS == null ||
    !Number.isFinite(targetDurationS) ||
    targetDurationS <= 0
  ) {
    return null;
  }
  return targetDurationS / (raceDistanceM / 1000);
}

export function formatPaceMinPerKm(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) {
    return "—";
  }
  const totalSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/** Parse HH:MM:SS or MM:SS into seconds. */
export function parseDurationToSeconds(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(":");
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }
  const nums = parts.map((part) => Number.parseInt(part, 10));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
    return null;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = nums as [number, number];
    if (seconds >= 60) {
      return null;
    }
    return minutes * 60 + seconds;
  }
  const [hours, minutes, seconds] = nums as [number, number, number];
  if (minutes >= 60 || seconds >= 60) {
    return null;
  }
  return hours * 3600 + minutes * 60 + seconds;
}

export function formatDurationHms(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [
    hours.toString().padStart(2, "0"),
    minutes.toString().padStart(2, "0"),
    seconds.toString().padStart(2, "0"),
  ].join(":");
}
