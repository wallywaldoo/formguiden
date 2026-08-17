"use client";

import { useEffect } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTitle>Kunde inte ladda sidan</AlertTitle>
        <AlertDescription>
          Försök igen. Om felet fortsätter, logga ut och in.
        </AlertDescription>
      </Alert>
      <Button type="button" onClick={reset}>
        Försök igen
      </Button>
    </div>
  );
}
