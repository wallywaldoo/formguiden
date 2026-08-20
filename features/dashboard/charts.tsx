"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { cn } from "@/lib/utils";

function formatHistoryAxis(value: string): string {
  if (/^\d{4}-\d{2}$/.test(value)) {
    const date = new Date(`${value}-01T12:00:00`);
    return date.toLocaleDateString("sv-SE", { month: "short", year: "numeric" });
  }
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

export function DistanceChart({
  data,
  className,
}: {
  data: Array<{ date: string; distanceKm: number }>;
  className?: string;
}) {
  const config = {
    distanceKm: { label: "km", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className={cn("aspect-auto h-56 w-full", className)}>
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={22}
          interval="preserveStartEnd"
          tickFormatter={formatHistoryAxis}
        />
        <ChartTooltip
          labelFormatter={(value) => formatHistoryAxis(String(value))}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="distanceKm" fill="var(--color-distanceKm)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export function LineMetricChart({
  data,
  dataKey,
  label,
}: {
  data: Array<Record<string, string | number | null>>;
  dataKey: string;
  label: string;
}) {
  const config: ChartConfig = {
    [dataKey]: { label, color: "var(--chart-2)" },
  };

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <LineChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={`var(--color-${dataKey})`}
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}
