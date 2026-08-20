"use client";

import Link from "next/link";
import { useActionState, type ComponentType, type ReactNode } from "react";
import { Dumbbell, Footprints, HeartPulse, RefreshCw } from "lucide-react";

import { CollapsiblePanel } from "@/components/dashboard/collapsible-panel";
import { Button } from "@/components/ui/button";
import { regenerateTrainingPlanAction } from "@/features/training-plan/actions";
import { TrainingPlanUpdateForm } from "@/features/dashboard/training-plan-update-form";
import {
  ctaForKind,
  hrefForKind,
  TRAINING_KIND_LABEL,
  type DailySession,
} from "@/lib/training-plan/schema";

function iconForKind(kind: DailySession["kind"]): ComponentType<{ className?: string }> {
  switch (kind) {
    case "strength":
      return Dumbbell;
    case "active_recovery":
    case "rest":
      return HeartPulse;
    default:
      return Footprints;
  }
}

export function OverviewTodayPlan({
  today,
  children,
}: {
  today: DailySession | null;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(
    regenerateTrainingPlanAction,
    {},
  );
  const meta = today
    ? [
        TRAINING_KIND_LABEL[today.kind],
        today.durationMin > 0 ? `${today.durationMin} min` : null,
        today.intensity,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const CtaIcon = today ? iconForKind(today.kind) : Footprints;

  return (
    <CollapsiblePanel
      storageKey="fk:collapse:today"
      title="Idag"
      bodyClassName="space-y-5 px-5 py-4"
    >
      {children}

      {today ? (
        <div className="surface-soft space-y-3 px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.75rem] font-medium text-muted-foreground">
                Rekommendation
              </p>
              <p className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em]">
                {today.title}
              </p>
              <p className="mt-0.5 text-[0.78rem] text-muted-foreground">{meta}</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto sm:shrink-0">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-9 min-h-9 rounded-full px-3 text-[0.78rem] shadow-none md:h-7 md:min-h-7 md:px-2.5 md:text-[0.75rem]"
              >
                <Link href={hrefForKind(today.kind)}>
                  <CtaIcon className="size-3.5" />
                  {ctaForKind(today.kind)}
                </Link>
              </Button>
              <form action={formAction}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={pending}
                  className="h-9 min-h-9 rounded-full px-3 text-[0.78rem] shadow-none active:translate-y-0 md:h-7 md:min-h-7 md:px-2.5 md:text-[0.75rem]"
                >
                  <RefreshCw
                    className={pending ? "size-3.5 animate-spin" : "size-3.5"}
                  />
                  {pending ? "Räknar om…" : "Räkna om"}
                </Button>
              </form>
              <TrainingPlanUpdateForm />
            </div>
          </div>
          <ol className="space-y-1.5 text-[0.84rem] leading-5">
            {today.steps.map((step, index) => (
              <li key={step} className="flex gap-2.5">
                <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-white/70 text-[0.65rem] tabular-nums text-muted-foreground">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          {state?.error ? (
            <p className="text-[0.8rem] text-destructive">{state.error}</p>
          ) : null}
        </div>
      ) : null}
    </CollapsiblePanel>
  );
}
