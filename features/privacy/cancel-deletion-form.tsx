"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  cancelAccountDeletionAction,
  type PrivacyActionResult,
} from "@/features/privacy/actions";

export function CancelDeletionForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState<
    PrivacyActionResult,
    FormData
  >(cancelAccountDeletionAction, {});

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="request_id" value={requestId} />
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.success ? (
        <Alert>
          <AlertDescription>{state.success}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Avbryter…" : "Behåll mitt konto"}
      </Button>
    </form>
  );
}
