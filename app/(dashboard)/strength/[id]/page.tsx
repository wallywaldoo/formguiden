import { notFound } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BackendUnavailable } from "@/features/dashboard/backend-unavailable";
import { DeleteLogButton } from "@/features/logging/delete-log-button";
import {
  deleteStrengthSessionAction,
  deleteStrengthSetAction,
} from "@/features/strength/actions";
import { StrengthSessionForm } from "@/features/strength/session-form";
import { StrengthSetForm } from "@/features/strength/set-form";
import { toDatetimeLocal } from "@/lib/analytics/dates";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { getStrengthSession } from "@/lib/db/queries";
import { toFiniteNumber } from "@/lib/numbers";
import { formatMassKg } from "@/lib/units/format";

export default async function StrengthSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let data: SessionPayload | null = null;
  try {
    data = await getStrengthSession(id);
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="page-title">Styrkepass</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const session = data.strength_sessions_by_pk;
  if (!session) {
    notFound();
  }

  const timeZone = data.user_preferences[0]?.timezone || DEFAULT_TIMEZONE;
  const massUnit = data.user_preferences[0]?.mass_unit === "lb" ? "lb" : "kg";
  const nowLocal = toDatetimeLocal(new Date().toISOString(), timeZone);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="page-title">Styrkepass</h1>
          <p className="text-muted-foreground">
            {new Date(session.started_at).toLocaleString("sv-SE")}
          </p>
        </div>
        <DeleteLogButton
          action={deleteStrengthSessionAction}
          id={session.id}
          label="Ta bort passet?"
          description="Passet och alla set raderas."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pass</CardTitle>
        </CardHeader>
        <CardContent>
          <StrengthSessionForm
            timeZone={timeZone}
            nowLocal={nowLocal}
            sessionId={session.id}
            initial={{
              startedAtLocal: toDatetimeLocal(session.started_at, timeZone),
              durationMinutes:
                session.duration_s != null
                  ? Math.round(session.duration_s / 60)
                  : null,
              perceivedEffort: toFiniteNumber(session.perceived_effort),
              notes: session.notes,
            }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nytt set</CardTitle>
          <CardDescription>
            Sparas direkt efter att du lägger till det.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StrengthSetForm sessionId={session.id} massUnit={massUnit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Set</CardTitle>
        </CardHeader>
        <CardContent>
          {data.strength_sets.length === 0 ? (
            <Empty className="border-border">
              <EmptyHeader>
                <EmptyTitle>Inga set ännu</EmptyTitle>
                <EmptyDescription>
                  Lägg till övning, repetitioner och valfri vikt.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Övning</TableHead>
                  <TableHead>Reps</TableHead>
                  <TableHead>Vikt</TableHead>
                  <TableHead>RPE</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.strength_sets.map((set) => (
                  <TableRow key={set.id}>
                    <TableCell>{set.set_index}</TableCell>
                    <TableCell>{set.exercise_name}</TableCell>
                    <TableCell>{set.repetitions ?? "—"}</TableCell>
                    <TableCell>
                      {toFiniteNumber(set.mass_kg) != null
                        ? formatMassKg(toFiniteNumber(set.mass_kg)!, massUnit)
                        : "—"}
                    </TableCell>
                    <TableCell>{toFiniteNumber(set.rpe) ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <DeleteLogButton
                        action={deleteStrengthSetAction}
                        id={set.id}
                        sessionId={session.id}
                        label="Ta bort set?"
                        description="Setet raderas från passet."
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type SessionPayload = {
  user_preferences: Array<{ timezone: string; mass_unit: string }>;
  strength_sessions_by_pk: {
    id: string;
    started_at: string;
    duration_s: number | null;
    perceived_effort: unknown;
    notes: string | null;
    source: string;
  } | null;
  strength_sets: Array<{
    id: string;
    set_index: number;
    exercise_name: string;
    repetitions: number | null;
    mass_kg: unknown;
    rpe: unknown;
    notes: string | null;
  }>;
};
