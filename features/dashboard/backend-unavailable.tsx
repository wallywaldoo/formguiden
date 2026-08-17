import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function BackendUnavailable() {
  return (
    <Alert>
      <AlertTitle>Tjänsten är tillfälligt otillgänglig</AlertTitle>
      <AlertDescription>
        Nhost kan vara pausad efter inaktivitet. Försök igen om en stund.
      </AlertDescription>
    </Alert>
  );
}
