"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";

import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { addStrengthSetAction } from "@/features/strength/actions";

export function StrengthSetForm({
  sessionId,
  massUnit,
}: {
  sessionId: string;
  massUnit: "kg" | "lb";
}) {
  const [state, action] = useActionState(addStrengthSetAction, {});
  const [includeRpe, setIncludeRpe] = useState(false);
  const [rpe, setRpe] = useState(7);

  useEffect(() => {
    if (state.ok) {
      toast.success("Set sparat");
    }
  }, [state]);

  return (
    <form action={action} className="flex flex-col gap-6">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <input type="hidden" name="sessionId" value={sessionId} />
      <input type="hidden" name="massUnit" value={massUnit} />
      {includeRpe ? <input type="hidden" name="rpe" value={rpe} /> : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="exerciseName">Övning</FieldLabel>
          <Input
            id="exerciseName"
            name="exerciseName"
            required
            maxLength={120}
            placeholder="Knäböj"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="repetitions">Repetitioner</FieldLabel>
            <Input id="repetitions" name="repetitions" inputMode="numeric" />
          </Field>
          <Field>
            <FieldLabel htmlFor="mass">Vikt ({massUnit})</FieldLabel>
            <Input id="mass" name="mass" inputMode="decimal" />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor="includeRpe">RPE (1–10)</FieldLabel>
          <Switch
            id="includeRpe"
            checked={includeRpe}
            onCheckedChange={setIncludeRpe}
          />
        </div>
        {includeRpe ? (
          <Field>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[rpe]}
              onValueChange={(value) => setRpe(value[0] ?? 7)}
            />
            <FieldDescription>{rpe} / 10</FieldDescription>
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="notes">Anteckning</FieldLabel>
          <Input id="notes" name="notes" maxLength={2000} />
        </Field>
      </FieldGroup>
      <SubmitButton>Lägg till set</SubmitButton>
    </form>
  );
}
