import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CancelDeletionForm } from "@/features/privacy/cancel-deletion-form";
import { graphqlRequest } from "@/lib/graphql/client";
import { GET_PENDING_DELETION } from "@/lib/graphql/queries/coaching";
import { redirect } from "next/navigation";

export default async function DeletionPendingPage() {
  let pending: {
    id: string;
    requested_at: string;
    purge_after: string;
  } | null = null;

  try {
    const data = await graphqlRequest<{
      account_deletion_requests: Array<{
        id: string;
        requested_at: string;
        purge_after: string;
      }>;
    }>(GET_PENDING_DELETION);
    pending = data.account_deletion_requests[0] ?? null;
  } catch {
    pending = null;
  }

  if (!pending) {
    redirect("/overview");
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Radering väntar
        </h1>
        <p className="text-muted-foreground">
          Ditt konto är markerat för radering. Data är dold tills du avbryter
          eller permanent radering sker.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ångerperiod</CardTitle>
          <CardDescription>
            Begärd {new Date(pending.requested_at).toLocaleString("sv-SE")}.
            Permanent radering tidigast{" "}
            {new Date(pending.purge_after).toLocaleString("sv-SE")}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CancelDeletionForm requestId={pending.id} />
          <p className="text-sm text-muted-foreground">
            Vill du läsa integritetstexten?{" "}
            <Link href="/settings/privacy" className="underline">
              Integritet
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
