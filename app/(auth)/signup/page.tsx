import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { SignUpForm } from "@/features/auth/sign-up-form";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; verify?: string; email?: string }>;
}) {
  const params = await searchParams;

  if (params.verify === "success") {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">
          Kolla din e-post
        </h1>
        <Alert>
          <AlertTitle>Verifieringslänk skickad</AlertTitle>
          <AlertDescription>
            Vi har skickat en länk till {params.email ?? "din e-post"}. Klicka
            på den i samma webbläsare för att aktivera kontot.
          </AlertDescription>
        </Alert>
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="underline-offset-4 hover:underline">
            Tillbaka till inloggning
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Skapa konto</h1>
        <p className="text-muted-foreground">
          Ett privat konto. Ingen annan kan se din hälsodata.
        </p>
      </div>
      <SignUpForm initialError={params.error} />
      <p className="text-center text-sm text-muted-foreground">
        Har du redan ett konto?{" "}
        <Link href="/login" className="underline-offset-4 hover:underline">
          Logga in
        </Link>
      </p>
    </div>
  );
}
