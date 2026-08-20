import Link from "next/link";

import { CollapsiblePanel } from "@/components/dashboard/collapsible-panel";
import type { ActivityAnalysis } from "@/lib/analytics/activity-detail";
import { formatDurationHms, formatPaceMinPerKm } from "@/lib/units/pace";

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="surface-tile min-w-0 px-3.5 py-3">
      <p className="text-[0.72rem] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[1.05rem] font-semibold tabular-nums">{value}</p>
      {detail ? (
        <p className="mt-0.5 text-[0.72rem] text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );
}

function pace(value: number | null): string {
  return value != null ? `${formatPaceMinPerKm(value)} /km` : "—";
}

function bpm(value: number | null): string {
  return value != null ? `${Math.round(value)} bpm` : "—";
}

function signedPace(value: number | null): string {
  if (value == null) return "—";
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${formatPaceMinPerKm(Math.abs(value))} /km`;
}

function signedBpm(value: number | null): string {
  if (value == null) return "—";
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${Math.round(Math.abs(value))} bpm`;
}

const SPLIT_LABEL = {
  positive: "Positiv split",
  negative: "Negativ split",
  even: "Jämn split",
} as const;

export function ActivityAnalysisPanel({
  analysis,
}: {
  analysis: ActivityAnalysis;
}) {
  return (
    <div className="space-y-4">
      {analysis.insights.length > 0 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:activity-insights"
          title="Analys"
          bodyClassName="space-y-2 px-4 py-4 md:px-5"
        >
          <ul className="space-y-2">
            {analysis.insights.map((insight) => (
              <li
                key={insight}
                className="text-[0.88rem] leading-6 text-foreground"
              >
                {insight}
              </li>
            ))}
          </ul>
        </CollapsiblePanel>
      ) : null}

      <CollapsiblePanel
        storageKey="fk:collapse:activity-form"
        title="Form och jämnhet"
        bodyClassName="space-y-3 px-4 py-4 md:px-5"
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Split"
            value={
              analysis.halves.splitKind
                ? SPLIT_LABEL[analysis.halves.splitKind]
                : "—"
            }
            detail={
              analysis.halves.splitDeltaS != null
                ? `${signedPace(analysis.halves.splitDeltaS)} andra vs första`
                : undefined
            }
          />
          <Stat
            label="Första halvan"
            value={pace(analysis.halves.firstPaceSPerKm)}
            detail={bpm(analysis.halves.firstHr)}
          />
          <Stat
            label="Andra halvan"
            value={pace(analysis.halves.secondPaceSPerKm)}
            detail={bpm(analysis.halves.secondHr)}
          />
          <Stat
            label="Decoupling"
            value={
              analysis.halves.decouplingPct != null
                ? `${analysis.halves.decouplingPct.toFixed(1)} %`
                : "—"
            }
            detail="Puls mot tempo, andra vs första"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Tempo CV"
            value={
              analysis.pace.cvPct != null
                ? `${analysis.pace.cvPct.toFixed(1)} %`
                : "—"
            }
            detail="Lägre är jämnare"
          />
          <Stat
            label="Snabbaste"
            value={pace(analysis.pace.min)}
            detail={
              analysis.pace.max != null
                ? `Långsammaste ${formatPaceMinPerKm(analysis.pace.max)}`
                : undefined
            }
          />
          <Stat
            label="Puls min–max"
            value={
              analysis.heartRate.min != null && analysis.heartRate.max != null
                ? `${Math.round(analysis.heartRate.min)}–${Math.round(analysis.heartRate.max)}`
                : "—"
            }
            detail={
              analysis.heartRate.stdDev != null
                ? `σ ${analysis.heartRate.stdDev.toFixed(0)} bpm`
                : undefined
            }
          />
          <Stat
            label="Kadens"
            value={
              analysis.cadence.avg != null
                ? `${Math.round(analysis.cadence.avg)} spm`
                : "—"
            }
            detail={
              analysis.cadence.min != null && analysis.cadence.max != null
                ? `${Math.round(analysis.cadence.min)}–${Math.round(analysis.cadence.max)}`
                : undefined
            }
          />
        </div>
        {analysis.power.avg != null || analysis.temperature.avg != null ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {analysis.power.avg != null ? (
              <Stat
                label="Effekt"
                value={`${Math.round(analysis.power.avg)} W`}
                detail={
                  analysis.power.max != null
                    ? `Max ${Math.round(analysis.power.max)} W`
                    : undefined
                }
              />
            ) : null}
            {analysis.temperature.avg != null ? (
              <Stat
                label="Temperatur"
                value={`${analysis.temperature.avg.toFixed(1)} °C`}
                detail={
                  analysis.temperature.max != null
                    ? `Max ${analysis.temperature.max.toFixed(1)} °C`
                    : undefined
                }
              />
            ) : null}
            {analysis.pauseS != null ? (
              <Stat
                label="Paus"
                value={formatDurationHms(Math.round(analysis.pauseS))}
                detail="Total minus förflyttning"
              />
            ) : null}
            {analysis.gradeMPerKm != null ? (
              <Stat
                label="Stigning"
                value={`${Math.round(analysis.gradeMPerKm)} m/km`}
              />
            ) : null}
          </div>
        ) : null}
      </CollapsiblePanel>

      {analysis.bestEfforts.length > 0 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:activity-efforts"
          title="Bästa sträckor i passet"
          bodyClassName="px-4 py-4 md:px-5"
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {analysis.bestEfforts.map((effort) => (
              <Stat
                key={effort.label}
                label={effort.label}
                value={formatDurationHms(Math.round(effort.durationS))}
                detail={pace(effort.paceSPerKm)}
              />
            ))}
          </div>
        </CollapsiblePanel>
      ) : null}

      {analysis.compare.sampleSize > 0 ? (
        <CollapsiblePanel
          storageKey="fk:collapse:activity-compare"
          title="Mot senaste liknande pass"
          bodyClassName="space-y-3 px-4 py-4 md:px-5"
        >
          <p className="text-[0.78rem] text-muted-foreground">
            {analysis.compare.sampleSize} pass inom ±25 % distans.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              label="Ditt tempo"
              value={pace(analysis.pace.avg)}
              detail={
                analysis.compare.similarPaceSPerKm != null
                  ? `Snitt ${formatPaceMinPerKm(analysis.compare.similarPaceSPerKm)}`
                  : undefined
              }
            />
            <Stat
              label="Skillnad tempo"
              value={signedPace(analysis.compare.paceDeltaS)}
              detail="Negativt är snabbare"
            />
            <Stat
              label="Din puls"
              value={bpm(analysis.heartRate.avg)}
              detail={
                analysis.compare.similarHr != null
                  ? `Snitt ${Math.round(analysis.compare.similarHr)} bpm`
                  : undefined
              }
            />
            <Stat
              label="Skillnad puls"
              value={signedBpm(analysis.compare.hrDeltaBpm)}
            />
          </div>
          <Link
            href="/running"
            className="text-[0.78rem] text-muted-foreground hover:text-foreground"
          >
            Se alla pass →
          </Link>
        </CollapsiblePanel>
      ) : null}
    </div>
  );
}
