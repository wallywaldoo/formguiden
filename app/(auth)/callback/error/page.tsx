import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default async function CallbackErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Något gick fel</h1>
      <Alert variant="destructive">
        <AlertTitle>Kunde inte slutföra inloggningen</AlertTitle>
        <AlertDescription>
          {params.message ?? "Okänt fel. Försök igen."}
        </AlertDescription>
      </Alert>
      <Button asChild variant="outline">
        <Link href="/login">Till inloggning</Link>
      </Button>
    </div>
  );
}
