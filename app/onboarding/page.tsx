import { redirect } from "next/navigation";

import { OnboardingForm } from "@/features/profiles/onboarding-form";
import { getSession } from "@/lib/auth";
import { listTimeZones } from "@/lib/timezones";

// TODO [migration]: Check onboarding state from Postgres instead of GraphQL.
// For now, always show the form if user is authenticated.

export default async function OnboardingPage() {
  const authenticated = await getSession();
  if (!authenticated) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-full max-w-xl flex-col gap-8 px-6 py-12">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Välkommen</h1>
        <p className="text-muted-foreground">
          Ett kort upplägg så att Formkurvan vet din tidszon, enheter och ditt
          löpmål. Inget av det delas med andra konton.
        </p>
      </div>
      <OnboardingForm timeZones={listTimeZones()} />
    </div>
  );
}
