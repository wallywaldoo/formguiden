import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">
        Sidan finns inte
      </h1>
      <p className="text-muted-foreground">
        Kontrollera adressen eller gå tillbaka till startsidan.
      </p>
      <Button asChild>
        <Link href="/">Till startsidan</Link>
      </Button>
    </main>
  );
}
