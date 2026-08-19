import { hashSync } from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { hasConfiguredPassword, verifyPassword } from "@/lib/auth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("auth password verification", () => {
  it("rejects every login when AUTH_PASSWORD is missing", () => {
    vi.unstubAllEnvs();

    expect(hasConfiguredPassword()).toBe(false);
    expect(verifyPassword("Viktor123*")).toBe(false);
  });

  it("accepts a matching plaintext password", () => {
    vi.stubEnv("AUTH_PASSWORD", "Viktor123*");

    expect(hasConfiguredPassword()).toBe(true);
    expect(verifyPassword("Viktor123*")).toBe(true);
    expect(verifyPassword("wrong-password")).toBe(false);
  });

  it("accepts a matching bcrypt password hash", () => {
    vi.stubEnv("AUTH_PASSWORD", hashSync("Viktor123*", 10));

    expect(hasConfiguredPassword()).toBe(true);
    expect(verifyPassword("Viktor123*")).toBe(true);
    expect(verifyPassword("wrong-password")).toBe(false);
  });
});
