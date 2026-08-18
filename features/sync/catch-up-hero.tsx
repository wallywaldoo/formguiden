import { CatchUpDropzone } from "@/features/sync/catch-up-dropzone";
import {
  computeCatchUpStatus,
  formatHoursAgo,
} from "@/lib/sync/catch-up-status";

export function CatchUpHero({
  lastActivityAt,
  now,
  timeZone,
}: {
  lastActivityAt: string | null;
  now: Date;
  timeZone: string;
}) {
  const status = computeCatchUpStatus({ lastActivityAt, now });
  const ago = formatHoursAgo(status.hoursSinceLastActivity);
  const lastLabel = status.lastActivityAt
    ? new Date(status.lastActivityAt).toLocaleString("sv-SE", { timeZone })
    : null;

  return (
    <section className="overflow-hidden rounded-3xl border bg-card">
      <div className="grid gap-8 p-6 md:grid-cols-[1.1fr_0.9fr] md:p-8">
        <div className="space-y-4">
          <p className="text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Efter passet
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-balance md:text-4xl">
            {status.headline}
          </h2>
          <p className="max-w-lg text-muted-foreground text-pretty">
            {status.body}
          </p>
          <p className="text-sm text-muted-foreground">
            {lastLabel
              ? `Senaste passet ${ago ?? lastLabel} · ${lastLabel}`
              : "Inget pass inne ännu."}
          </p>
        </div>
        <CatchUpDropzone variant="compact" />
      </div>
    </section>
  );
}
