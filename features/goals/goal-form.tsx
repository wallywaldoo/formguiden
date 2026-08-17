"use client";

import { useActionState, useMemo, useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { updateGoalAction } from "@/features/profiles/actions";
import {
  HALF_MARATHON_DISTANCE_M,
  RACE_DISTANCE_M,
  type RaceType,
} from "@/lib/constants";
import {
  calculateTargetPaceSecondsPerKm,
  formatDurationHms,
  formatPaceMinPerKm,
  parseDurationToSeconds,
} from "@/lib/units/pace";

const raceTypeLabels: Record<RaceType, string> = {
  "5k": "5 km",
  "10k": "10 km",
  half_marathon: "Halvmaraton",
  marathon: "Maraton",
  custom: "Valfri distans",
};

export type GoalFormValues = {
  raceType: RaceType;
  raceDistanceM: number;
  raceDate: string | null;
  targetDurationS: number | null;
  targetMassKg: number | null;
  weeklyRunDistanceM: number | null;
  weeklyRunDurationS: number | null;
  weeklyStrengthSessions: number | null;
  weeklyStrengthDurationS: number | null;
  notes: string | null;
};

export function GoalForm({ initial }: { initial: GoalFormValues | null }) {
  const [state, formAction] = useActionState(updateGoalAction, {});
  const initialType = initial?.raceType ?? "half_marathon";
  const [raceType, setRaceType] = useState<RaceType>(initialType);
  const [customDistanceKm, setCustomDistanceKm] = useState(
    initialType === "custom" && initial
      ? String(initial.raceDistanceM / 1000)
      : "",
  );
  const [targetDuration, setTargetDuration] = useState(
    initial?.targetDurationS
      ? formatDurationHms(initial.targetDurationS)
      : "01:30:00",
  );

  const pace = useMemo(() => {
    const distanceM =
      raceType === "custom"
        ? Number.parseFloat(customDistanceKm.replace(",", ".")) * 1000
        : RACE_DISTANCE_M[raceType];
    return calculateTargetPaceSecondsPerKm(
      distanceM,
      parseDurationToSeconds(targetDuration),
    );
  }, [customDistanceKm, raceType, targetDuration]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="raceType">Lopp</FieldLabel>
          <NativeSelect
            id="raceType"
            name="raceType"
            value={raceType}
            onChange={(event) => setRaceType(event.target.value as RaceType)}
          >
            {Object.entries(raceTypeLabels).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {raceType === "custom" ? (
          <Field>
            <FieldLabel htmlFor="customDistanceKm">Distans (km)</FieldLabel>
            <Input
              id="customDistanceKm"
              name="customDistanceKm"
              value={customDistanceKm}
              onChange={(event) => setCustomDistanceKm(event.target.value)}
              inputMode="decimal"
            />
          </Field>
        ) : (
          <FieldDescription>
            Distans:{" "}
            {(RACE_DISTANCE_M[raceType] / 1000).toLocaleString("sv-SE")} km
            {raceType === "half_marathon"
              ? ` (${HALF_MARATHON_DISTANCE_M} m)`
              : null}
          </FieldDescription>
        )}
        <Field>
          <FieldLabel htmlFor="raceDate">Loppdatum</FieldLabel>
          <Input
            id="raceDate"
            name="raceDate"
            type="date"
            defaultValue={initial?.raceDate ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="targetDuration">Måltid</FieldLabel>
          <Input
            id="targetDuration"
            name="targetDuration"
            value={targetDuration}
            onChange={(event) => setTargetDuration(event.target.value)}
          />
          <FieldDescription>
            Beräknat tempo: {pace ? `${formatPaceMinPerKm(pace)} min/km` : "—"}
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="targetMassKg">Målvikt (kg)</FieldLabel>
          <Input
            id="targetMassKg"
            name="targetMassKg"
            defaultValue={initial?.targetMassKg ?? ""}
            inputMode="decimal"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="weeklyRunDistanceKm">
            Veckodistans (km)
          </FieldLabel>
          <Input
            id="weeklyRunDistanceKm"
            name="weeklyRunDistanceKm"
            defaultValue={
              initial?.weeklyRunDistanceM
                ? String(initial.weeklyRunDistanceM / 1000)
                : ""
            }
            inputMode="decimal"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="weeklyRunDuration">Veckotid löpning</FieldLabel>
          <Input
            id="weeklyRunDuration"
            name="weeklyRunDuration"
            defaultValue={
              initial?.weeklyRunDurationS
                ? formatDurationHms(initial.weeklyRunDurationS)
                : ""
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="weeklyStrengthSessions">
            Styrkepass / vecka
          </FieldLabel>
          <Input
            id="weeklyStrengthSessions"
            name="weeklyStrengthSessions"
            defaultValue={initial?.weeklyStrengthSessions ?? ""}
            inputMode="numeric"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="weeklyStrengthDuration">
            Veckotid styrka
          </FieldLabel>
          <Input
            id="weeklyStrengthDuration"
            name="weeklyStrengthDuration"
            defaultValue={
              initial?.weeklyStrengthDurationS
                ? formatDurationHms(initial.weeklyStrengthDurationS)
                : ""
            }
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Anteckningar</FieldLabel>
          <Input id="notes" name="notes" defaultValue={initial?.notes ?? ""} />
        </Field>
      </FieldGroup>
      <SubmitButton>Spara mål</SubmitButton>
    </form>
  );
}
