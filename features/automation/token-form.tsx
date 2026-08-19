"use client";

import { useActionState, useState } from "react";

import {
  createAutomationTokenAction,
  revokeAutomationTokenAction,
  type AutomationActionResult,
} from "@/features/automation/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AutomationTokenForm({
  tokens,
}: {
  tokens: Array<{
    id: string;
    label: string;
    expires_at: string;
    revoked_at: string | null;
    created_at: string;
  }>;
}) {
  const [state, action, pending] = useActionState<
    AutomationActionResult,
    FormData
  >(createAutomationTokenAction, {});
  const [revokeError, setRevokeError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {state.token ? (
        <Alert>
          <AlertDescription className="space-y-2">
            <p>
              Kopiera tokenen nu. Den visas bara en gång och ger tillgång till
              hela ditt konto, inte bara import.
            </p>
            <code className="block break-all rounded-md bg-muted px-2 py-1 text-xs">
              {state.token}
            </code>
          </AlertDescription>
        </Alert>
      ) : null}

      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="label">Namn</Label>
          <Input
            id="label"
            name="label"
            defaultValue="garmin-sync"
            maxLength={64}
          />
        </div>
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
        <Button type="submit" disabled={pending}>
          {pending ? "Skapar…" : "Skapa sync-token"}
        </Button>
      </form>

      {revokeError ? (
        <p className="text-sm text-destructive">{revokeError}</p>
      ) : null}

      {tokens.length > 0 ? (
        <ul className="space-y-3 text-sm">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-foreground">{token.label}</p>
                <p className="text-muted-foreground">
                  {token.revoked_at
                    ? "Återkallad i Formkurvan"
                    : `Gäller till ${new Date(token.expires_at).toLocaleDateString("sv-SE")}`}
                </p>
              </div>
              {!token.revoked_at ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    setRevokeError(null);
                    const result = await revokeAutomationTokenAction(token.id);
                    if (result.error) {
                      setRevokeError(result.error);
                    }
                  }}
                >
                  Dölj
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
