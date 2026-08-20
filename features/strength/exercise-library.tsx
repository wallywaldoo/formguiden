"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

export type MuscleGroup = "legs" | "chest" | "back" | "shoulders" | "core" | "arms";

export type ExerciseSuggestion = {
  id: string;
  name: string;
  muscle: MuscleGroup;
  sets: string;
  cue: string;
};

export const EXERCISE_LIBRARY: ExerciseSuggestion[] = [
  {
    id: "squat",
    name: "Knäböj",
    muscle: "legs",
    sets: "4 × 6",
    cue: "Bröst upp, knän i linje med tårna, djup du äger.",
  },
  {
    id: "rdl",
    name: "RDL",
    muscle: "legs",
    sets: "3 × 8",
    cue: "Skjut höften bak, stången nära benen, ryggen lång.",
  },
  {
    id: "lunge",
    name: "Utfall",
    muscle: "legs",
    sets: "3 × 8/ben",
    cue: "Stort kliv, framknät stabilt, bakknät mot golvet.",
  },
  {
    id: "bench",
    name: "Bänkpress",
    muscle: "chest",
    sets: "4 × 6",
    cue: "Skulderblad ihop, stången till nedre bröstet.",
  },
  {
    id: "pushup",
    name: "Armhävningar",
    muscle: "chest",
    sets: "3 × 12",
    cue: "Kroppen som en planka, armbågar ca 45°.",
  },
  {
    id: "row",
    name: "Skivstångsrodd",
    muscle: "back",
    sets: "4 × 8",
    cue: "Dra mot höften, bröstet öppet, ingen gungning.",
  },
  {
    id: "pullup",
    name: "Chins",
    muscle: "back",
    sets: "3 × max",
    cue: "Starta hängande, dra bröstet mot stången.",
  },
  {
    id: "ohp",
    name: "Militärpress",
    muscle: "shoulders",
    sets: "4 × 6",
    cue: "Spänn rumpan, pressa rakt upp, hakan undan.",
  },
  {
    id: "plank",
    name: "Plankan",
    muscle: "core",
    sets: "3 × 40 s",
    cue: "Revben in, rumpa lätt knuten, nacke lång.",
  },
  {
    id: "curl",
    name: "Bicepscurl",
    muscle: "arms",
    sets: "3 × 10",
    cue: "Armbågar stilla, sänk långsamt.",
  },
];

const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  legs: "Ben",
  chest: "Bröst",
  back: "Rygg",
  shoulders: "Axlar",
  core: "Bål",
  arms: "Armar",
};

function MuscleFigure({ active }: { active: MuscleGroup | "all" }) {
  const on = (group: MuscleGroup) =>
    active === "all" || active === group
      ? "fill-primary/55"
      : "fill-primary/12";

  return (
    <svg
      viewBox="0 0 120 220"
      className="mx-auto h-52 w-auto"
      aria-hidden
    >
      <circle cx="60" cy="18" r="12" className="fill-primary/20" />
      <rect x="52" y="30" width="16" height="10" rx="4" className="fill-primary/18" />
      <path
        d="M38 46h44l6 18H32z"
        className={on("shoulders")}
      />
      <path d="M42 62h36l4 34H38z" className={on("chest")} />
      <path d="M44 96h32l-4 28H48z" className={on("core")} />
      <path d="M28 52 14 92l12 6 16-40z" className={on("arms")} />
      <path d="M92 52l14 40-12 6-16-40z" className={on("arms")} />
      <path d="M46 124h12l6 70H44z" className={on("legs")} />
      <path d="M62 124h12l8 70H68z" className={on("legs")} />
      <path d="M40 70h40l-2 20H42z" className={on("back")} />
    </svg>
  );
}

export function ExerciseLibrary() {
  const [muscle, setMuscle] = useState<MuscleGroup | "all">("all");
  const [picked, setPicked] = useState<string | null>(null);
  const exercises =
    muscle === "all"
      ? EXERCISE_LIBRARY
      : EXERCISE_LIBRARY.filter((item) => item.muscle === muscle);
  const selected = EXERCISE_LIBRARY.find((item) => item.id === picked);

  return (
    <div className="grid gap-5 lg:grid-cols-[10rem_1fr]">
      <div className="surface-soft px-3 py-4">
        <MuscleFigure active={selected?.muscle ?? muscle} />
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {(["all", "legs", "chest", "back", "shoulders", "core", "arms"] as const).map(
            (group) => (
              <button
                key={group}
                type="button"
                onClick={() => {
                  setMuscle(group);
                  setPicked(null);
                }}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.68rem] font-medium",
                  muscle === group
                    ? "bg-primary/14 text-foreground"
                    : "bg-white/60 text-muted-foreground hover:bg-white/80",
                )}
              >
                {group === "all" ? "Alla" : MUSCLE_LABEL[group]}
              </button>
            ),
          )}
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {exercises.map((exercise) => (
          <button
            key={exercise.id}
            type="button"
            onClick={() => setPicked(exercise.id)}
            className={cn(
              "surface-tile px-3.5 py-3 text-left transition-colors hover:bg-white/70",
              picked === exercise.id && "ring-1 ring-primary/25 bg-primary/6",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{exercise.name}</p>
              <span className="text-[0.68rem] text-muted-foreground">
                {MUSCLE_LABEL[exercise.muscle]}
              </span>
            </div>
            <p className="mt-1 text-[0.78rem] tabular-nums text-muted-foreground">
              {exercise.sets}
            </p>
            <p className="mt-1 text-[0.75rem] text-muted-foreground">
              {exercise.cue}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
