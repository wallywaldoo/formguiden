import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImportConfirmBar } from "@/features/imports/import-confirm-bar";
import { ImportProcessRunner } from "@/features/imports/import-process-runner";
import {
  ACTIVITY_TYPE_LABEL,
  FILE_STATUS_LABEL,
  IMPORT_STATUS_LABEL,
} from "@/features/imports/labels";
import { graphqlRequest } from "@/lib/graphql/client";
import { GET_IMPORT } from "@/lib/graphql/queries/imports";
import { toFiniteNumber } from "@/lib/numbers";
import { formatPaceMinPerKm } from "@/lib/units/pace";

export default async function ImportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let data: ImportPayload | null = null;
  try {
    data = await graphqlRequest<ImportPayload>(GET_IMPORT, { id });
  } catch {
    data = null;
  }

  if (!data?.data_imports_by_pk) {
    notFound();
  }

  const item = data.data_imports_by_pk;
  const active = ["uploaded", "queued", "processing"].includes(item.status);
  const canConfirm = ["preview_ready", "partial"].includes(item.status);
  const previewCount =
    data.activity_previews.length +
    data.daily_health_metric_previews.length +
    data.body_measurement_previews.length;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Import</h1>
        <p className="text-muted-foreground">
          {new Date(item.created_at).toLocaleString("sv-SE")}
        </p>
        <Badge variant="secondary">
          {IMPORT_STATUS_LABEL[item.status] ?? item.status}
        </Badge>
      </div>

      <ImportProcessRunner importId={id} active={active} />

      {item.error_summary ? (
        <p className="text-sm text-destructive">{item.error_summary}</p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Filer</CardTitle>
        </CardHeader>
        <CardContent>
          {data.import_files.length === 0 ? (
            <p className="text-sm text-muted-foreground">Inga filer ännu.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Kommentar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.import_files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      {file.zip_entry_path ?? file.original_filename ?? "fil"}
                    </TableCell>
                    <TableCell>{file.detected_kind ?? "—"}</TableCell>
                    <TableCell>
                      {FILE_STATUS_LABEL[file.status] ?? file.status}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {file.error_message ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Förhandsvisning</CardTitle>
          <CardDescription>
            Inget sparas i träningsdatan förrän du bekräftar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {data.activity_previews.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Distans</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Puls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.activity_previews.map((activity) => {
                  const distanceM = toFiniteNumber(activity.distance_m);
                  const pace = toFiniteNumber(activity.avg_pace_s_per_km);
                  return (
                    <TableRow key={activity.id}>
                      <TableCell>
                        {new Date(activity.started_at).toLocaleString("sv-SE")}
                      </TableCell>
                      <TableCell>
                        {ACTIVITY_TYPE_LABEL[activity.activity_type] ??
                          activity.activity_type}
                      </TableCell>
                      <TableCell>
                        {distanceM != null
                          ? `${(distanceM / 1000).toFixed(2)} km`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {pace != null ? `${formatPaceMinPerKm(pace)} /km` : "—"}
                      </TableCell>
                      <TableCell>
                        {activity.avg_heart_rate_bpm ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">
              Inga aktiviteter ännu.
            </p>
          )}
          {data.daily_health_metric_previews.length ? (
            <p className="text-sm text-muted-foreground">
              {data.daily_health_metric_previews.length} hälsodagar i
              förhandsvisningen.
            </p>
          ) : null}
          {data.body_measurement_previews.length ? (
            <p className="text-sm text-muted-foreground">
              {data.body_measurement_previews.length} kroppsmått i
              förhandsvisningen.
            </p>
          ) : null}
          <ImportConfirmBar
            importId={id}
            canConfirm={canConfirm && previewCount > 0}
            canAbandon={canConfirm || active}
          />
        </CardContent>
      </Card>
    </div>
  );
}

type ImportPayload = {
  data_imports_by_pk: {
    id: string;
    status: string;
    error_summary: string | null;
    created_at: string;
  } | null;
  import_files: Array<{
    id: string;
    original_filename: string | null;
    detected_kind: string | null;
    status: string;
    zip_entry_path: string | null;
    error_message: string | null;
  }>;
  activity_previews: Array<{
    id: string;
    activity_type: string;
    started_at: string;
    distance_m: unknown;
    avg_pace_s_per_km: unknown;
    avg_heart_rate_bpm: number | null;
  }>;
  daily_health_metric_previews: Array<{ id: string }>;
  body_measurement_previews: Array<{ id: string }>;
};
