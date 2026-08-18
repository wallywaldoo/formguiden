import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { DeletionGate } from "@/features/privacy/deletion-gate";
import { DashboardDropCatch } from "@/features/sync/dashboard-drop-catch";
import { graphqlRequest } from "@/lib/graphql/client";
import { GET_PENDING_DELETION } from "@/lib/graphql/queries/coaching";
import { GET_ONBOARDING_STATE } from "@/lib/graphql/queries/profile";
import { createNhostClient } from "@/lib/nhost/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nhost = await createNhostClient();
  const session = nhost.getUserSession();
  if (!session?.user) {
    redirect("/login");
  }

  let onboardingCompleted = false;
  try {
    const data = await graphqlRequest<{
      profiles: Array<{
        onboarding_completed_at: string | null;
        display_name: string | null;
      }>;
    }>(GET_ONBOARDING_STATE);
    onboardingCompleted = Boolean(data.profiles[0]?.onboarding_completed_at);
  } catch {
    onboardingCompleted = false;
  }

  if (!onboardingCompleted) {
    redirect("/onboarding");
  }

  let deletionPending = false;
  try {
    const deletion = await graphqlRequest<{
      account_deletion_requests: Array<{ id: string }>;
    }>(GET_PENDING_DELETION);
    deletionPending = deletion.account_deletion_requests.length > 0;
  } catch {
    deletionPending = false;
  }

  return (
    <AppShell
      displayName={session.user.displayName || session.user.email || "Konto"}
    >
      <DeletionGate pending={deletionPending}>
        <DashboardDropCatch>{children}</DashboardDropCatch>
      </DeletionGate>
    </AppShell>
  );
}
