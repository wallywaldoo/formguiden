import { DEFAULT_TIMEZONE } from "@/lib/constants";

const DATE_FORMATTER = new Map<string, Intl.DateTimeFormat>();

function dateFormatter(timeZone: string): Intl.DateTimeFormat {
  const zone = timeZone || DEFAULT_TIMEZONE;
  const cached = DATE_FORMATTER.get(zone);
  if (cached) {
    return cached;
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  DATE_FORMATTER.set(zone, formatter);
  return formatter;
}

export function toLocalDate(iso: string, timeZone: string): string {
  return dateFormatter(timeZone).format(new Date(iso));
}

export function addDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayLocal(now: Date, timeZone: string): string {
  return toLocalDate(now.toISOString(), timeZone);
}

export function rollingWindow(
  today: string,
  days: number,
): { start: string; end: string } {
  return { start: addDays(today, -(days - 1)), end: today };
}

export function inInclusiveRange(
  localDate: string,
  start: string,
  end: string,
): boolean {
  return localDate >= start && localDate <= end;
}

/** ISO week starts Monday. `localDate` is YYYY-MM-DD in the user's calendar. */
export function isoWeekStart(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const weekday = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - weekday + 1);
  return date.toISOString().slice(0, 10);
}

export function lastIsoWeekStarts(today: string, count: number): string[] {
  const current = isoWeekStart(today);
  return Array.from({ length: count }, (_, index) =>
    addDays(current, -7 * index),
  );
}

const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second),
  );
  return asUtc - date.getTime();
}

export function isDatetimeLocal(value: string): boolean {
  return DATETIME_LOCAL.test(value);
}

export function toDatetimeLocal(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function fromDatetimeLocal(value: string, timeZone: string): string {
  if (!isDatetimeLocal(value)) {
    throw new Error("Ogiltig tid.");
  }
  const [datePart, timePart] = value.split("T") as [string, string];
  const [year, month, day] = datePart.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const [hour, minute] = timePart.split(":").map(Number) as [number, number];
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let date = new Date(utcGuess);
  const offset = getTimeZoneOffsetMs(date, timeZone);
  date = new Date(utcGuess - offset);
  const adjusted = getTimeZoneOffsetMs(date, timeZone);
  if (adjusted !== offset) {
    date = new Date(utcGuess - adjusted);
  }
  return date.toISOString();
}

export function minutesFromEveningOrigin(
  iso: string,
  timeZone: string,
): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );
  const minutes = hour * 60 + minute;
  return (minutes - 18 * 60 + 24 * 60) % (24 * 60);
}
