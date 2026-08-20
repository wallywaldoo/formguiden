import { asRaceType } from "@/lib/race-type";
import {
  FIVE_K_DISTANCE_M,
  HALF_MARATHON_DISTANCE_M,
  MARATHON_DISTANCE_M,
  TEN_K_DISTANCE_M,
  type RaceType,
} from "@/lib/constants";
import type { GarminRunningRecords } from "@/lib/garmin/personal-records";
import { formatDurationHms } from "@/lib/units/pace";

export type RaceEstimateKey = Exclude<RaceType, "custom">;

export type RaceEstimate = {
  key: RaceEstimateKey;
  label: string;
  distanceM: number;
  estimatedS: number | null;
  source: "pace" | null;
  isGoal: boolean;
};

export type GarminRacePredictions = {
  calendarDate: string | null;
  time5K: number | null;
  time10K: number | null;
  timeHalfMarathon: number | null;
  timeMarathon: number | null;
};

const RIEGEL_EXPONENT = 1.06;

const ESTIMATE_SPECS: Array<{
  key: RaceEstimateKey;
  label: string;
  distanceM: number;
}> = [
  { key: "5k", label: "5 km", distanceM: FIVE_K_DISTANCE_M },
  { key: "10k", label: "10 km", distanceM: TEN_K_DISTANCE_M },
  {
    key: "half_marathon",
    label: "Halv",
    distanceM: HALF_MARATHON_DISTANCE_M,
  },
  {
    key: "marathon",
    label: "Mara",
    distanceM: MARATHON_DISTANCE_M,
  },
];

export function formatRaceClock(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const seconds = rounded % 60;
  if (hours > 0) {
    const mm = minutes.toString().padStart(2, "0");
    if (seconds === 0) return `${hours}:${mm}`;
    return `${hours}:${mm}:${seconds.toString().padStart(2, "0")}`;
  }
  return formatDurationHms(rounded).slice(3);
}

export function estimateRaceTimeS(
  paceSPerKm: number,
  distanceM: number,
  referenceDistanceM = FIVE_K_DISTANCE_M,
): number | null {
  if (
    !(paceSPerKm > 0) ||
    !(distanceM > 0) ||
    !(referenceDistanceM > 0)
  ) {
    return null;
  }
  const referenceTimeS = paceSPerKm * (referenceDistanceM / 1000);
  return referenceTimeS * (distanceM / referenceDistanceM) ** RIEGEL_EXPONENT;
}

export type RaceComparisonRow = {
  key: string;
  label: string;
  estimatedS: number | null;
  recordS: number | null;
  isGoal: boolean;
};

const RECORD_FIELD: Record<RaceEstimateKey, keyof GarminRunningRecords> = {
  "5k": "time5K",
  "10k": "time10K",
  half_marathon: "timeHalfMarathon",
  marathon: "timeMarathon",
};

export function buildRaceComparison(input: {
  paceSPerKm: number | null;
  goalRaceType?: string | null;
  records?: GarminRunningRecords | null;
}): RaceComparisonRow[] {
  const records = input.records;
  const estimates = buildRaceEstimates({
    paceSPerKm: input.paceSPerKm,
    goalRaceType: input.goalRaceType,
  });
  const rows: RaceComparisonRow[] = estimates.map((estimate) => ({
    key: estimate.key,
    label: estimate.label,
    estimatedS: estimate.estimatedS,
    recordS: records?.[RECORD_FIELD[estimate.key]] ?? null,
    isGoal: estimate.isGoal,
  }));
  if (records?.time1K != null) {
    rows.unshift({
      key: "1k",
      label: "1 km",
      estimatedS: null,
      recordS: records.time1K,
      isGoal: false,
    });
  }
  return rows;
}

export function buildRaceEstimates(input: {
  paceSPerKm: number | null;
  goalRaceType?: string | null;
}): RaceEstimate[] {
  const goalKey = asRaceType(input.goalRaceType);
  return ESTIMATE_SPECS.map((spec) => {
    const estimatedS =
      input.paceSPerKm != null
        ? estimateRaceTimeS(input.paceSPerKm, spec.distanceM)
        : null;
    return {
      key: spec.key,
      label: spec.label,
      distanceM: spec.distanceM,
      estimatedS,
      source: estimatedS != null ? "pace" : null,
      isGoal: goalKey === spec.key,
    };
  });
}

export function weightGoalProgress(input: {
  currentKg: number | null;
  targetKg: number | null;
}): {
  currentLabel: string;
  targetLabel: string;
  detail: string;
  ratio: number;
} | null {
  const { currentKg, targetKg } = input;
  if (currentKg == null || targetKg == null || targetKg <= 0) {
    return null;
  }
  const gap = currentKg - targetKg;
  const span = Math.max(Math.abs(gap), 4);
  const ratio = Math.max(0, Math.min(1, 1 - Math.abs(gap) / span));
  const detail =
    Math.abs(gap) < 0.05
      ? "På målet"
      : `${gap > 0 ? "+" : ""}${gap.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} kg`;
  return {
    currentLabel: `${currentKg.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} kg`,
    targetLabel: `${targetKg.toLocaleString("sv-SE", { maximumFractionDigits: 1 })} kg`,
    detail,
    ratio,
  };
}
