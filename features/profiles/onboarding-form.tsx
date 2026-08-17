"use client";

import { useActionState, useMemo, useState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
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
import { completeOnboardingAction } from "@/features/profiles/actions";
import {
  DEFAULT_TIMEZONE,
  HALF_MARATHON_DISTANCE_M,
  RACE_DISTANCE_M,
  type RaceType,
} from "@/lib/constants";
import { listTimeZones } from "@/lib/timezones";
import {
  calculateTargetPaceSecondsPerKm,
  formatPaceMinPerKm,
  parseDurationToSeconds,
} from "@/lib/units/pace";

const initialState: { error?: string } = {};

const raceTypeLabels: Record<RaceType, string> = {
  "5k": "5 km",
  "10k": "10 km",
  half_marathon: "Halvmaraton",
  marathon: "Maraton",
  custom: "Valfri distans",
};

export function OnboardingForm({ timeZones }: { timeZones: string[] }) {
  const [state, formAction] = useActionState(
    completeOnboardingAction,
    initialState,
  );
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [raceType, setRaceType] = useState<RaceType>("half_marathon");
  const [customDistanceKm, setCustomDistanceKm] = useState("");
  const [targetDuration, setTargetDuration] = useState("01:30:00");

  const pace = useMemo(() => {
    const distanceM =
      raceType === "custom"
        ? Number.parseFloat(customDistanceKm.replace(",", ".")) * 1000
        : RACE_DISTANCE_M[raceType];
    const durationS = parseDurationToSeconds(targetDuration);
    return calculateTargetPaceSecondsPerKm(distanceM, durationS);
  }, [customDistanceKm, raceType, targetDuration]);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <h2 className="text-lg font-medium">Integritet</h2>
        <Field orientation="horizontal">
          <Checkbox
            id="privacyAccepted"
            checked={privacyAccepted}
            onCheckedChange={(value) => setPrivacyAccepted(value === true)}
            required
          />
          <input
            type="hidden"
            name="privacyAccepted"
            value={privacyAccepted ? "on" : ""}
          />
          <FieldLabel htmlFor="privacyAccepted" className="font-normal">
            Jag förstår att Formkurvan inte ger medicinska råd, att hälsodata
            bara syns på det här kontot, och att Garmin-filer är export jag
            själv laddar upp.
          </FieldLabel>
        </Field>
      </FieldGroup>

      <FieldGroup>
        <h2 className="text-lg font-medium">Profil</h2>
        <Field>
          <FieldLabel htmlFor="displayName">Namn</FieldLabel>
          <Input id="displayName" name="displayName" maxLength={32} />
        </Field>
        <Field>
          <FieldLabel htmlFor="timezone">Tidszon</FieldLabel>
          <NativeSelect
            id="timezone"
            name="timezone"
            defaultValue={DEFAULT_TIMEZONE}
            className="w-full min-w-full"
          >
            {(timeZones.length > 0 ? timeZones : listTimeZones()).map(
              (zone) => (
                <NativeSelectOption key={zone} value={zone}>
                  {zone}
                </NativeSelectOption>
              ),
            )}
          </NativeSelect>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="distanceUnit">Distans</FieldLabel>
            <NativeSelect
              id="distanceUnit"
              name="distanceUnit"
              defaultValue="km"
            >
              <NativeSelectOption value="km">Kilometer</NativeSelectOption>
              <NativeSelectOption value="mi">Miles</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="massUnit">Vikt</FieldLabel>
            <NativeSelect id="massUnit" name="massUnit" defaultValue="kg">
              <NativeSelectOption value="kg">Kilogram</NativeSelectOption>
              <NativeSelectOption value="lb">Pund</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="elevationUnit">Höjd</FieldLabel>
            <NativeSelect
              id="elevationUnit"
              name="elevationUnit"
              defaultValue="m"
            >
              <NativeSelectOption value="m">Meter</NativeSelectOption>
              <NativeSelectOption value="ft">Fot</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="volumeUnit">Volym</FieldLabel>
            <NativeSelect id="volumeUnit" name="volumeUnit" defaultValue="ml">
              <NativeSelectOption value="ml">Milliliter</NativeSelectOption>
              <NativeSelectOption value="floz">Fluid ounces</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
        <input type="hidden" name="temperatureUnit" value="c" />
      </FieldGroup>

      <FieldGroup>
        <h2 className="text-lg font-medium">Mål</h2>
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
              inputMode="decimal"
              value={customDistanceKm}
              onChange={(event) => setCustomDistanceKm(event.target.value)}
            />
          </Field>
        ) : (
          <FieldDescription>
            Distans:{" "}
            {(RACE_DISTANCE_M[raceType] / 1000).toLocaleString("sv-SE")} km
            {raceType === "half_marathon"
              ? ` (World Athletics ${HALF_MARATHON_DISTANCE_M} m)`
              : null}
          </FieldDescription>
        )}
        <Field>
          <FieldLabel htmlFor="raceDate">Loppdatum</FieldLabel>
          <Input id="raceDate" name="raceDate" type="date" />
        </Field>
        <Field>
          <FieldLabel htmlFor="targetDuration">Måltid (TT:MM:SS)</FieldLabel>
          <Input
            id="targetDuration"
            name="targetDuration"
            value={targetDuration}
            onChange={(event) => setTargetDuration(event.target.value)}
            placeholder="01:30:00"
          />
          <FieldDescription>
            Beräknat tempo:{" "}
            <strong>{pace ? `${formatPaceMinPerKm(pace)} min/km` : "—"}</strong>
            . Referens 1:30 på halvmaraton ger cirka 4:16 min/km.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="targetMassKg">Målvikt (kg), valfritt</FieldLabel>
          <Input id="targetMassKg" name="targetMassKg" inputMode="decimal" />
        </Field>
        <Field>
          <FieldLabel htmlFor="weeklyRunDistanceKm">
            Veckodistans löpning (km), valfritt
          </FieldLabel>
          <Input
            id="weeklyRunDistanceKm"
            name="weeklyRunDistanceKm"
            inputMode="decimal"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="weeklyStrengthSessions">
            Styrkepass per vecka, valfritt
          </FieldLabel>
          <Input
            id="weeklyStrengthSessions"
            name="weeklyStrengthSessions"
            inputMode="numeric"
          />
        </Field>
      </FieldGroup>

      <SubmitButton>Spara och fortsätt</SubmitButton>
    </form>
  );
}
