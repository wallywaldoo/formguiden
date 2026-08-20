import Link from "next/link";
import { Award, CircleDashed, Medal, Trophy } from "lucide-react";
import type { ComponentType } from "react";

import type { RecapMedal, WeekRecap } from "@/lib/analytics/week-recap";

export const RECAP_MEDAL_META: Record<
  RecapMedal,
  {
    label: string;
    Icon: ComponentType<{ className?: string }>;
    iconClass: string;
  }
> = {
  gold: {
    label: "Guld",
    Icon: Trophy,
    iconClass: "text-amber-700",
  },
  silver: {
    label: "Silver",
    Icon: Medal,
    iconClass: "text-slate-500",
  },
  bronze: {
    label: "Brons",
    Icon: Award,
    iconClass: "text-orange-800/80",
  },
  none: {
    label: "Utan medalj",
    Icon: CircleDashed,
    iconClass: "text-muted-foreground",
  },
};

export function formatWeekSpan(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    day: "numeric",
    month: "short",
  });
  const toDate = (value: string) => {
    const [year, month, day] = value.split("-").map(Number) as [
      number,
      number,
      number,
    ];
    return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  };
  return `${fmt.format(toDate(start))}–${fmt.format(toDate(end))}`;
}

export function WeekRecapCard({
  recap,
  variant = "archive",
}: {
  recap: WeekRecap;
  variant?: "monday" | "archive";
}) {
  const medal = RECAP_MEDAL_META[recap.medal];
  const Icon = medal.Icon;
  const kicker = variant === "monday" ? "Förra veckan" : "Veckosummering";

  return (
    <div
      className="surface-soft space-y-4 px-4 py-3.5"
      aria-label={`${kicker}, betyg ${recap.score} av 10`}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex w-16 shrink-0 flex-col items-center gap-0.5">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/70">
            <Icon className={`size-6 ${medal.iconClass}`} aria-hidden />
          </div>
          <p className="text-[1.15rem] font-semibold tabular-nums leading-none">
            {recap.score}
            <span className="text-[0.72rem] font-medium text-muted-foreground">
              /10
            </span>
          </p>
          {recap.medal === "none" ? null : (
            <p className="text-[0.68rem] font-medium text-muted-foreground">
              {medal.label}
            </p>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-medium text-muted-foreground">
            {kicker} · {formatWeekSpan(recap.weekStart, recap.weekEnd)}
          </p>
          <p className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em]">
            {recap.headline}
          </p>
          <p className="mt-1 text-[0.84rem] leading-5 text-muted-foreground">
            {recap.summary}
          </p>
          {variant === "monday" ? (
            <p className="mt-2 text-[0.75rem] text-muted-foreground">
              <Link
                href="/report"
                className="underline-offset-4 hover:underline"
              >
                Sparad i veckorapporten
              </Link>
            </p>
          ) : null}
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {recap.dimensions.map((dimension) => (
          <li
            key={dimension.key}
            className="rounded-[1rem] bg-white/55 px-3 py-2.5"
          >
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[0.75rem] font-medium text-muted-foreground">
                {dimension.label}
              </p>
              <p className="text-[0.82rem] font-semibold tabular-nums">
                {dimension.score}
              </p>
            </div>
            <p className="mt-0.5 text-[0.72rem] leading-4 text-muted-foreground">
              {dimension.detail}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function WeekRecapHistory({ recaps }: { recaps: WeekRecap[] }) {
  if (recaps.length === 0) {
    return (
      <p className="px-0.5 text-[0.84rem] text-muted-foreground">
        Inga veckosummeringar ännu. De loggas på måndagar.
      </p>
    );
  }

  const [latest, ...earlier] = recaps;
  const chronological = [...recaps].reverse();
  const meanScore =
    recaps.reduce((sum, recap) => sum + recap.score, 0) / recaps.length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="surface-tile px-3.5 py-3">
          <p className="text-[0.75rem] font-medium text-muted-foreground">
            Senaste betyg
          </p>
          <p className="mt-1 text-[1.15rem] font-semibold tabular-nums">
            {latest!.score}/10
          </p>
          <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
            {RECAP_MEDAL_META[latest!.medal].label}
          </p>
        </div>
        <div className="surface-tile px-3.5 py-3">
          <p className="text-[0.75rem] font-medium text-muted-foreground">
            Snitt
          </p>
          <p className="mt-1 text-[1.15rem] font-semibold tabular-nums">
            {meanScore.toLocaleString("sv-SE", {
              maximumFractionDigits: 1,
            })}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-muted-foreground">
            {recaps.length} veckor
          </p>
        </div>
        <div className="col-span-2 surface-tile px-3.5 py-3">
          <p className="text-[0.75rem] font-medium text-muted-foreground">
            Trend
          </p>
          <div className="mt-2 flex h-12 items-end gap-1.5">
            {chronological.map((recap) => (
              <div
                key={recap.weekStart}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                title={`${formatWeekSpan(recap.weekStart, recap.weekEnd)}: ${recap.score}/10`}
              >
                <div
                  className="w-full max-w-6 rounded-full bg-foreground/75"
                  style={{ height: `${Math.max(12, recap.score * 4)}px` }}
                />
                <span className="text-[0.65rem] tabular-nums text-muted-foreground">
                  {recap.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <WeekRecapCard recap={latest!} />

      {earlier.length > 0 ? (
        <ul className="space-y-2">
          {earlier.map((recap) => {
            const medal = RECAP_MEDAL_META[recap.medal];
            const Icon = medal.Icon;
            return (
              <li
                key={recap.weekStart}
                className="surface-tile flex items-center gap-3 px-3.5 py-3"
              >
                <Icon
                  className={`size-4 shrink-0 ${medal.iconClass}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[0.82rem] font-medium">
                    {formatWeekSpan(recap.weekStart, recap.weekEnd)}
                  </p>
                  <p className="truncate text-[0.75rem] text-muted-foreground">
                    {recap.headline} {recap.summary}
                  </p>
                </div>
                <p className="shrink-0 text-[0.95rem] font-semibold tabular-nums">
                  {recap.score}
                  <span className="text-[0.72rem] font-medium text-muted-foreground">
                    /10
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
