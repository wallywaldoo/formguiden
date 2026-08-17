import { describe, expect, it } from "vitest";

const live = Boolean(
  process.env.NHOST_TEST_GRAPHQL_URL &&
  process.env.NHOST_TEST_USER_A_JWT &&
  process.env.NHOST_TEST_USER_B_JWT,
);

async function graphql(
  jwt: string | undefined,
  query: string,
  variables?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
) {
  const response = await fetch(process.env.NHOST_TEST_GRAPHQL_URL!, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(jwt ? { authorization: `Bearer ${jwt}` } : {}),
      ...extraHeaders,
    },
    body: JSON.stringify({ query, variables }),
  });
  return response.json() as Promise<{
    data?: Record<string, unknown>;
    errors?: Array<{ message: string; extensions?: { code?: string } }>;
  }>;
}

const SELECT_PROFILES = /* GraphQL */ `
  query SelectProfiles {
    profiles {
      user_id
      display_name
    }
  }
`;

describe.skipIf(!live)(
  "live Hasura/Storage authorization (requires Nhost)",
  () => {
    const jwtA = process.env.NHOST_TEST_USER_A_JWT!;
    const jwtB = process.env.NHOST_TEST_USER_B_JWT!;

    it("lets user A read only A's profile", async () => {
      const result = await graphql(jwtA, SELECT_PROFILES);
      const rows = (result.data?.profiles ?? []) as Array<{ user_id: string }>;
      expect(result.errors).toBeUndefined();
      expect(rows.length).toBeLessThanOrEqual(1);
    });

    it("rejects anonymous reads of profiles", async () => {
      const result = await graphql(undefined, SELECT_PROFILES);
      const rows = (result.data?.profiles ?? []) as unknown[];
      expect(rows).toEqual([]);
    });

    it("ignores a spoofed x-hasura-user-id header from A", async () => {
      const asA = await graphql(jwtA, SELECT_PROFILES);
      const spoofed = await graphql(jwtA, SELECT_PROFILES, undefined, {
        "x-hasura-user-id": "00000000-0000-0000-0000-00000000000b",
      });
      expect(spoofed.data?.profiles).toEqual(asA.data?.profiles);
    });

    it("rejects x-hasura-role admin for a normal user", async () => {
      const result = await graphql(jwtA, SELECT_PROFILES, undefined, {
        "x-hasura-role": "admin",
      });
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("does not let A insert a profile as B", async () => {
      const result = await graphql(
        jwtA,
        /* GraphQL */ `
          mutation InsertAsB($user_id: uuid!) {
            insert_profiles_one(
              object: { user_id: $user_id, display_name: "nope" }
            ) {
              user_id
            }
          }
        `,
        { user_id: "00000000-0000-0000-0000-00000000000b" },
      );
      expect(result.errors?.length).toBeGreaterThan(0);
    });

    it("does not return B's files to A", async () => {
      const result = await graphql(
        jwtA,
        /* GraphQL */ `
          query Files {
            files {
              id
              uploaded_by_user_id
            }
          }
        `,
      );
      const files = (result.data?.files ?? []) as Array<{
        uploaded_by_user_id: string;
      }>;
      const bProfile = await graphql(jwtB, SELECT_PROFILES);
      const bId = (
        (bProfile.data?.profiles ?? []) as Array<{ user_id: string }>
      )[0]?.user_id;
      if (bId) {
        expect(files.every((file) => file.uploaded_by_user_id !== bId)).toBe(
          true,
        );
      }
    });

    it("does not return B's imports or activities to A", async () => {
      const result = await graphql(
        jwtA,
        /* GraphQL */ `
          query Isolation {
            data_imports {
              id
              user_id
            }
            import_files {
              id
              user_id
            }
            activities {
              id
              user_id
            }
            daily_health_metrics {
              id
              user_id
            }
            body_measurements {
              id
              user_id
            }
          }
        `,
      );
      expect(result.errors).toBeUndefined();
      const bProfile = await graphql(jwtB, SELECT_PROFILES);
      const bId = (
        (bProfile.data?.profiles ?? []) as Array<{ user_id: string }>
      )[0]?.user_id;
      if (!bId) {
        return;
      }
      for (const key of [
        "data_imports",
        "import_files",
        "activities",
        "daily_health_metrics",
        "body_measurements",
      ]) {
        const rows = (result.data?.[key] ?? []) as Array<{ user_id: string }>;
        expect(rows.every((row) => row.user_id !== bId)).toBe(true);
      }
    });

    it("rejects anonymous reads of import tables", async () => {
      const result = await graphql(
        undefined,
        /* GraphQL */ `
          query AnonImports {
            data_imports {
              id
            }
            activities {
              id
            }
          }
        `,
      );
      expect(result.data?.data_imports ?? []).toEqual([]);
      expect(result.data?.activities ?? []).toEqual([]);
    });
  },
);
