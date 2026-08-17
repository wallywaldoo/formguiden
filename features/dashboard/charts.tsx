"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export function DistanceChart({
  data,
}: {
  data: Array<{ date: string; distanceKm: number }>;
}) {
  const config = {
    distanceKm: { label: "km", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
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
