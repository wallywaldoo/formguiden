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
    <section className="glass-panel ambient-divider rounded-[1.4rem] border border-white/50">
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center md:p-5">
        <div className="min-w-0 space-y-1">
          <h2 className="text-[1.05rem] font-semibold">
            {status.headline}
          </h2>
          <p className="text-[0.88rem] text-muted-foreground">
            {lastLabel
              ? `Senaste pass ${ago ?? lastLabel}`
              : "Inget pass inne ännu."}
          </p>
        </div>
        <CatchUpDropzone variant="compact" />
      </div>
    </section>
  );
}
