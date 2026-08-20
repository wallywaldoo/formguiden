import { asRaceType } from "@/lib/race-type";
import { formatRaceClock } from "@/lib/analytics/race-estimates";
import { formatPaceMinPerKm } from "@/lib/units/pace";

export const RACE_TYPE_LABEL: Record<string, string> = {
  "5k": "5 km",
  "10k": "10 km",
  half_marathon: "Halvmaraton",
  marathon: "Maraton",
  custom: "Mållopp",
};

export type RaceProgress = {
  label: string;
  targetLabel: string;
  predictedLabel: string;
  detail: string;
  ratio: number;
};

export function raceProgress(input: {
  raceType: string | null | undefined;
  raceDistanceM: number | null;
  targetDurationS: number | null;
  targetPaceSPerKm: number | null;
  currentPaceSPerKm: number | null;
}): RaceProgress | null {
  const distanceM = input.raceDistanceM;
  const km = distanceM != null && distanceM > 0 ? distanceM / 1000 : null;
  const targetDurationS =
    input.targetDurationS != null && input.targetDurationS > 0
      ? input.targetDurationS
      : km != null && input.targetPaceSPerKm != null && input.targetPaceSPerKm > 0
        ? input.targetPaceSPerKm * km
        : null;
  if (distanceM == null || km == null || targetDurationS == null) {
    return null;
  }
  const raceLabel = RACE_TYPE_LABEL[asRaceType(input.raceType)] ?? "Mållopp";
  const targetLabel = formatRaceClock(targetDurationS);
  if (input.currentPaceSPerKm == null || input.currentPaceSPerKm <= 0) {
    return {
      label: raceLabel,
      targetLabel,
      predictedLabel: "—",
      detail: "Behöver ett representativt löppass.",
      ratio: 0,
    };
  }
  const predictedS = input.currentPaceSPerKm * km;
  const ratio = Math.max(0, Math.min(1, targetDurationS / predictedS));
  const ahead = predictedS <= targetDurationS;
  return {
    label: raceLabel,
    targetLabel,
    predictedLabel: formatRaceClock(predictedS),
    detail: ahead
      ? `Före målet · ${formatPaceMinPerKm(input.currentPaceSPerKm)} /km`
      : `${formatPaceMinPerKm(input.currentPaceSPerKm)} /km mot mål ${formatPaceMinPerKm(targetDurationS / km)}`,
    ratio,
  };
}
