import Link from "next/link";
import type { ReactNode } from "react";

import { CollapsiblePanel } from "@/components/dashboard/collapsible-panel";
import { OverviewWeight } from "@/features/dashboard/overview-weight";
import {
  buildRaceComparison,
  formatRaceClock,
} from "@/lib/analytics/race-estimates";
import {
  hasRunningRecords,
  type GarminRunningRecords,
} from "@/lib/garmin/personal-records";
import { formatDistanceKm } from "@/lib/units/format";
import { cn } from "@/lib/utils";

function clock(seconds: number | null): string {
  return seconds != null ? formatRaceClock(seconds) : "—";
}

function StatTile({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="surface-tile px-3.5 py-3 transition-colors hover:bg-white/55"
    >
      <p className="text-[0.75rem] font-medium text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[1.15rem] font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[0.75rem] text-muted-foreground">{detail}</p>
    </Link>
  );
}

export function OverviewInsights({
  paceSPerKm,
  personalRecords,
  goalRaceType,
  vo2Max,
  stats,
  runTrend,
  currentKg,
  targetKg,
  trendKgPerWeek,
  timeZone,
  nowLocal,
  massUnit,
  distanceUnit,
}: {
  paceSPerKm: number | null;
  personalRecords: GarminRunningRecords | null;
  goalRaceType?: string | null;
  vo2Max: number | null;
  stats: Array<{ label: string; value: string; detail: string; href: string }>;
  runTrend: ReactNode;
  currentKg: number | null;
  targetKg: number | null;
  trendKgPerWeek: number | null;
  timeZone: string;
  nowLocal: string;
  massUnit: "kg" | "lb";
  distanceUnit: "km" | "mi";
}) {
  const rows = buildRaceComparison({
    paceSPerKm,
    goalRaceType,
    records: personalRecords,
  });
  const hasRecords = hasRunningRecords(personalRecords);
  const longestRun =
    personalRecords?.longestRunM != null
      ? formatDistanceKm(personalRecords.longestRunM, distanceUnit)
      : null;
  const formStats = [
    {
      label: "VO₂ max",
      value:
        vo2Max != null
          ? vo2Max.toLocaleString("sv-SE", { maximumFractionDigits: 1 })
          : "—",
      detail: vo2Max != null ? "Garmin" : "—",
      href: "/running",
    },
    ...stats,
  ];

  return (
    <CollapsiblePanel
      storageKey="fk:collapse:insights"
      title="Prognos & statistik"
      bodyClassName="space-y-6 px-5 py-5"
    >
      <div>
        <p className="text-[0.82rem] font-medium text-muted-foreground">Form</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {formStats.map((metric) => (
            <StatTile key={metric.label} {...metric} />
          ))}
        </div>
      </div>

      <OverviewWeight
        embedded
        currentKg={currentKg}
        targetKg={targetKg}
        trendKgPerWeek={trendKgPerWeek}
        timeZone={timeZone}
        nowLocal={nowLocal}
        massUnit={massUnit}
      />

      <div>
        <p className="text-[0.82rem] font-medium text-muted-foreground">
          Löptrend
        </p>
        <div className="mt-2">{runTrend}</div>
      </div>

      <div>
        <p className="text-[0.82rem] font-medium text-muted-foreground">Lopp</p>
        <table className="mt-2 w-full border-collapse text-[0.95rem]">
          <caption className="sr-only">
            Uppskattade tider jämfört med Garmin-rekord
          </caption>
          <thead>
            <tr className="text-[0.7rem] font-medium text-muted-foreground">
              <th scope="col" className="pb-2 pr-3 text-left font-medium">
                Distans
              </th>
              <th scope="col" className="pb-2 px-1 text-right font-medium">
                Uppskattat
              </th>
              <th scope="col" className="pb-2 pl-3 text-right font-medium">
                Rekord
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.key}
                className={cn(
                  "border-t border-white/45",
                  row.isGoal && "bg-white/35",
                )}
              >
                <th
                  scope="row"
                  className="py-2.5 pr-3 text-left text-[0.82rem] font-medium text-muted-foreground"
                >
                  {row.label}
                  {row.isGoal ? (
                    <span className="sr-only">, mållopp</span>
                  ) : null}
                </th>
                <td className="py-2.5 px-1 text-right font-semibold tabular-nums">
                  {clock(row.estimatedS)}
                </td>
                <td className="py-2.5 pl-3 text-right font-semibold tabular-nums">
                  {clock(row.recordS)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2.5 text-[0.75rem] text-muted-foreground">
          {hasRecords
            ? longestRun
              ? `Längst pass ${longestRun}`
              : "Rekord från Garmin"
            : "Synka Garmin för att hämta rekord."}
        </p>
      </div>
    </CollapsiblePanel>
  );
}
