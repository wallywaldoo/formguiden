import Link from "next/link";

import { SignInForm } from "@/features/auth/sign-in-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Logga in</h1>
        <p className="text-muted-foreground">
          Välkommen tillbaka till Formkurvan.
        </p>
      </div>
      <SignInForm initialError={params.error} />
      <p className="text-center text-sm text-muted-foreground">
        Inget konto?{" "}
        <Link href="/signup" className="underline-offset-4 hover:underline">
          Skapa ett
        </Link>
      </p>
    </div>
  );
}
