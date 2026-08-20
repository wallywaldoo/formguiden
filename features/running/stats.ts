import { median } from "@/lib/analytics/stats";
import type { RunActivityView } from "@/features/running/types";

export function runListStats(runs: RunActivityView[]) {
  const withDistance = runs.filter((run) => run.distanceM != null);
  const totalDistanceM = withDistance.reduce(
    (sum, run) => sum + (run.distanceM ?? 0),
    0,
  );
  const longestM = withDistance.reduce(
    (max, run) => Math.max(max, run.distanceM ?? 0),
    0,
  );
  const withDuration = runs.filter((run) => run.durationS != null);
  const totalDurationS = withDuration.reduce(
    (sum, run) => sum + (run.durationS ?? 0),
    0,
  );
  const withElevation = runs.filter((run) => run.elevationGainM != null);
  const totalElevationM = withElevation.reduce(
    (sum, run) => sum + (run.elevationGainM ?? 0),
    0,
  );
  const paces = runs
    .filter((run) => run.avgPaceSPerKm != null && (run.distanceM ?? 0) > 1000)
    .map((run) => run.avgPaceSPerKm!);
  const heartRates = runs
    .filter((run) => run.avgHeartRateBpm != null)
    .map((run) => run.avgHeartRateBpm!);

  return {
    runCount: runs.length,
    totalDistanceM: withDistance.length > 0 ? totalDistanceM : null,
    longestM: withDistance.length > 0 ? longestM : null,
    totalDurationS: withDuration.length > 0 ? totalDurationS : null,
    totalElevationM: withElevation.length > 0 ? totalElevationM : null,
    medianPaceSPerKm: median(paces),
    bestPaceSPerKm: paces.length > 0 ? Math.min(...paces) : null,
    medianHeartRateBpm: median(heartRates),
  };
}

export function distanceDeltaRatio(
  currentM: number | null,
  previousM: number | null,
): number | null {
  if (currentM == null || previousM == null || previousM <= 0) return null;
  return (currentM - previousM) / previousM;
}
