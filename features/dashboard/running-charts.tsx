"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatPaceMinPerKm } from "@/lib/units/pace";

function formatAxisDate(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  });
}

function PaceTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  const pace =
    typeof value === "number" ? `${formatPaceMinPerKm(value)} /km` : "—";
  return (
    <div className="grid min-w-[8rem] gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatAxisDate(String(label ?? ""))}</div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Tempo</span>
        <span className="font-mono font-medium tabular-nums">{pace}</span>
      </div>
    </div>
  );
}

function HeartRateTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ value?: unknown }>;
  label?: unknown;
}) {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value;
  const hr =
    typeof value === "number" ? `${Math.round(value)} bpm` : "—";
  return (
    <div className="grid min-w-[8rem] gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="font-medium">{formatAxisDate(String(label ?? ""))}</div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">Puls</span>
        <span className="font-mono font-medium tabular-nums">{hr}</span>
      </div>
    </div>
  );
}

export function PaceTrendChart({
  data,
}: {
  data: Array<{ date: string; pace: number }>;
}) {
  const config = {
    pace: { label: "Tempo", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          interval="preserveStartEnd"
          tickFormatter={formatAxisDate}
        />
        <YAxis
          width={44}
          reversed
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          tickFormatter={(value: number) => formatPaceMinPerKm(value)}
        />
        <ChartTooltip content={<PaceTooltip />} />
        <Line
          type="monotone"
          dataKey="pace"
          stroke="var(--color-pace)"
          strokeWidth={2}
          dot={{ r: 2.5, fill: "var(--color-pace)", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}

export function HeartRateTrendChart({
  data,
}: {
  data: Array<{ date: string; heartRate: number }>;
}) {
  const config = {
    heartRate: { label: "Puls", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          interval="preserveStartEnd"
          tickFormatter={formatAxisDate}
        />
        <YAxis
          width={36}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
          tickFormatter={(value: number) => String(Math.round(value))}
        />
        <ChartTooltip content={<HeartRateTooltip />} />
        <Line
          type="monotone"
          dataKey="heartRate"
          stroke="var(--color-heartRate)"
          strokeWidth={2}
          dot={{ r: 2.5, fill: "var(--color-heartRate)", strokeWidth: 0 }}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
