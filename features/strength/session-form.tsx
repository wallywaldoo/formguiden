"use client";

import { useActionState, useState } from "react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  createStrengthSessionAction,
  updateStrengthSessionAction,
} from "@/features/strength/actions";

export function StrengthSessionForm({
  timeZone,
  nowLocal,
  sessionId,
  initial,
}: {
  timeZone: string;
  nowLocal: string;
  sessionId?: string;
  initial?: {
    startedAtLocal: string;
    durationMinutes: number | null;
    perceivedEffort: number | null;
    notes: string | null;
  };
}) {
  const action = sessionId
    ? updateStrengthSessionAction
    : createStrengthSessionAction;
  const [state, formAction] = useActionState(action, {});
  const [includeEffort, setIncludeEffort] = useState(
    initial?.perceivedEffort != null,
  );
  const [effort, setEffort] = useState(initial?.perceivedEffort ?? 6);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {sessionId ? <input type="hidden" name="id" value={sessionId} /> : null}
      <input type="hidden" name="timeZone" value={timeZone} />
      {includeEffort ? (
        <input type="hidden" name="perceivedEffort" value={effort} />
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="startedAtLocal">Start</FieldLabel>
          <Input
            id="startedAtLocal"
            name="startedAtLocal"
            type="datetime-local"
            defaultValue={initial?.startedAtLocal ?? nowLocal}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="durationMinutes">Tid (minuter)</FieldLabel>
          <Input
            id="durationMinutes"
            name="durationMinutes"
            inputMode="numeric"
            defaultValue={initial?.durationMinutes ?? ""}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor="includeEffort">Ansträngning (1–10)</FieldLabel>
          <Switch
            id="includeEffort"
            checked={includeEffort}
            onCheckedChange={setIncludeEffort}
          />
        </div>
        {includeEffort ? (
          <Field>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[effort]}
              onValueChange={(value) => setEffort(value[0] ?? 6)}
            />
            <FieldDescription>{effort} / 10</FieldDescription>
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="notes">Anteckning</FieldLabel>
          <Textarea
            id="notes"
            name="notes"
            maxLength={2000}
            rows={3}
            defaultValue={initial?.notes ?? ""}
          />
        </Field>
      </FieldGroup>
      <SubmitButton>{sessionId ? "Spara pass" : "Skapa pass"}</SubmitButton>
    </form>
  );
}
