export type GarminRunningRecords = {
  time1K: number | null;
  timeMile: number | null;
  time5K: number | null;
  time10K: number | null;
  timeHalfMarathon: number | null;
  timeMarathon: number | null;
  longestRunM: number | null;
};

const TYPE_TO_FIELD: Record<number, keyof GarminRunningRecords> = {
  1: "time1K",
  2: "timeMile",
  3: "time5K",
  4: "time10K",
  5: "timeHalfMarathon",
  6: "timeMarathon",
  7: "longestRunM",
};

function asPositiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function emptyRecords(): GarminRunningRecords {
  return {
    time1K: null,
    timeMile: null,
    time5K: null,
    time10K: null,
    timeHalfMarathon: null,
    timeMarathon: null,
    longestRunM: null,
  };
}

export function hasRunningRecords(
  records: GarminRunningRecords | null | undefined,
): boolean {
  if (!records) return false;
  return Object.values(records).some(
    (value) => typeof value === "number" && value > 0,
  );
}

export function parseGarminPersonalRecords(
  payload: unknown,
): GarminRunningRecords | null {
  const rows = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === "object" &&
        Array.isArray(
          (payload as { personalRecords?: unknown }).personalRecords,
        )
      ? (payload as { personalRecords: unknown[] }).personalRecords
      : null;
  if (!rows) return null;

  const records = emptyRecords();
  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const item = row as Record<string, unknown>;
    const typeId = asPositiveNumber(item.typeId ?? item.type_id);
    if (typeId == null) continue;
    const field = TYPE_TO_FIELD[typeId];
    if (!field) continue;
    const value = asPositiveNumber(
      item.value ?? item.rawValue ?? item.raw_value,
    );
    if (value == null) continue;
    records[field] = value;
  }

  return hasRunningRecords(records) ? records : null;
}
