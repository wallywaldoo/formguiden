"use client";

import { useActionState } from "react";

import { SubmitButton } from "@/components/forms/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { signInAction, type ActionResult } from "@/lib/auth-actions";

const initialState: ActionResult = {};

export function SignInForm({ initialError }: { initialError?: string }) {
  const [state, formAction] = useActionState(signInAction, initialState);
  const error = state.error ?? initialError;

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="password">Lösenord</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            className="h-11"
          />
        </Field>
      </FieldGroup>
      <SubmitButton className="h-11 w-full">Logga in</SubmitButton>
    </form>
  );
}
