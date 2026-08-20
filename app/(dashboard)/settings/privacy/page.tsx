import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AutomationTokenForm } from "@/features/automation/token-form";
import { ExportPanel } from "@/features/privacy/export-panel";
import { AccountDeletionForm } from "@/features/privacy/deletion-form";
import { GarminSyncPanel } from "@/features/sync/garmin-sync-panel";
import { PRIVACY_DOCUMENT_VERSION } from "@/lib/constants";
import { getGarminIntegrationStatus, listExportJobs } from "@/lib/db/queries";
import { readGarminSyncStatus } from "@/lib/garmin/status";
import sql from "@/lib/db";

export default async function AccountSettingsPage() {
  const [jobsResult, garminResult, importResult] = await Promise.allSettled([
    listExportJobs(),
    getGarminIntegrationStatus(),
    sql`
      SELECT status, created_at, committed_at, committed_count
      FROM data_imports
      WHERE provider = 'garmin-sync'
      ORDER BY created_at DESC
      LIMIT 1
    `,
  ]);

  const jobs =
    jobsResult.status === "fulfilled"
      ? jobsResult.value
      : [];
  const garminStatus = readGarminSyncStatus(
    garminResult.status === "fulfilled" ? garminResult.value : null,
  );
  const lastImport =
    importResult.status === "fulfilled"
      ? ((importResult.value[0] as unknown as {
          status: string;
          created_at: string;
          committed_at: string | null;
          committed_count: number;
        }) ?? null)
      : null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="page-title">Konto</h1>

      <GarminSyncPanel initialStatus={garminStatus} />

      <Card>
        <CardHeader>
          <CardTitle>Lokal Garmin-sync</CardTitle>
          <CardDescription>
            Ett skript på din dator hämtar från Garmin Connect. Inloggningen
            lämnar aldrig maskinen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {lastImport ? (
            <p>
              Senaste körningen:{" "}
              {new Date(
                lastImport.committed_at ?? lastImport.created_at,
              ).toLocaleString("sv-SE")}
              {lastImport.status === "committed"
                ? ` · ${lastImport.committed_count} rader landade`
                : ` · status ${lastImport.status}`}
              .
            </p>
          ) : (
            <p>Ingen automatisk körning har kommit in än.</p>
          )}
          <AutomationTokenForm tokens={[]} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integritet</CardTitle>
          <CardDescription>
            Dokumentversion {PRIVACY_DOCUMENT_VERSION}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Hälsodata är privat per konto. Garmin-filer är export du själv
            laddar upp. Formkurvan ger inga medicinska råd.
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
