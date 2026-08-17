"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

export function ImportProcessRunner({
  importId,
  active,
}: {
  importId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ticks, setTicks] = useState(0);

  useEffect(() => {
    if (!active) {
      return;
    }
    let cancelled = false;

    async function run() {
      for (let slice = 0; slice < 500 && !cancelled; slice += 1) {
        try {
          const response = await fetch(`/api/imports/${importId}/process`, {
            method: "POST",
          });
          const payload = (await response.json()) as {
            status?: string;
            error?: string;
          };
          if (!response.ok || payload.status === "error") {
            setError(payload.error ?? "Kunde inte bearbeta importen.");
            return;
          }
          setTicks((value) => value + 1);
          if (payload.status === "done") {
            router.refresh();
            return;
          }
        } catch {
          setError(
            "Nätverksfel under bearbetning. Försök igen genom att ladda om sidan.",
          );
          return;
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [active, importId, router]);

  if (!active) {
    return null;
  }

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Tolkar filer i korta steg. Du kan stänga fliken och fortsätta
            senare.
          </p>
          <Progress value={Math.min(95, 12 + ticks * 8)} />
        </>
      )}
    </div>
  );
}
