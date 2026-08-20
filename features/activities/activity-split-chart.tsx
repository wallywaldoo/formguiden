"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ActivitySplit } from "@/lib/analytics/activity-detail";
import { formatPaceMinPerKm } from "@/lib/units/pace";

export function ActivitySplitChart({ splits }: { splits: ActivitySplit[] }) {
  if (splits.length < 2) return null;
  const config = {
    pace: { label: "Tempo", color: "var(--chart-2)" },
  } satisfies ChartConfig;
  const data = splits.map((split) => ({
    km: split.label,
    pace: split.paceSPerKm,
  }));

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="km" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          width={42}
          reversed
          tickFormatter={(value: number) => formatPaceMinPerKm(value)}
        />
        <ChartTooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            const value = payload[0]?.value;
            return (
              <div className="grid min-w-[8rem] gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                <div className="font-medium">Km {String(label)}</div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Tempo</span>
                  <span className="font-mono font-medium tabular-nums">
                    {typeof value === "number"
                      ? `${formatPaceMinPerKm(value)} /km`
                      : "—"}
                  </span>
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="pace" fill="var(--color-pace)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
