import Link from "next/link";

import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Återställ lösenord
        </h1>
        <p className="text-muted-foreground">
          Vi skickar en länk om adressen finns. Vi avslöjar inte om kontot
          finns.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="underline-offset-4 hover:underline">
          Tillbaka till inloggning
        </Link>
      </p>
    </div>
  );
}
