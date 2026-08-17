import {
  NotEligibleError,
  type ImportProviderAdapter,
} from "@/lib/import/adapters/types";
import type { FileKind } from "@/lib/import/detect";
import type { ParseResult } from "@/lib/import/types";

export const garminApiAdapter: ImportProviderAdapter = {
  id: "garmin-api",
  detect(): FileKind | null {
    return null;
  },
  parse(): ParseResult {
    throw new NotEligibleError();
  },
  externalId(): string | null {
    return null;
  },
};
