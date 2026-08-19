import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Registrering avstängd
        </h1>
        <p className="text-muted-foreground">
          Formkurvan är en privat app för en enda användare. Registrering är inte
          tillgänglig.
        </p>
      </div>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline-offset-4 hover:underline">
          Tillbaka till inloggning
        </Link>
      </p>
    </div>
  );
}
