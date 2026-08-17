import { RACE_TYPES, type RaceType } from "@/lib/constants";

export function asRaceType(value: string | null | undefined): RaceType {
  if (value && (RACE_TYPES as readonly string[]).includes(value)) {
    return value as RaceType;
  }
  return "half_marathon";
}
