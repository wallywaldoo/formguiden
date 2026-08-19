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
    <form action={formAction} className="flex flex-col gap-6">
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
            required
          />
        </Field>
      </FieldGroup>
      <SubmitButton className="w-full">Logga in</SubmitButton>
    </form>
  );
}
