"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
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

function formatDayAxis(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

function formatWeekAxis(value: string): string {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

export function SessionsPerWeekChart({
  data,
  goal,
}: {
  data: Array<{ weekStart: string; count: number }>;
  goal: number | null;
}) {
  const config = {
    count: { label: "Pass", color: "var(--chart-1)" },
  } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-56 w-full">
      <BarChart accessibilityLayer data={data}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="weekStart"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={18}
          interval="preserveStartEnd"
          tickFormatter={formatWeekAxis}
        />
        <YAxis
          allowDecimals={false}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <ChartTooltip
          labelFormatter={(value) => `Vecka ${formatWeekAxis(String(value))}`}
          content={<ChartTooltipContent />}
        />
        {goal != null && goal > 0 ? (
          <ReferenceLine
            y={goal}
            stroke="var(--muted-foreground)"
            strokeDasharray="4 4"
            strokeOpacity={0.7}
            label={{
              value: `Mål ${goal}`,
              position: "insideTopRight",
              fill: "var(--muted-foreground)",
              fontSize: 11,
            }}
          />
        ) : null}
        <Bar dataKey="count" fill="var(--color-count)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

export function SessionVolumeTrendChart({
  data,
}: {
  data: Array<{ date: string; volumeKg: number }>;
}) {
  const config = {
    volumeKg: { label: "Volym (kg)", color: "var(--chart-2)" },
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
          minTickGap={18}
          interval="preserveStartEnd"
          tickFormatter={formatDayAxis}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={(value) => String(Math.round(Number(value)))}
        />
        <ChartTooltip
          labelFormatter={(value) => formatDayAxis(String(value))}
          content={<ChartTooltipContent />}
        />
        <Line
          type="monotone"
          dataKey="volumeKg"
          stroke="var(--color-volumeKg)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}

export function SessionDurationTrendChart({
  data,
}: {
  data: Array<{ date: string; minutes: number }>;
}) {
  const config = {
    minutes: { label: "Minuter", color: "var(--chart-3)" },
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
          minTickGap={18}
          interval="preserveStartEnd"
          tickFormatter={formatDayAxis}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={36}
          tickFormatter={(value) => String(Math.round(Number(value)))}
        />
        <ChartTooltip
          labelFormatter={(value) => formatDayAxis(String(value))}
          content={<ChartTooltipContent />}
        />
        <Line
          type="monotone"
          dataKey="minutes"
          stroke="var(--color-minutes)"
          strokeWidth={2}
          dot={{ r: 3 }}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}
