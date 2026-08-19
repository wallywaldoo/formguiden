import { redirect } from "next/navigation";

import { AppShell } from "@/components/navigation/app-shell";
import { DeletionGate } from "@/features/privacy/deletion-gate";
import { DashboardDropCatch } from "@/features/sync/dashboard-drop-catch";
import { getSession } from "@/lib/auth";

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

  return (
    <AppShell displayName="Viktor">
      <DeletionGate pending={false}>
        <DashboardDropCatch>{children}</DashboardDropCatch>
      </DeletionGate>
    </AppShell>
  );
}
