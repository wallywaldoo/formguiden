import { redirect } from "next/navigation";

import { OnboardingForm } from "@/features/profiles/onboarding-form";
import { graphqlRequest } from "@/lib/graphql/client";
import { GET_ONBOARDING_STATE } from "@/lib/graphql/queries/profile";
import { createNhostClient } from "@/lib/nhost/server";
import { listTimeZones } from "@/lib/timezones";

export default async function OnboardingPage() {
  const nhost = await createNhostClient();
  if (!nhost.getUserSession()?.user) {
    redirect("/login");
  }

  try {
    const data = await graphqlRequest<{
      profiles: Array<{ onboarding_completed_at: string | null }>;
    }>(GET_ONBOARDING_STATE);
    if (data.profiles[0]?.onboarding_completed_at) {
      redirect("/overview");
    }
  } catch {
    // First-time users have no profile row yet.
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
