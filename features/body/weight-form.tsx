"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createWeightEntryAction } from "@/features/body/actions";

export function WeightForm({
  timeZone,
  nowLocal,
  massUnit,
  onSuccess,
}: {
  timeZone: string;
  nowLocal: string;
  massUnit: "kg" | "lb";
  onSuccess?: () => void;
}) {
  const [state, action] = useActionState(createWeightEntryAction, {});

  useEffect(() => {
    if (state.ok) {
      toast.success("Vikt sparad");
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
      <input type="hidden" name="massUnit" value={massUnit} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="mass">Vikt ({massUnit})</FieldLabel>
          <Input id="mass" name="mass" inputMode="decimal" required />
        </Field>
        <Field>
          <FieldLabel htmlFor="measuredAtLocal">Tid</FieldLabel>
          <Input
            id="measuredAtLocal"
            name="measuredAtLocal"
            type="datetime-local"
            defaultValue={nowLocal}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="bodyFatPct">Fett %, valfritt</FieldLabel>
          <Input id="bodyFatPct" name="bodyFatPct" inputMode="decimal" />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Anteckning</FieldLabel>
          <Input id="notes" name="notes" maxLength={2000} />
        </Field>
      </FieldGroup>
      <SubmitButton>Spara vikt</SubmitButton>
    </form>
  );
}
