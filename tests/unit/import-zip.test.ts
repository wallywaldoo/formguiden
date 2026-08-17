import { describe, expect, it } from "vitest";

import { MAX_ZIP_ENTRIES } from "@/lib/import/limits";
import { ZipLimitError, listZipEntries } from "@/lib/import/zip";

import {
  encodeActivityFit,
  readFixture,
  zipFromEntries,
} from "../import-fixtures/helpers";

describe("ZIP import limits", () => {
  it("extracts mixed FIT/TCX/GPX/CSV entries", () => {
    const archive = zipFromEntries({
      "run.fit": encodeActivityFit(),
      "run.tcx": readFixture("activity.tcx"),
      "run.gpx": readFixture("activity.gpx"),
      "runs.csv": readFixture("activities.csv"),
    });
    const entries = listZipEntries(archive);
    expect(entries.map((entry) => entry.path).sort()).toEqual([
      "run.fit",
      "run.gpx",
      "run.tcx",
      "runs.csv",
    ]);
  });

  it("rejects archives with more than 100 files", () => {
    const entries: Record<string, Uint8Array> = {};
    const payload = new TextEncoder().encode("a,b,c\n1,2,3");
    for (let index = 0; index < MAX_ZIP_ENTRIES + 1; index += 1) {
      entries[`file-${index}.csv`] = payload;
    }
    expect(() => listZipEntries(zipFromEntries(entries))).toThrow(
      ZipLimitError,
    );
    try {
      listZipEntries(zipFromEntries(entries));
    } catch (error) {
      expect(error).toBeInstanceOf(ZipLimitError);
      expect((error as ZipLimitError).code).toBe("zip_entries");
    }
  });

  it("rejects nested ZIP deeper than three levels", () => {
    const inner = zipFromEntries({ "leaf.csv": readFixture("activities.csv") });
    const level2 = zipFromEntries({ "inner.zip": inner });
    const level3 = zipFromEntries({ "mid.zip": level2 });
    const level4 = zipFromEntries({ "outer.zip": level3 });
    expect(() => listZipEntries(level4)).toThrow(ZipLimitError);
    try {
      listZipEntries(level4);
    } catch (error) {
      expect((error as ZipLimitError).code).toBe("zip_nesting");
    }
  });

  it("rejects a zip bomb with an extreme inflate ratio", () => {
    const zeros = new Uint8Array(2 * 1024 * 1024);
    expect(() => listZipEntries(zipFromEntries({ "bomb.bin": zeros }))).toThrow(
      ZipLimitError,
    );
    try {
      listZipEntries(zipFromEntries({ "bomb.bin": zeros }));
    } catch (error) {
      expect((error as ZipLimitError).code).toBe("zip_bomb");
    }
  });
});
