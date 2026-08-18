import type { ImportProviderAdapter } from "@/lib/import/adapters/types";
import {
  isGarminDbCandidate,
  parseGarminDbUpload,
} from "@/lib/import/garmindb";
import { isSqliteFile } from "@/lib/import/garmindb/open";

/**
 * Converts GarminDB's local `garmin.db` export into the canonical model.
 *
 * GarminDB itself runs on the user's own computer and is never invoked,
 * embedded, or depended on here. See docs/garmindb-compatibility.md.
 */
export const garminDbAdapter: ImportProviderAdapter = {
  id: "garmindb",
  detect(bytes) {
    if (isSqliteFile(bytes)) {
      return "sqlite";
    }
    return null;
  },
  async parse(bytes, context) {
    const outcome = await parseGarminDbUpload(bytes, {
      timeZone: context.timeZone ?? "Europe/Stockholm",
    });
    return outcome.result;
  },
  externalId(record) {
    return record.externalId;
  },
};

export { isGarminDbCandidate };
