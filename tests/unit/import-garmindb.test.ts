import { describe, expect, it } from "vitest";

import { GarminDbRejectionError } from "@/lib/import/garmindb/errors";
import { parseGarminDbUpload } from "@/lib/import/garmindb";
import { openGarminDb } from "@/lib/import/garmindb/open";
import { inspectAndParse } from "@/lib/import/parse-bytes";
import { detectFileKind } from "@/lib/import/detect";

import {
  buildActivitiesDb,
  buildForeignSqlite,
  buildGarminDb,
} from "../import-fixtures/garmindb";
import {
  garminConnectConfigBytes,
  readFixture,
  zipFromEntries,
} from "../import-fixtures/helpers";

const CONTEXT = { timeZone: "Europe/Stockholm" };

async function expectRejection(
  run: () => Promise<unknown>,
  code: string,
): Promise<GarminDbRejectionError> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(GarminDbRejectionError);
    const typed = error as GarminDbRejectionError;
    expect(typed.code).toBe(code);
    return typed;
  }
  throw new Error(`expected rejection with code ${code}`);
}

describe("GarminDB import", () => {
  describe("file identification", () => {
    it("detects a SQLite file by magic bytes", async () => {
      expect(detectFileKind(await buildGarminDb())).toBe("sqlite");
    });

    it("rejects a SQLite file that is not GarminDB", async () => {
      await expectRejection(
        async () => parseGarminDbUpload(await buildForeignSqlite(), CONTEXT),
        "not_garmindb",
      );
    });

    it("rejects garmin_activities.db by name and shape", async () => {
      const error = await expectRejection(
        async () => parseGarminDbUpload(await buildActivitiesDb(), CONTEXT),
        "unsupported_database",
      );
      expect(error.message).toContain("FIT");
    });

    it("rejects a non-SQLite payload", async () => {
      await expectRejection(
        () => parseGarminDbUpload(readFixture("activity.gpx"), CONTEXT),
        "not_sqlite",
      );
    });
  });

  describe("schema version pinning", () => {
    it("accepts the supported version", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({ dbVersion: 14, weight: [] }),
        CONTEXT,
      );
      expect(outcome.provenance.schemaVersion).toBe(14);
    });

    it("refuses a newer schema instead of guessing", async () => {
      const error = await expectRejection(
        async () =>
          parseGarminDbUpload(await buildGarminDb({ dbVersion: 15 }), CONTEXT),
        "unsupported_schema_version",
      );
      expect(error.message).toContain("15");
    });

    it("refuses an older schema", async () => {
      await expectRejection(
        async () =>
          parseGarminDbUpload(await buildGarminDb({ dbVersion: 9 }), CONTEXT),
        "unsupported_schema_version",
      );
    });
  });

  describe("hostile database content", () => {
    it("rejects a database containing triggers", async () => {
      const bytes = await buildGarminDb({
        extraSql:
          "CREATE TRIGGER evil AFTER INSERT ON weight BEGIN DELETE FROM sleep; END;",
      });
      await expectRejection(
        () => parseGarminDbUpload(bytes, CONTEXT),
        "schema_object_rejected",
      );
    });

    it("never reads columns outside the allowlist", async () => {
      const bytes = await buildGarminDb({
        dailySummary: [{ day: "2026-08-01", steps: 9000, rhr: 48 }],
      });
      const reader = await openGarminDb(bytes);
      try {
        const rows = reader.readTable("daily_summary");
        // distance, floors, steps_goal, hr_min, and hr_max exist in the file.
        expect(Object.keys(rows[0]).sort()).toEqual([
          "bb_max",
          "bb_min",
          "day",
          "rhr",
          "rr_waking_avg",
          "steps",
          "stress_avg",
        ]);
      } finally {
        reader.close();
      }
    });
  });

  describe("measurement system", () => {
    it("reads the Python enum-prefixed value GarminDB writes", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({
          measurementSystem: "DisplayMeasure.metric",
          weight: [{ day: "2026-08-01", weight: 72.5 }],
        }),
        CONTEXT,
      );
      expect(outcome.provenance.measurementSystem).toBe("metric");
      expect(outcome.result.bodyMeasurements[0].massKg).toBe(72.5);
    });

    it("converts pounds to kilograms under the statute system", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({
          measurementSystem: "DisplayMeasure.statute",
          weight: [{ day: "2026-08-01", weight: 160 }],
        }),
        CONTEXT,
      );
      expect(outcome.provenance.measurementSystem).toBe("statute");
      expect(outcome.result.bodyMeasurements[0].massKg).toBeCloseTo(72.57, 2);
      expect(
        outcome.result.warnings.some(
          (warning) => warning.code === "garmindb_units_converted",
        ),
      ).toBe(true);
    });

    it("refuses to guess when the measurement system is missing", async () => {
      await expectRejection(
        async () =>
          parseGarminDbUpload(
            await buildGarminDb({
              measurementSystem: null,
              weight: [{ day: "2026-08-01", weight: 160 }],
            }),
            CONTEXT,
          ),
        "measurement_system_unknown",
      );
    });

    it("refuses an unrecognised measurement system", async () => {
      await expectRejection(
        async () =>
          parseGarminDbUpload(
            await buildGarminDb({
              measurementSystem: "DisplayMeasure.nautical",
            }),
            CONTEXT,
          ),
        "measurement_system_unknown",
      );
    });
  });

  describe("canonical mapping", () => {
    it("merges sleep, resting HR, HRV, and daily summary onto one day", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({
          sleep: [
            {
              day: "2026-08-01",
              start: "2026-07-31 23:12:00",
              end: "2026-08-01 07:02:00",
              total_sleep: "07:20:00",
              deep_sleep: "01:35:00",
              light_sleep: "04:20:00",
              rem_sleep: "01:25:00",
              awake: "00:30:00",
              avg_rr: 13.4,
              avg_stress: 22,
            },
          ],
          restingHr: [{ day: "2026-08-01", resting_heart_rate: 46 }],
          hrv: [{ day: "2026-08-01", last_night_avg: 68 }],
          dailySummary: [
            {
              day: "2026-08-01",
              rhr: 49,
              stress_avg: 31,
              steps: 12400,
              bb_max: 92,
              bb_min: 24,
            },
          ],
        }),
        CONTEXT,
      );

      expect(outcome.result.dailyHealth).toHaveLength(1);
      const day = outcome.result.dailyHealth[0];
      expect(day.localDate).toBe("2026-08-01");
      expect(day.externalId).toBe("garmindb:day:2026-08-01");
      expect(day.sleepDurationS).toBe(26_400);
      expect(day.sleepDeepS).toBe(5_700);
      // A dedicated resting_hr row beats the daily rollup.
      expect(day.restingHeartRateBpm).toBe(46);
      // The daily rollup beats the sleep-window stress average.
      expect(day.stressAvg).toBe(31);
      expect(day.hrvRmssdMs).toBe(68);
      expect(day.steps).toBe(12_400);
      expect(day.respirationAvgBrpm).toBe(13.4);
    });

    it("converts naive sleep timestamps using the user's timezone", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({
          sleep: [
            {
              day: "2026-08-01",
              start: "2026-07-31 23:12:00",
              end: "2026-08-01 07:02:00",
              total_sleep: "07:20:00",
            },
          ],
        }),
        CONTEXT,
      );
      // Stockholm is UTC+2 in August.
      expect(outcome.result.dailyHealth[0].sleepStartAt).toBe(
        "2026-07-31T21:12:00.000Z",
      );
      expect(outcome.result.dailyHealth[0].sleepEndAt).toBe(
        "2026-08-01T05:02:00.000Z",
      );
    });

    it("records the timezone assumption as a warning", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({
          sleep: [{ day: "2026-08-01", total_sleep: "07:00:00" }],
        }),
        CONTEXT,
      );
      expect(
        outcome.result.warnings.some(
          (warning) => warning.code === "garmindb_timezone_assumed",
        ),
      ).toBe(true);
    });

    it("anchors weight at local midday so it cannot shift a day", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({
          weight: [{ day: "2026-01-15", weight: 70 }],
        }),
        CONTEXT,
      );
      // Stockholm is UTC+1 in January, so midday local is 11:00Z.
      expect(outcome.result.bodyMeasurements[0].measuredAt).toBe(
        "2026-01-15T11:00:00.000Z",
      );
    });

    it("drops days with no usable measurement", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({
          sleep: [{ day: "2026-08-01" }],
          dailySummary: [{ day: "2026-08-02" }],
        }),
        CONTEXT,
      );
      expect(outcome.result.dailyHealth).toEqual([]);
    });

    it("discards sentinel and impossible values", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({
          restingHr: [{ day: "2026-08-01", resting_heart_rate: 0 }],
          dailySummary: [{ day: "2026-08-01", steps: 5000, bb_max: 0 }],
          weight: [{ day: "2026-08-01", weight: 0 }],
        }),
        CONTEXT,
      );
      const day = outcome.result.dailyHealth[0];
      expect(day.restingHeartRateBpm).toBeNull();
      expect(day.bodyBatteryHigh).toBeNull();
      expect(day.steps).toBe(5000);
      expect(outcome.result.bodyMeasurements).toEqual([]);
    });

    it("never emits activities from a GarminDB import", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({
          sleep: [{ day: "2026-08-01", total_sleep: "07:00:00" }],
        }),
        CONTEXT,
      );
      expect(outcome.result.activities).toEqual([]);
    });
  });

  describe("partial databases", () => {
    it("imports what is present when optional tables are missing", async () => {
      const outcome = await parseGarminDbUpload(
        await buildGarminDb({
          omitTables: ["hrv", "daily_summary", "resting_hr"],
          sleep: [{ day: "2026-08-01", total_sleep: "07:00:00" }],
          weight: [{ day: "2026-08-01", weight: 71 }],
        }),
        CONTEXT,
      );
      expect(outcome.result.dailyHealth).toHaveLength(1);
      expect(outcome.result.bodyMeasurements).toHaveLength(1);
      expect(outcome.provenance.presentTables).toEqual(["sleep", "weight"]);
    });

    it("rejects a GarminDB database with no usable tables", async () => {
      await expectRejection(
        async () =>
          parseGarminDbUpload(
            await buildGarminDb({
              omitTables: [
                "sleep",
                "weight",
                "hrv",
                "daily_summary",
                "resting_hr",
              ],
            }),
            CONTEXT,
          ),
        "missing_required_table",
      );
    });
  });

  describe("archive handling", () => {
    it("accepts a flat ZIP containing one garmin.db", async () => {
      const archive = zipFromEntries({
        "garmin.db": await buildGarminDb({
          weight: [{ day: "2026-08-01", weight: 71 }],
        }),
      });
      const outcome = await parseGarminDbUpload(archive, CONTEXT);
      expect(outcome.provenance.entryPath).toBe("garmin.db");
      expect(outcome.result.bodyMeasurements).toHaveLength(1);
    });

    it("rejects an archive that also carries GarminConnectConfig.json", async () => {
      const archive = zipFromEntries({
        "garmin.db": await buildGarminDb({
          weight: [{ day: "2026-08-01", weight: 71 }],
        }),
        "GarminConnectConfig.json": garminConnectConfigBytes(),
      });
      // The valid database alongside it must not rescue the upload.
      await expect(parseGarminDbUpload(archive, CONTEXT)).rejects.toMatchObject(
        { code: "credential_material_detected" },
      );
    });

    it("rejects a whole HealthData home directory", async () => {
      const archive = zipFromEntries({
        "HealthData/DBs/garmin.db": await buildGarminDb(),
        "HealthData/DBs/garmin_summary.db": await buildForeignSqlite(),
        "HealthData/FitFiles/Monitoring/x.fit": new Uint8Array([1, 2, 3]),
      });
      const error = await expectRejection(
        () => parseGarminDbUpload(archive, CONTEXT),
        "archive_shape_rejected",
      );
      expect(error.message).toContain("HealthData");
    });

    it("rejects an archive holding more than one database", async () => {
      const archive = zipFromEntries({
        "a.db": await buildGarminDb(),
        "b.db": await buildForeignSqlite(),
      });
      await expectRejection(
        () => parseGarminDbUpload(archive, CONTEXT),
        "archive_shape_rejected",
      );
    });

    it("rejects an archive with no database at all", async () => {
      const archive = zipFromEntries({
        "activity.gpx": readFixture("activity.gpx"),
      });
      await expectRejection(
        () => parseGarminDbUpload(archive, CONTEXT),
        "archive_shape_rejected",
      );
    });
  });

  describe("pipeline routing", () => {
    it("routes a bare garmin.db to the garmindb source", async () => {
      const inspected = await inspectAndParse(
        await buildGarminDb({
          sleep: [{ day: "2026-08-01", total_sleep: "07:00:00" }],
        }),
        CONTEXT,
      );
      expect(inspected.kind).toBe("sqlite");
      expect(inspected.source).toBe("garmindb");
      expect(inspected.parse.dailyHealth).toHaveLength(1);
    });

    it("surfaces a rejection as a failed parse rather than throwing", async () => {
      const inspected = await inspectAndParse(
        await buildGarminDb({ dbVersion: 99 }),
        CONTEXT,
      );
      expect(inspected.parse.dailyHealth).toEqual([]);
      expect(inspected.parse.warnings[0].code).toBe(
        "unsupported_schema_version",
      );
    });

    it("still routes FIT uploads to the file adapter", async () => {
      const inspected = await inspectAndParse(readFixture("activity.gpx"));
      expect(inspected.source).toBe("garmin-file");
    });
  });
});
