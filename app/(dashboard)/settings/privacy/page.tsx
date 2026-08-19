import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExportPanel } from "@/features/privacy/export-panel";
import { AccountDeletionForm } from "@/features/privacy/deletion-form";
import { PRIVACY_DOCUMENT_VERSION } from "@/lib/constants";
import { listExportJobs } from "@/lib/db/queries";

export default async function PrivacySettingsPage() {
  let jobs: Array<{
    id: string;
    status: string;
    error_summary: string | null;
    created_at: string;
    completed_at: string | null;
  }> = [];

  try {
    jobs = await listExportJobs();
  } catch {
    jobs = [];
  }

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Integritet</h1>
        <p className="text-muted-foreground">
          Hälsodata är privat per konto. Formkurvan ger inga medicinska råd.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Godkännande</CardTitle>
          <CardDescription>
            Dokumentversion {PRIVACY_DOCUMENT_VERSION}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Du har bekräftat att Garmin-filer är export du själv laddar upp, att
            ingen annan användare kan läsa dina rader, och att appen inte är
            vård.
          </p>
          <p>
            Session-cookien är httpOnly och skyddad mot XSS.
            En CSRF-attack mot formulär motverkas av SameSite=lax.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Exportera data</CardTitle>
          <CardDescription>
            ZIP med JSON, CSV och dina Garmin-filer om de finns kvar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportPanel jobs={jobs} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Radera konto</CardTitle>
          <CardDescription>
            7 dagars ångerperiod innan permanent radering.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AccountDeletionForm />
        </CardContent>
      </Card>
    </div>
  );
}
