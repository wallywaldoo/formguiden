"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { updateProfileSettingsAction } from "@/features/profiles/actions";
import { DEFAULT_TIMEZONE } from "@/lib/constants";

export function ProfileSettingsForm({
  displayName,
  dateOfBirth,
  sexAtBirth,
  heightCm,
  timezone,
  distanceUnit,
  massUnit,
  elevationUnit,
  volumeUnit,
  timeZones,
}: {
  displayName: string;
  dateOfBirth: string;
  sexAtBirth: string;
  heightCm: string;
  timezone: string;
  distanceUnit: string;
  massUnit: string;
  elevationUnit: string;
  volumeUnit: string;
  timeZones: string[];
}) {
  const [state, formAction] = useActionState(updateProfileSettingsAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="displayName">Namn</FieldLabel>
          <Input
            id="displayName"
            name="displayName"
            defaultValue={displayName}
            maxLength={32}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="dateOfBirth">Födelsedatum</FieldLabel>
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            defaultValue={dateOfBirth}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sexAtBirth">Kön</FieldLabel>
          <NativeSelect
            id="sexAtBirth"
            name="sexAtBirth"
            defaultValue={sexAtBirth || "unspecified"}
          >
            <NativeSelectOption value="male">Man</NativeSelectOption>
            <NativeSelectOption value="female">Kvinna</NativeSelectOption>
            <NativeSelectOption value="unspecified">Vill inte ange</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="heightCm">Längd (cm)</FieldLabel>
          <Input
            id="heightCm"
            name="heightCm"
            inputMode="decimal"
            defaultValue={heightCm}
            placeholder="175"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="timezone">Tidszon</FieldLabel>
          <NativeSelect
            id="timezone"
            name="timezone"
            defaultValue={timezone || DEFAULT_TIMEZONE}
            className="w-full min-w-full"
          >
            {timeZones.map((zone) => (
              <NativeSelectOption key={zone} value={zone}>
                {zone}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="distanceUnit">Distans</FieldLabel>
          <NativeSelect
            id="distanceUnit"
            name="distanceUnit"
            defaultValue={distanceUnit}
          >
            <NativeSelectOption value="km">Kilometer</NativeSelectOption>
            <NativeSelectOption value="mi">Miles</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="massUnit">Vikt</FieldLabel>
          <NativeSelect id="massUnit" name="massUnit" defaultValue={massUnit}>
            <NativeSelectOption value="kg">Kilogram</NativeSelectOption>
            <NativeSelectOption value="lb">Pund</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="elevationUnit">Höjd</FieldLabel>
          <NativeSelect
            id="elevationUnit"
            name="elevationUnit"
            defaultValue={elevationUnit}
          >
            <NativeSelectOption value="m">Meter</NativeSelectOption>
            <NativeSelectOption value="ft">Fot</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="volumeUnit">Volym</FieldLabel>
          <NativeSelect
            id="volumeUnit"
            name="volumeUnit"
            defaultValue={volumeUnit}
          >
            <NativeSelectOption value="ml">Milliliter</NativeSelectOption>
            <NativeSelectOption value="floz">Fluid ounces</NativeSelectOption>
          </NativeSelect>
        </Field>
        <input type="hidden" name="temperatureUnit" value="c" />
      </FieldGroup>
      <SubmitButton>Spara profil</SubmitButton>
    </form>
  );
}
