"use client";

import { useActionState, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TrainingPlanUpdateForm } from "@/features/dashboard/training-plan-update-form";
import { regenerateTrainingPlanAction } from "@/features/training-plan/actions";
import {
  TRAINING_KIND_LABEL,
  type WeekPlan,
} from "@/lib/training-plan/schema";
import { cn } from "@/lib/utils";

const TRAINING_KIND_SHORT: Record<keyof typeof TRAINING_KIND_LABEL, string> = {
  easy_run: "Lätt",
  quality_run: "Kval",
  long_run: "Lång",
  strength: "Styrka",
  active_recovery: "Vila+",
  rest: "Vila",
};

const WEEKDAY_SHORT = ["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"];
const WEEKDAY_LONG = [
  "Måndag",
  "Tisdag",
  "Onsdag",
  "Torsdag",
  "Fredag",
  "Lördag",
  "Söndag",
];

function formatDayDate(localDate: string): string {
  return new Date(`${localDate}T12:00:00`).toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  });
}

export function WeekSchedule({
  week,
  todayDate,
}: {
  week: WeekPlan;
  todayDate: string;
}) {
  const initial =
    week.days.find((day) => day.localDate === todayDate)?.localDate ??
    week.days[0]?.localDate ??
    todayDate;
  const [selectedDate, setSelectedDate] = useState(initial);
  const [state, formAction, pending] = useActionState(
    regenerateTrainingPlanAction,
    {},
  );
  const selected =
    week.days.find((day) => day.localDate === selectedDate) ?? week.days[0];
  if (!selected) return null;

  const selectedIndex = week.days.findIndex(
    (day) => day.localDate === selected.localDate,
  );
  const meta = [
    TRAINING_KIND_LABEL[selected.kind],
    selected.durationMin > 0 ? `${selected.durationMin} min` : null,
    selected.intensity,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.82rem] font-medium text-muted-foreground">
          Schema
        </p>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
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
          <TrainingPlanUpdateForm
            title="Uppdatera veckan"
            placeholder="Resa på torsdag, benen är tunga…"
          />
        </div>
      </div>
      {state?.error ? (
        <p className="text-[0.8rem] text-destructive">{state.error}</p>
      ) : null}
      <div className="grid grid-cols-7 gap-1">
        {week.days.map((day, index) => {
          const isToday = day.localDate === todayDate;
          const isSelected = day.localDate === selected.localDate;
          return (
            <button
              key={day.localDate}
              type="button"
              onClick={() => setSelectedDate(day.localDate)}
              aria-pressed={isSelected}
              aria-label={`${WEEKDAY_LONG[index]}: ${TRAINING_KIND_LABEL[day.kind]}`}
              className={cn(
                "surface-tile min-h-12 px-0.5 py-2 text-center transition-colors hover:bg-white/65",
                isToday && "ring-1 ring-primary/20",
                isSelected && "bg-white/72 ring-1 ring-foreground/12",
              )}
            >
              <p className="text-[0.62rem] text-muted-foreground">
                {WEEKDAY_SHORT[index]}
              </p>
              <p className="mt-0.5 text-[0.62rem] font-medium leading-tight">
                {TRAINING_KIND_SHORT[day.kind]}
              </p>
            </button>
          );
        })}
      </div>

      <div className="surface-soft space-y-3 px-4 py-3.5">
        <div>
          <p className="text-[0.75rem] font-medium text-muted-foreground">
            {WEEKDAY_LONG[selectedIndex] ?? "Pass"} {formatDayDate(selected.localDate)}
          </p>
          <p className="mt-1 text-[1.05rem] font-semibold tracking-[-0.02em]">
            {selected.title}
          </p>
          <p className="mt-0.5 text-[0.78rem] text-muted-foreground">{meta}</p>
        </div>
        <ol className="space-y-1.5 text-[0.84rem] leading-5">
          {selected.steps.map((step, index) => (
            <li key={step} className="flex gap-2.5">
              <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-white/70 text-[0.65rem] tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
        {selected.why.length > 0 ? (
          <p className="text-[0.75rem] leading-5 text-muted-foreground">
            {selected.why.join(" ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
