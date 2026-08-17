import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("environment split", () => {
  it("does not expose the admin secret as a public Next env var", () => {
    const example = readFileSync(join(process.cwd(), ".env.example"), "utf8");
    expect(example).toMatch(/NHOST_SUBDOMAIN=/);
    expect(example).toMatch(/NEXT_PUBLIC_NHOST_SUBDOMAIN=/);
    expect(example).not.toMatch(/NEXT_PUBLIC_NHOST_ADMIN_SECRET/);
    expect(example).not.toMatch(/NEXT_PUBLIC_NUTRITION_AI/);
    expect(example).not.toMatch(/^NHOST_ADMIN_SECRET=.+$/m);
  });
});
