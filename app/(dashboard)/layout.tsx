import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { DeletionGate } from "@/features/privacy/deletion-gate";
import { DashboardDropCatch } from "@/features/sync/dashboard-drop-catch";
import { getSession } from "@/lib/auth";
import { getProfileSettings } from "@/lib/db/queries";

// TODO [migration]: Replace GraphQL queries with direct SQL queries to check
// onboarding state. For now, skip onboarding check and deletion gate.

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authenticated = await getSession();
  if (!authenticated) {
    redirect("/login");
  }

  const profileData = await getProfileSettings().catch(() => null);
  const profile = profileData?.profiles[0];
  const displayName = profile?.display_name?.trim() || "Användare";

  return (
    <AppShell displayName={displayName}>
      <DeletionGate pending={false}>
        <DashboardDropCatch>{children}</DashboardDropCatch>
      </DeletionGate>
    </AppShell>
  );
}
