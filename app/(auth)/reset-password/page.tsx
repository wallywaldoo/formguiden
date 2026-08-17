import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Nytt lösenord</h1>
        <p className="text-muted-foreground">
          Välj ett lösenord med minst nio tecken.
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
