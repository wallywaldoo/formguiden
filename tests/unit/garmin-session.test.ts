import { describe, expect, it } from "vitest";

import {
  parseGarminSession,
  userFacingGarminError,
} from "@/lib/garmin/session";

describe("parseGarminSession", () => {
  it("accepts raw JSON tokens", () => {
    const session = parseGarminSession(
      JSON.stringify({
        di_token: "token",
        di_refresh_token: "refresh",
        di_client_id: "client",
      }),
    );

    expect(session).toEqual({
      di_token: "token",
      di_refresh_token: "refresh",
      di_client_id: "client",
    });
  });

  it("accepts base64-encoded JSON tokens", () => {
    const encoded = Buffer.from(
      JSON.stringify({
        di_token: "token",
        di_refresh_token: "refresh",
        di_client_id: "client",
      }),
      "utf-8",
    ).toString("base64");

    expect(parseGarminSession(encoded)?.di_token).toBe("token");
  });

  it("rejects placeholders and incomplete payloads", () => {
    expect(parseGarminSession("changeme")).toBeNull();
    expect(parseGarminSession("{}")).toBeNull();
    expect(parseGarminSession('{"di_token":"x"}')).toBeNull();
  });
});

describe("userFacingGarminError", () => {
  it("maps invalid session errors to Swedish copy", () => {
    expect(
      userFacingGarminError("Garmin token refresh failed (404): Not Found"),
    ).toContain("gått ut");
  });
});
