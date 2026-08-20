import Link from "next/link";

import type { ActivityRecap, PlanFit } from "@/lib/analytics/activity-recap";
import { cn } from "@/lib/utils";

const PLAN_FIT_CLASS: Record<PlanFit, string> = {
  followed: "bg-emerald-50/80 text-emerald-900",
  partly: "bg-amber-50/80 text-amber-950",
  missed: "bg-orange-50/80 text-orange-950",
  unplanned: "bg-white/70 text-muted-foreground",
};

export function ActivityRecapCard({
  recap,
  href,
}: {
  recap: ActivityRecap;
  href?: string;
}) {
  return (
    <div
      className="surface-soft space-y-3 px-4 py-3.5"
      aria-label={`Coachens omdöme, betyg ${recap.score} av 10`}
    >
      <div className="flex items-start gap-3.5">
        <div className="flex w-16 shrink-0 flex-col items-center gap-0.5">
          <div className="flex size-12 items-center justify-center rounded-full bg-white/70">
            <p className="text-[1.15rem] font-semibold tabular-nums leading-none">
              {recap.score}
              <span className="text-[0.72rem] font-medium text-muted-foreground">
                /10
              </span>
            </p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[0.75rem] font-medium text-muted-foreground">
            Coachens omdöme
          </p>
          <p className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em]">
            {recap.headline}
          </p>
          <p
            className={cn(
              "mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[0.72rem] font-medium",
              PLAN_FIT_CLASS[recap.planFit],
            )}
          >
            {recap.planFitLabel}
          </p>
          <p className="mt-2 text-[0.84rem] leading-5 text-muted-foreground">
            {recap.coachTake}
          </p>
          {href ? (
            <p className="mt-2 text-[0.75rem] text-muted-foreground">
              <Link href={href} className="underline-offset-4 hover:underline">
                Öppna passet
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
