import Link from "next/link";

import { Button } from "@/components/ui/button";
import { createNhostClient } from "@/lib/nhost/server";

export default async function HomePage() {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();

  return (
    <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          Formkurvan
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Kör. Kom hem. Se formen.
        </h1>
        <p className="text-lg text-muted-foreground">
          Formkurvan är din privata coach. Du släpper Garmin-filen efter passet
          — vi tar bara det som är nytt. Inget lösenord till Garmin, ingen data
          som delas med någon annan.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        {session ? (
          <Button asChild>
            <Link href="/overview">Öppna översikten</Link>
          </Button>
        ) : (
          <>
            <Button asChild>
              <Link href="/signup">Skapa konto</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Logga in</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
