import { toIso } from "@/lib/import/normalize";

const MAX_OFFSET_S = 48 * 60 * 60;

export function parseGarminInstant(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return toIso(value);
  if (typeof value === "number") return toIso(value);
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return toIso(Number(trimmed));
  }
  const withZone = /Z|[+-]\d{2}:\d{2}$/.test(trimmed)
    ? trimmed
    : `${trimmed.replace(" ", "T")}Z`;
  return toIso(withZone);
}

export function recordedAtFromGarminPoint(input: {
  startedAt?: string | null;
  offsetS?: number | null;
  time?: number | null;
}): string | null {
  const startIso = parseGarminInstant(input.startedAt);
  const startMs = startIso ? Date.parse(startIso) : Number.NaN;
  const offsetS = input.offsetS;
  const time = input.time;

  if (
    offsetS != null &&
    offsetS >= 0 &&
    offsetS <= MAX_OFFSET_S &&
    Number.isFinite(startMs)
  ) {
    return toIso(startMs + offsetS * 1000);
  }

  if (time != null && Number.isFinite(time)) {
    if (time > 1e12) return toIso(time);
    if (time > 1e9) return toIso(time * 1000);
    if (time >= 0 && time <= MAX_OFFSET_S && Number.isFinite(startMs)) {
      return toIso(startMs + time * 1000);
    }
  }

  return startIso;
}
