import Link from "next/link";

import type { DailyEnergyBalance } from "@/lib/analytics/daily-energy";
import { DEFAULT_HYDRATION_TARGET_ML } from "@/lib/constants";
import { formatHours, formatVolumeMl } from "@/lib/units/format";

function DailyTile({
  href,
  label,
  value,
  detail,
}: {
  href: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Link
      href={href}
      className="surface-tile flex min-h-16 flex-1 flex-col px-3.5 py-3 transition-colors hover:bg-white/55"
    >
      <p className="text-[0.75rem] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-[1.15rem] font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-[0.75rem] text-muted-foreground">{detail}</p>
    </Link>
  );
}

export function OverviewDaily({
  energy,
  energyIncomplete,
  waterMl,
  waterTargetMl,
  volumeUnit,
  sleepS,
  steps,
  embedded = false,
}: {
  energy: DailyEnergyBalance | null;
  energyIncomplete: boolean;
  waterMl: number;
  waterTargetMl?: number;
  volumeUnit: "ml" | "floz";
  sleepS: number | null;
  steps: number | null;
  embedded?: boolean;
}) {
  const targetMl = waterTargetMl ?? DEFAULT_HYDRATION_TARGET_ML;
  const waterRatio = targetMl > 0 ? waterMl / targetMl : 0;
  const kcalValue =
    energy != null
      ? `${Math.round(energy.remainingKcal).toLocaleString("sv-SE")}`
      : energyIncomplete
        ? "—"
        : "0";
  const kcalDetail =
    energy != null
      ? `${Math.round(energy.loggedKcal).toLocaleString("sv-SE")} intag · ${Math.round(energy.budgetKcal).toLocaleString("sv-SE")} mål`
      : energyIncomplete
        ? "Fyll i profil"
        : "kcal kvar";

  return (
    <section className={embedded ? "space-y-2" : "space-y-2"}>
      {embedded ? null : (
        <h2 className="px-0.5 text-[0.82rem] font-medium text-muted-foreground">
          Idag
        </h2>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DailyTile
          href={energyIncomplete ? "/settings/profile" : "/nutrition"}
          label="Kalorier kvar"
          value={kcalValue}
          detail={kcalDetail}
        />
        <Link
          href="/nutrition?tab=hydration"
          className="surface-tile flex min-h-16 flex-1 flex-col px-3.5 py-3 transition-colors hover:bg-white/55"
        >
          <p className="text-[0.75rem] font-medium text-muted-foreground">
            Vatten
          </p>
          <p className="mt-1 text-[1.15rem] font-semibold tabular-nums">
            {formatVolumeMl(waterMl, volumeUnit)}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
            {formatVolumeMl(targetMl, volumeUnit)}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/55">
            <div
              className="h-full rounded-full bg-foreground/80"
              style={{
                width: `${Math.round(Math.max(0, Math.min(1, waterRatio)) * 100)}%`,
              }}
            />
          </div>
        </Link>
        <DailyTile
          href="/recovery"
          label="Sömn"
          value={sleepS != null ? formatHours(sleepS) : "—"}
          detail="Inatt"
        />
        <DailyTile
          href="/recovery"
          label="Steg"
          value={steps != null ? steps.toLocaleString("sv-SE") : "—"}
          detail="Idag"
        />
      </div>
      {energy != null && energy.activityKcal > 0 ? (
        <p className="px-0.5 text-[0.75rem] text-muted-foreground">
          +{Math.round(energy.activityKcal).toLocaleString("sv-SE")} kcal från
          dagens pass
        </p>
      ) : null}
    </section>
  );
}
