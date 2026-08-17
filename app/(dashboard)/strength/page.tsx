import Link from "next/link";

import { Button } from "@/components/ui/button";
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
import { MetricCard } from "@/features/dashboard/metric-card";
import { StrengthSessionForm } from "@/features/strength/session-form";
import { strengthFrequency } from "@/lib/analytics/strength";
import type { AnalyticsContext } from "@/lib/analytics/types";
import { toDatetimeLocal } from "@/lib/analytics/dates";
import { DEFAULT_TIMEZONE } from "@/lib/constants";
import { graphqlRequest } from "@/lib/graphql/client";
import { LIST_STRENGTH } from "@/lib/graphql/queries/logging";
import { toFiniteNumber } from "@/lib/numbers";
import { formatDurationHms } from "@/lib/units/pace";

export default async function StrengthPage() {
  const now = new Date();
  const since = new Date(now.getTime() - 90 * 86_400_000).toISOString();

  let data: StrengthPayload | null = null;
  try {
    data = await graphqlRequest<StrengthPayload>(LIST_STRENGTH, { since });
  } catch {
    data = null;
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Styrka</h1>
        <BackendUnavailable />
      </div>
    );
  }

  const timeZone = data.user_preferences[0]?.timezone || DEFAULT_TIMEZONE;
  const context: AnalyticsContext = {
    timeZone,
    now,
    goal: {
      weeklyRunDistanceM: null,
      targetPaceSPerKm: null,
      targetMassKg: null,
    },
  };
  const target = data.goals[0]?.weekly_strength_sessions ?? null;
  const frequency = strengthFrequency(
    data.strength_sessions.map((session) => ({
      startedAt: session.started_at,
    })),
    context,
    target,
  );
  const nowLocal = toDatetimeLocal(now.toISOString(), timeZone);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Styrka</h1>
        <p className="text-muted-foreground">
          Skapa ett pass, sedan lägger du till set. Set sparas direkt.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MetricCard
          title="Pass senaste 7 dagarna"
          value={String(frequency.value ?? 0)}
          caption={
            target != null ? `Mål ${target} pass / vecka` : "Inget veckomål"
          }
          explanation="Antal styrkepass med started_at de senaste 7 lokala dagarna, jämfört med weekly_strength_sessions."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nytt pass</CardTitle>
          <CardDescription>
            Efter första sparningen öppnas passet så du kan lägga set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StrengthSessionForm timeZone={timeZone} nowLocal={nowLocal} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pass</CardTitle>
        </CardHeader>
        <CardContent>
          {data.strength_sessions.length === 0 ? (
            <Empty className="border-border">
              <EmptyHeader>
                <EmptyTitle>Inga styrkepass</EmptyTitle>
                <EmptyDescription>
                  Skapa ett pass ovan. Övningsnamn är fri text i MVP.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start</TableHead>
                  <TableHead>Tid</TableHead>
                  <TableHead>Ansträngning</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.strength_sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      {new Date(session.started_at).toLocaleString("sv-SE")}
                    </TableCell>
                    <TableCell>
                      {session.duration_s != null
                        ? formatDurationHms(session.duration_s)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {toFiniteNumber(session.perceived_effort) ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/strength/${session.id}`}>Öppna</Link>
                      </Button>
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

type StrengthPayload = {
  user_preferences: Array<{ timezone: string; mass_unit: string }>;
  goals: Array<{ weekly_strength_sessions: number | null }>;
  strength_sessions: Array<{
    id: string;
    started_at: string;
    duration_s: number | null;
    perceived_effort: unknown;
    notes: string | null;
    source: string;
  }>;
};
