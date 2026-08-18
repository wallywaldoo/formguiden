/**
 * GarminDB stores naive SQLite DATETIME values with no offset, while the
 * canonical model uses timestamptz. Wall-clock values are therefore
 * interpreted in the user's configured timezone. That is a documented
 * assumption recorded in import provenance, not a fact recovered from the file.
 */

const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?/;

const DURATION_PATTERN = /^(\d{1,3}):([0-5]\d):([0-5]\d)(?:\.\d+)?$/;

export type NaiveDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function parseNaiveDateTime(value: unknown): NaiveDateTime | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = DATE_TIME_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4] ?? "0"),
    minute: Number(match[5] ?? "0"),
    second: Number(match[6] ?? "0"),
  };
}

/** `YYYY-MM-DD` in the file's own local calendar, with no timezone shift. */
export function parseLocalDate(value: unknown): string | null {
  const parsed = parseNaiveDateTime(value);
  if (!parsed) {
    return null;
  }
  return `${pad(parsed.year, 4)}-${pad(parsed.month, 2)}-${pad(parsed.day, 2)}`;
}

/** `HH:MM:SS` to seconds. GarminDB stores durations as SQLite time text. */
export function parseDurationSeconds(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >= 0 ? Math.round(value) : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = DURATION_PATTERN.exec(value.trim());
  if (!match) {
    return null;
  }
  const seconds =
    Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return seconds;
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

/**
 * Offset between the given instant and how it reads on the wall clock in the
 * target zone, in milliseconds.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const lookup = (type: string): number => {
    const found = parts.find((part) => part.type === type)?.value ?? "0";
    return Number(found);
  };

  const hour = lookup("hour") % 24;
  const asUtc = Date.UTC(
    lookup("year"),
    lookup("month") - 1,
    lookup("day"),
    hour,
    lookup("minute"),
    lookup("second"),
  );
  return asUtc - instant.getTime();
}

/**
 * Interprets a naive wall-clock time as local to `timeZone` and returns the
 * UTC instant. Two passes so times near a DST transition resolve correctly.
 */
export function zonedNaiveToUtc(
  naive: NaiveDateTime,
  timeZone: string,
): Date | null {
  const wallMs = Date.UTC(
    naive.year,
    naive.month - 1,
    naive.day,
    naive.hour,
    naive.minute,
    naive.second,
  );
  if (!Number.isFinite(wallMs)) {
    return null;
  }
  let instant = new Date(wallMs - zoneOffsetMs(new Date(wallMs), timeZone));
  instant = new Date(wallMs - zoneOffsetMs(instant, timeZone));
  return Number.isNaN(instant.getTime()) ? null : instant;
}

export function zonedNaiveToUtcIso(
  value: unknown,
  timeZone: string,
): string | null {
  const naive = parseNaiveDateTime(value);
  if (!naive) {
    return null;
  }
  return zonedNaiveToUtc(naive, timeZone)?.toISOString() ?? null;
}

/**
 * A date-only value promoted to midday local time, so a timezone shift can
 * never move it onto the previous or next calendar day.
 */
export function localDateToMiddayUtcIso(
  localDate: string,
  timeZone: string,
): string | null {
  const naive = parseNaiveDateTime(localDate);
  if (!naive) {
    return null;
  }
  return (
    zonedNaiveToUtc(
      { ...naive, hour: 12, minute: 0, second: 0 },
      timeZone,
    )?.toISOString() ?? null
  );
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
