import { RACE_DISTANCE_M, type RaceType } from "@/lib/constants";
import {
  calculateTargetPaceSecondsPerKm,
  parseDurationToSeconds,
} from "@/lib/units/pace";

export type GoalPayload = {
  race_type: RaceType;
  race_distance_m: number;
  race_date: string | null;
  target_duration_s: number | null;
  target_pace_s_per_km: number | null;
  target_mass_kg: number | null;
  weekly_run_distance_m: number | null;
  weekly_run_duration_s: number | null;
  weekly_strength_sessions: number | null;
  weekly_strength_duration_s: number | null;
  notes: string | null;
};

function parseOptionalKm(value: string | null | undefined): number | null {
  if (!value || value.trim() === "") {
    return null;
  }
  const parsed = Number.parseFloat(value.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed * 1000;
}

export function buildGoalPayload(input: {
  raceType: RaceType;
  customDistanceKm?: string;
  raceDate?: string;
  targetDuration?: string;
  targetMassKg?: number | null;
  weeklyRunDistanceKm?: number | null;
  weeklyRunDuration?: string;
  weeklyStrengthSessions?: number | null;
  weeklyStrengthDuration?: string;
  notes?: string;
}): GoalPayload {
  const raceDistanceM =
    input.raceType === "custom"
      ? (parseOptionalKm(input.customDistanceKm) ?? 0)
      : RACE_DISTANCE_M[input.raceType];

  const targetDurationS = input.targetDuration
    ? parseDurationToSeconds(input.targetDuration)
    : null;

  return {
    race_type: input.raceType,
    race_distance_m: raceDistanceM,
    race_date: input.raceDate?.trim() ? input.raceDate : null,
    target_duration_s: targetDurationS,
    target_pace_s_per_km: calculateTargetPaceSecondsPerKm(
      raceDistanceM,
      targetDurationS,
    ),
    target_mass_kg: input.targetMassKg ?? null,
    weekly_run_distance_m:
      input.weeklyRunDistanceKm != null
        ? input.weeklyRunDistanceKm * 1000
        : null,
    weekly_run_duration_s: input.weeklyRunDuration
      ? parseDurationToSeconds(input.weeklyRunDuration)
      : null,
    weekly_strength_sessions: input.weeklyStrengthSessions ?? null,
    weekly_strength_duration_s: input.weeklyStrengthDuration
      ? parseDurationToSeconds(input.weeklyStrengthDuration)
      : null,
    notes: input.notes?.trim() ? input.notes.trim() : null,
  };
}
