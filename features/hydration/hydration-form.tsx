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
import { createHydrationEntryAction } from "@/features/hydration/actions";
import { BEVERAGE_TYPE_LABEL } from "@/features/logging/labels";

export function HydrationForm({
  timeZone,
  nowLocal,
  volumeUnit,
  onSuccess,
}: {
  timeZone: string;
  nowLocal: string;
  volumeUnit: "ml" | "floz";
  onSuccess?: () => void;
}) {
  const [state, action] = useActionState(createHydrationEntryAction, {});

  useEffect(() => {
    if (state.ok) {
      toast.success("Vätska sparad");
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
      <input type="hidden" name="volumeUnit" value={volumeUnit} />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="volume">
            Volym ({volumeUnit === "floz" ? "fl oz" : "ml"})
          </FieldLabel>
          <Input
            id="volume"
            name="volume"
            inputMode="decimal"
            required
            defaultValue={volumeUnit === "floz" ? "8" : "250"}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="beverageType">Dryck</FieldLabel>
          <NativeSelect
            id="beverageType"
            name="beverageType"
            defaultValue="water"
          >
            {Object.entries(BEVERAGE_TYPE_LABEL).map(([value, label]) => (
              <NativeSelectOption key={value} value={value}>
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="consumedAtLocal">Tid</FieldLabel>
          <Input
            id="consumedAtLocal"
            name="consumedAtLocal"
            type="datetime-local"
            defaultValue={nowLocal}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="caffeineMg">Koffein (mg), valfritt</FieldLabel>
          <Input id="caffeineMg" name="caffeineMg" inputMode="decimal" />
        </Field>
        <Field>
          <FieldLabel htmlFor="notes">Anteckning</FieldLabel>
          <Input id="notes" name="notes" maxLength={2000} />
        </Field>
      </FieldGroup>
      <SubmitButton>Spara vätska</SubmitButton>
    </form>
  );
}
