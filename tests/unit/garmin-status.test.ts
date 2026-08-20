import { describe, expect, it } from "vitest";

import { readGarminSyncStatus } from "@/lib/garmin/status";

describe("readGarminSyncStatus", () => {
  it("returns idle defaults without metadata", () => {
    const status = readGarminSyncStatus(null);
    expect(status.lastSyncAt).toBeNull();
    expect(status.lastResult).toBeNull();
    expect(status.fullSync).toBeNull();
  });

  it("does not treat active integration alone as connected without a valid session", () => {
    const status = readGarminSyncStatus({
      status: "active",
      metadata: {
        lastSuccessAt: "2026-08-19T10:00:00.000Z",
        lastTrigger: "manual",
        lastResult: {
          days: 14,
          activitiesUpserted: 3,
          healthDaysUpserted: 2,
          weightEntriesUpserted: 1,
          errors: 0,
        },
      },
    });

    expect(status.connected).toBe(false);
    expect(status.lastSuccessAt).toBe("2026-08-19T10:00:00.000Z");
    expect(status.lastResult?.activitiesUpserted).toBe(3);
  });
});
