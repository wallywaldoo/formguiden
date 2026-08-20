"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { downsample } from "@/lib/garmin/geo";
import { formatPaceMinPerKm } from "@/lib/units/pace";

type SamplePoint = {
  recordedAt: string;
  elapsedS: number | null;
  heartRateBpm: number | null;
  speedMps: number | null;
  altitudeM: number | null;
  cadence: number | null;
  powerW?: number | null;
  temperatureC?: number | null;
};

function paceSeconds(speedMps: number | null): number | null {
  if (!speedMps || speedMps <= 0) return null;
  const pace = 1000 / speedMps;
  return pace > 20 && pace < 900 ? pace : null;
}

function formatElapsed(elapsedS: number | null): string {
  if (elapsedS == null) return "";
  const minutes = Math.floor(elapsedS / 60);
  const seconds = elapsedS % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function ActivityStreamCharts({ samples }: { samples: SamplePoint[] }) {
  if (samples.length < 2) {
    return null;
  }

  const data = downsample(samples, 360).map((sample) => ({
    elapsedLabel: formatElapsed(sample.elapsedS),
    heartRate: sample.heartRateBpm,
    pace: paceSeconds(sample.speedMps),
    altitude: sample.altitudeM,
    cadence: sample.cadence,
    power: sample.powerW ?? null,
    temperature: sample.temperatureC ?? null,
  }));

  const hasPower = data.some((row) => row.power != null);
  const hasTemp = data.some((row) => row.temperature != null);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard
        title="Puls"
        description="Hjärtfrekvens över passet."
        dataKey="heartRate"
        color="var(--color-chart-1)"
        formatter={(value) => (value != null ? `${Math.round(value)} bpm` : "—")}
        data={data}
      />
      <ChartCard
        title="Tempo"
        description="Minuter per kilometer över tid."
        dataKey="pace"
        color="var(--color-chart-2)"
        reversed
        formatter={(value) =>
          value != null ? `${formatPaceMinPerKm(value)} /km` : "—"
        }
        data={data}
      />
      <ChartCard
        title="Höjd"
        description="Höjdprofil över tid."
        dataKey="altitude"
        color="var(--color-chart-3)"
        formatter={(value) => (value != null ? `${Math.round(value)} m` : "—")}
        data={data}
      />
      <ChartCard
        title="Kadens"
        description="Steg per minut."
        dataKey="cadence"
        color="var(--color-chart-5)"
        formatter={(value) => (value != null ? `${Math.round(value)} spm` : "—")}
        data={data}
      />
      {hasPower ? (
        <ChartCard
          title="Effekt"
          description="Watt över passet."
          dataKey="power"
          color="var(--color-chart-4)"
          formatter={(value) => (value != null ? `${Math.round(value)} W` : "—")}
          data={data}
        />
      ) : null}
      {hasTemp ? (
        <ChartCard
          title="Temperatur"
          description="Kropps- eller omgivningstemperatur i streamen."
          dataKey="temperature"
          color="var(--color-chart-1)"
          formatter={(value) =>
            value != null ? `${value.toFixed(1)} °C` : "—"
          }
          data={data}
        />
      ) : null}
    </div>
  );
}

function ChartCard({
  title,
  description,
  dataKey,
  color,
  reversed,
  formatter,
  data,
}: {
  title: string;
  description: string;
  dataKey: "heartRate" | "pace" | "altitude" | "cadence" | "power" | "temperature";
  color: string;
  reversed?: boolean;
  formatter?: (value: number | null) => string;
  data: Array<{
    elapsedLabel: string;
    heartRate: number | null;
    pace: number | null;
    altitude: number | null;
    cadence: number | null;
    power: number | null;
    temperature: number | null;
  }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="elapsedLabel" minTickGap={28} />
            <YAxis
              width={42}
              reversed={reversed}
              tickFormatter={(value: number) =>
                dataKey === "pace" ? formatPaceMinPerKm(value) : String(Math.round(value))
              }
            />
            <Tooltip
              formatter={(value) =>
                formatter
                  ? formatter(typeof value === "number" ? value : null)
                  : typeof value === "number"
                    ? value.toLocaleString("sv-SE")
                    : "—"
              }
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
