"use client";

import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

function formatHistoryAxis(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("sv-SE", {
    day: "numeric",
    month: "short",
  });
}

function stressFill(value: number): string {
  if (value < 25) return "oklch(0.72 0.12 145)";
  if (value < 50) return "oklch(0.78 0.12 85)";
  if (value < 75) return "oklch(0.7 0.14 55)";
  return "oklch(0.65 0.18 25)";
}

export function BodyBatteryChart({
  data,
}: {
  data: Array<{ date: string; high: number; low: number; range: number }>;
}) {
  const config = {
    high: { label: "Högst", color: "var(--chart-1)" },
    low: { label: "Lägst", color: "var(--chart-3)" },
    range: { label: "Spann", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <ComposedChart accessibilityLayer data={data}>
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
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          width={32}
          tickMargin={4}
        />
        <ChartTooltip
          labelFormatter={(value) => formatHistoryAxis(String(value))}
          content={<ChartTooltipContent />}
        />
        <Area
          type="monotone"
          dataKey="low"
          stackId="battery"
          stroke="none"
          fill="transparent"
          connectNulls
        />
        <Area
          type="monotone"
          dataKey="range"
          stackId="battery"
          stroke="none"
          fill="var(--color-range)"
          fillOpacity={0.28}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="high"
          stroke="var(--color-high)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="low"
          stroke="var(--color-low)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </ComposedChart>
    </ChartContainer>
  );
}

export function StressChart({
  data,
}: {
  data: Array<{ date: string; stress: number }>;
}) {
  const config = {
    stress: { label: "Stress", color: "var(--chart-4)" },
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
          minTickGap={22}
          interval="preserveStartEnd"
          tickFormatter={formatHistoryAxis}
        />
        <YAxis
          domain={[0, 100]}
          tickLine={false}
          axisLine={false}
          width={32}
          tickMargin={4}
        />
        <ChartTooltip
          labelFormatter={(value) => formatHistoryAxis(String(value))}
          content={<ChartTooltipContent />}
        />
        <Bar dataKey="stress" radius={4}>
          {data.map((entry) => (
            <Cell key={entry.date} fill={stressFill(entry.stress)} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function HrvTrendChart({
  data,
}: {
  data: Array<{ date: string; hrv: number }>;
}) {
  const config = {
    hrv: { label: "HRV (ms)", color: "var(--chart-2)" },
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
          minTickGap={22}
          interval="preserveStartEnd"
          tickFormatter={formatHistoryAxis}
        />
        <ChartTooltip
          labelFormatter={(value) => formatHistoryAxis(String(value))}
          content={<ChartTooltipContent />}
        />
        <Line
          type="monotone"
          dataKey="hrv"
          stroke="var(--color-hrv)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

export function StepsChart({
  data,
  goal,
}: {
  data: Array<{ date: string; steps: number }>;
  goal?: number | null;
}) {
  const config = {
    steps: { label: "Steg", color: "var(--chart-1)" },
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
          tickFormatter={formatHistoryAxis}
        />
        <ChartTooltip
          labelFormatter={(value) => formatHistoryAxis(String(value))}
          content={<ChartTooltipContent />}
        />
        {goal != null && goal > 0 ? (
          <ReferenceLine
            y={goal}
            stroke="oklch(0.55 0.08 252)"
            strokeDasharray="4 4"
            label={{
              value: `Mål ${goal.toLocaleString("sv-SE")}`,
              position: "insideTopRight",
              fill: "oklch(0.45 0.04 252)",
              fontSize: 11,
            }}
          />
        ) : null}
        <Bar dataKey="steps" fill="var(--color-steps)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}
