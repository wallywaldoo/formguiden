"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  requestAccountDeletionAction,
  type PrivacyActionResult,
} from "@/features/privacy/actions";

export function AccountDeletionForm() {
  const [state, action, pending] = useActionState<
    PrivacyActionResult,
    FormData
  >(requestAccountDeletionAction, {});

  return (
    <form action={action} className="space-y-4">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="password">Bekräfta med lösenord</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Kontot döljs omedelbart och raderas permanent efter 7 dagars
        ångerperiod. Du kan avbryta genom att logga in igen.
      </p>
      <Button type="submit" variant="destructive" disabled={pending}>
        {pending ? "Begär radering…" : "Radera mitt konto"}
      </Button>
    </form>
  );
}
