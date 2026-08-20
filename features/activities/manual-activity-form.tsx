"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { createManualActivityAction } from "@/features/activities/actions";
import { ACTIVITY_TYPE_LABEL } from "@/features/imports/labels";
import { ACTIVITY_TYPES } from "@/lib/validation/logging";

export function ManualActivityForm({
  timeZone,
  nowLocal,
  distanceUnit,
  onSuccess,
}: {
  timeZone: string;
  nowLocal: string;
  distanceUnit: "km" | "mi";
  onSuccess?: () => void;
}) {
  const [state, action] = useActionState(createManualActivityAction, {});

  useEffect(() => {
    if (state.ok) {
      toast.success("Passet sparat");
      onSuccess?.();
    }
  }, [onSuccess, state]);

  return (
    <form action={action} className="flex flex-col gap-6">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="timeZone" value={timeZone} />
      <input type="hidden" name="distanceUnit" value={distanceUnit} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="activityType">Typ</FieldLabel>
          <NativeSelect
            id="activityType"
            name="activityType"
            defaultValue="run"
            className="w-full"
          >
            {ACTIVITY_TYPES.map((type) => (
              <NativeSelectOption key={type} value={type}>
                {ACTIVITY_TYPE_LABEL[type]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="startedAtLocal">Start</FieldLabel>
          <Input
            id="startedAtLocal"
            name="startedAtLocal"
            type="datetime-local"
            defaultValue={nowLocal}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="durationMinutes">Tid (minuter)</FieldLabel>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            inputMode="decimal"
            placeholder="45"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="distance">Distans ({distanceUnit})</FieldLabel>
          <Input
            id="distance"
            name="distance"
            inputMode="decimal"
            placeholder={distanceUnit === "mi" ? "6.2" : "10"}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Anteckning</FieldLabel>
          <Input id="notes" name="notes" maxLength={2000} />
        </Field>
      </FieldGroup>
      <SubmitButton>Spara pass</SubmitButton>
    </form>
  );
}
