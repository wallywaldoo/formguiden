import { describe, expect, it } from "vitest";

import {
  CredentialMaterialError,
  assertNoCredentialMaterial,
  scanForCredentialMaterial,
} from "@/lib/import/credentials/scan";

import {
  encodeActivityFit,
  garminConnectConfigBytes,
  jsonBytes,
  machOBytes,
  personalInformationBytes,
  readFixture,
  socialProfileBytes,
} from "../import-fixtures/helpers";

const encoder = new TextEncoder();

function bytes(text: string): Uint8Array {
  return encoder.encode(text);
}

describe("credential material scanning", () => {
  describe("rejects credential material", () => {
    it("rejects GarminDB's GarminConnectConfig.json", () => {
      const finding = scanForCredentialMaterial(garminConnectConfigBytes());
      expect(finding?.code).toBe("credential_material_detected");
    });

    it("rejects a config with only the credentials/directories fingerprint", () => {
      // No key matches the credential pattern; only the document shape does.
      const finding = scanForCredentialMaterial(
        jsonBytes({
          credentials: { user: "user@example.invalid" },
          directories: { base_dir: "HealthData" },
        }),
      );
      expect(finding?.code).toBe("credential_material_detected");
    });

    it("rejects any JSON carrying a credential key, whatever it is named", () => {
      for (const key of [
        "password",
        "secret",
        "access_token",
        "refresh_token",
        "cookie",
        "authorization",
        "api_key",
      ]) {
        const finding = scanForCredentialMaterial(
          jsonBytes({ harmless: 1, nested: { [key]: "value" } }),
        );
        expect(finding?.code, `key ${key}`).toBe(
          "credential_material_detected",
        );
      }
    });

    it("rejects a credential key even when the value is empty or false", () => {
      expect(scanForCredentialMaterial(jsonBytes({ password: "" }))?.code).toBe(
        "credential_material_detected",
      );
      expect(
        scanForCredentialMaterial(jsonBytes({ secure_password: false }))?.code,
      ).toBe("credential_material_detected");
    });

    it("rejects JWT-shaped and Bearer token content", () => {
      const jwt =
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJleGFtcGxlIn0.c2lnbmF0dXJlLXZhbHVl";
      expect(scanForCredentialMaterial(bytes(jwt))?.code).toBe(
        "credential_material_detected",
      );
      expect(
        scanForCredentialMaterial(
          bytes("Authorization: Bearer abcdefghijklmnopqrstuvwxyz012345"),
        )?.code,
      ).toBe("credential_material_detected");
    });

    it("rejects private key armour and Set-Cookie headers", () => {
      expect(
        scanForCredentialMaterial(
          bytes("-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n"),
        )?.code,
      ).toBe("credential_material_detected");
      expect(
        scanForCredentialMaterial(bytes("Set-Cookie: GARMIN-SSO=abc; Path=/"))
          ?.code,
      ).toBe("credential_material_detected");
    });

    it("rejects credential literals embedded in a binary container", () => {
      const container = new Uint8Array(4096);
      container.set(bytes("SQLite format 3\u0000"), 0);
      container.set(bytes("refresh_token"), 2048);
      expect(scanForCredentialMaterial(container)?.code).toBe(
        "credential_material_detected",
      );
    });
  });

  describe("rejects identity material", () => {
    it("rejects personal-information.json", () => {
      expect(scanForCredentialMaterial(personalInformationBytes())?.code).toBe(
        "identity_material_detected",
      );
    });

    it("rejects social-profile.json", () => {
      expect(scanForCredentialMaterial(socialProfileBytes())?.code).toBe(
        "identity_material_detected",
      );
    });
  });

  describe("rejects executable and diagnostic content", () => {
    it("rejects Mach-O, ELF, PE, WASM, and shebang scripts", () => {
      const cases: Record<string, Uint8Array> = {
        macho: machOBytes(),
        elf: Uint8Array.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01]),
        pe: Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]),
        wasm: Uint8Array.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00]),
        shebang: bytes("#!/bin/sh\necho hi\n"),
      };
      for (const [name, value] of Object.entries(cases)) {
        expect(scanForCredentialMaterial(value)?.code, name).toBe(
          "executable_content_detected",
        );
      }
    });

    it("rejects GarminDB log output", () => {
      expect(
        scanForCredentialMaterial(
          bytes("root : DEBUG : import_monitoring.py: starting\n"),
        )?.code,
      ).toBe("diagnostic_material_detected");
      expect(
        scanForCredentialMaterial(
          bytes('Traceback (most recent call last):\n  File "x.py"\n'),
        )?.code,
      ).toBe("diagnostic_material_detected");
    });
  });

  describe("accepts legitimate import payloads", () => {
    it("accepts FIT, TCX, GPX, and CSV without false positives", () => {
      const payloads: Record<string, Uint8Array> = {
        fit: encodeActivityFit(),
        tcx: readFixture("activity.tcx"),
        gpx: readFixture("activity.gpx"),
        csv: readFixture("activities.csv"),
      };
      for (const [name, value] of Object.entries(payloads)) {
        expect(scanForCredentialMaterial(value), name).toBeNull();
      }
    });

    it("accepts empty input rather than failing closed on nothing", () => {
      expect(scanForCredentialMaterial(new Uint8Array(0))).toBeNull();
    });

    it("accepts JSON whose keys merely resemble credentials", () => {
      // "tokenizer" and "sessions" are not credential keys; only exact matches count.
      expect(
        scanForCredentialMaterial(
          jsonBytes({ tokenizer: "x", sessions: 3, passwordless: true }),
        ),
      ).toBeNull();
    });
  });

  describe("leak safety", () => {
    it("never echoes the matched value or key path", () => {
      const finding = scanForCredentialMaterial(garminConnectConfigBytes());
      expect(finding).not.toBeNull();
      const message = finding?.message ?? "";
      expect(message).not.toContain("not-a-real-password");
      expect(message).not.toContain("user@example.invalid");
      expect(message).not.toContain("credentials");
      expect(message).not.toContain("password");
    });

    it("throws a coded error carrying no content", () => {
      try {
        assertNoCredentialMaterial(garminConnectConfigBytes());
        expect.unreachable("expected rejection");
      } catch (error) {
        expect(error).toBeInstanceOf(CredentialMaterialError);
        const typed = error as CredentialMaterialError;
        expect(typed.code).toBe("credential_material_detected");
        expect(typed.message).not.toContain("not-a-real-password");
      }
    });

    it("does not throw for accepted payloads", () => {
      expect(() =>
        assertNoCredentialMaterial(encodeActivityFit()),
      ).not.toThrow();
    });
  });
});
