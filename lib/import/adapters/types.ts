import type { FileKind } from "@/lib/import/detect";
import type { ParseResult } from "@/lib/import/types";

export type ImportProviderId =
  "garmin-file" | "garmin-api" | "garmindb" | "garmin-connect";

export type ImportParseContext = {
  fileKind: FileKind;
  /**
   * IANA zone from user_preferences. Required by sources that store naive
   * local timestamps, such as GarminDB.
   */
  timeZone?: string;
};

export type ImportProviderAdapter = {
  id: ImportProviderId;
  detect(bytes: Uint8Array): FileKind | null;
  parse(
    bytes: Uint8Array,
    context: ImportParseContext,
  ): ParseResult | Promise<ParseResult>;
  externalId(record: { externalId: string | null }): string | null;
};

export class NotEligibleError extends Error {
  constructor(message = "Official Garmin API is not enabled.") {
    super(message);
    this.name = "NotEligibleError";
  }
}
