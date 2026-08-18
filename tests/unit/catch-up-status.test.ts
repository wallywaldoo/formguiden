import { describe, expect, it } from "vitest";

import {
  computeCatchUpStatus,
  formatHoursAgo,
} from "@/lib/sync/catch-up-status";

const now = new Date("2026-08-18T12:00:00.000Z");

describe("computeCatchUpStatus", () => {
  it("welcomes an empty watch", () => {
    const status = computeCatchUpStatus({ lastActivityAt: null, now });
    expect(status.tone).toBe("empty");
    expect(status.headline).toMatch(/Släpp filen/);
  });

  it("treats a run from this morning as fresh", () => {
    const status = computeCatchUpStatus({
      lastActivityAt: "2026-08-18T06:00:00.000Z",
      now,
    });
    expect(status.tone).toBe("fresh");
  });

  it("asks for catch-up after two quiet days", () => {
    const status = computeCatchUpStatus({
      lastActivityAt: "2026-08-16T08:00:00.000Z",
      now,
    });
    expect(status.tone).toBe("due");
  });

  it("marks a long gap as stale", () => {
    const status = computeCatchUpStatus({
      lastActivityAt: "2026-08-01T08:00:00.000Z",
      now,
    });
    expect(status.tone).toBe("stale");
  });
});

describe("formatHoursAgo", () => {
  it("uses Swedish phrasing", () => {
    expect(formatHoursAgo(0.2)).toBe("nyss");
    expect(formatHoursAgo(1)).toBe("för 1 timme sedan");
    expect(formatHoursAgo(5)).toBe("för 5 timmar sedan");
    expect(formatHoursAgo(26)).toBe("för 1 dag sedan");
    expect(formatHoursAgo(80)).toBe("för 3 dagar sedan");
  });
});
