# Security model

Health data is sensitive. This model is **zero-trust at the API**. A logged-in session is not authorization. A role name is not authorization. A client-supplied `user_id` is not identity.

## 1. Identity source of truth

1. User authenticates with Nhost Auth.
2. Nhost issues a JWT access token with Hasura claims, including `x-hasura-user-id`, `x-hasura-default-role`, and `x-hasura-allowed-roles`.
3. Hasura and Storage evaluate permissions using those **verified** session variables.
4. Application code may read `session.user.id` from the server Nhost client **after** cookie session parse + refresh. It must still not trust a `user_id` field in GraphQL variables for ownership.

Never:

- Trust editable `users.metadata` or client-controlled custom claims for authorization
- Let the client pick `admin` or any privileged role
- Put `NHOST_ADMIN_SECRET`, database URLs, or AI keys in `NEXT_PUBLIC_*`
- Use a client-provided Storage `uploaded_by_user_id`
- Read an identity field out of imported data. `user_id` comes from the verified session and nothing else — not from an upload, not from a filename, not from a row inside an imported database.

## 1a. Third-party credentials — absolute prohibition

Formkurvan must never collect, receive, store, proxy, log, or process a user's Garmin username, password, MFA code, session cookie, OAuth token, `GarminConnectConfig.json`, or any other Garmin credential material.

This holds even when a user tries to hand them over. Uploads are scanned by **content** for credential material and rejected before persistence — see §8.2 and [garmindb-compatibility.md](garmindb-compatibility.md) §3.3.

There is no Garmin login form, no credential field, and no OAuth-looking flow anywhere in the application. Tools like GarminDB that do hold credentials run on the user's own machine, outside our trust boundary, and we never receive their configuration.

Sources:

- [Nhost permission variables](https://docs.nhost.io/products/graphql/permissions/permission-variables)
- [Nhost users and roles](https://docs.nhost.io/products/auth/users)
- [Hasura column presets](https://hasura.io/docs/2.0/schema/postgres/default-values/column-presets/)
- [Hasura row permissions and post-update checks](https://hasura.io/docs/2.0/auth/authorization/permissions/row-level-permissions/)

## 2. Official Next.js App Router pattern (verified)

Nhost's current tutorial (Next.js **16**, Node **22+**):

- Package: `@nhost/nhost-js`
- `createServerClient` with cookie `SessionStorage`
- `handleNhostProxy` in **`src/proxy.ts`** (Next.js 16 renamed middleware → proxy)
- Server Actions for sign-in / sign-up / sign-out
- Route Handler for PKCE email verification (`tokenExchange`)
- Server Components call `createNhostClient()` then `nhost.graphql.request` / `nhost.storage.*`

Sources:

- [Protecting routes](https://docs.nhost.io/getting-started/tutorials/nextjs/2-protected-routes/)
- [User authentication](https://docs.nhost.io/getting-started/tutorials/nextjs/3-user-authentication)
- [GraphQL operations](https://docs.nhost.io/getting-started/tutorials/nextjs/4-graphql-operations)
- [File uploads](https://docs.nhost.io/getting-started/tutorials/nextjs/5-file-uploads)

Re-verify these pages at the start of Phase 1 before copying APIs.

## 3. Session cookie — unavoidable client-readable storage

The official Nhost Next.js helper sets the session cookie as:

```ts
httpOnly: false, // if set to true we can't access it in the client
secure: process.env.NODE_ENV === "production",
sameSite: "lax",
maxAge: 60 * 60 * 24 * 30,
```

The cookie value is a JSON `StoredSession` (access token + refresh token material).

### Implications

| Topic          | Assessment                                                                                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| XSS            | Any successful script injection can read the session cookie and call GraphQL/Storage as the user.                                                                 |
| HttpOnly       | Official architecture **does not** use HttpOnly. Setting `httpOnly: true` would break the documented client session access.                                       |
| Secure         | Enabled in production. Required.                                                                                                                                  |
| SameSite       | `lax` is appropriate for top-level email verification links. Do not use `none` without a documented need.                                                         |
| CSRF           | SameSite=lax + Server Actions origin checks. Mutations that change health data must run as Server Actions or require the Authorization header from the same site. |
| Token lifetime | Access tokens are short-lived (Nhost default 15 minutes). Refresh tokens last longer (default 30 days). Refresh runs in the proxy.                                |

### Mitigations (mandatory in Phase 1+)

1. Follow the official cookie shape for compatibility.
2. Treat XSS as a full-account compromise. Strict CSP, no `dangerouslySetInnerHTML` for user Garmin notes without sanitization, dependency pinning.
3. Never store a second copy of tokens in `localStorage`.
4. Sign out must delete the cookie and revoke the Nhost session.
5. Do not log cookies, `Authorization` headers, or pre-signed URLs.
6. Document this trade-off in the Phase 1 security notes again if Nhost adds an HttpOnly-first recipe.

## 4. Roles

| Role                          | Use                                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `public`                      | Unauthenticated. **No** select/insert/update/delete on health, imports, files, recommendations, AI tables. Auth pages only. |
| `user`                        | Default authenticated role. Row ownership `user_id = X-Hasura-User-Id`.                                                     |
| `me`                          | Nhost default allowed role. Do not grant extra data access. Either unused or identical tight rules.                         |
| `admin` / Hasura admin secret | Server operators and CLI only. Never an allowed role for app users. Never sent from the browser.                            |

Signup `allowedRoles` must not include privileged roles. Configure Nhost Auth so users cannot self-select `admin`.

Do not add custom JWT claims from `users.metadata`.

## 5. Hasura permissions (every exposed table)

Zero-trust default: if a permission is missing, the operation is denied.

For each user-owned table, role `user`:

| Operation | Row rule                              | Columns                        | Presets / checks                 |
| --------- | ------------------------------------- | ------------------------------ | -------------------------------- |
| select    | `user_id _eq X-Hasura-User-Id`        | Only fields the UI needs       | —                                |
| insert    | check `user_id _eq X-Hasura-User-Id`  | No `user_id` in client columns | `set.user_id = X-Hasura-User-Id` |
| update    | filter `user_id _eq X-Hasura-User-Id` | No `user_id`                   | Post-update check same ownership |
| delete    | `user_id _eq X-Hasura-User-Id`        | —                              | —                                |

Child tables (`activity_laps`, `strength_sets`, `recommendation_signals`) **also** have `user_id` populated by trigger or preset so nested filters cannot rely on parent join alone.

Relationships: Hasura still applies permissions on the related table. Verify with nested queries in authorization tests (section 10).

Do not expose `provider_payload` in list queries if it may contain serial numbers the UI does not need; detail view may include a redacted subset.

## 6. Nhost Storage

Buckets: `garmin-imports` (private, durable) and — Phase 6 — `garmindb-quarantine` (private, unvalidated landing zone, 24 h TTL).

Uploader identity: **on** for upload and replace — `uploaded_by_user_id` prefilled from `X-Hasura-User-Id`. [Storage permissions](https://docs.nhost.io/products/storage/permissions/)

| Action                     | `user` rule                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| Upload                     | `bucket_id _eq garmin-imports` + uploader identity                            |
| Download / select metadata | `bucket_id _eq garmin-imports` AND `uploaded_by_user_id _eq X-Hasura-User-Id` |
| Replace                    | same ownership + bucket; uploader identity on                                 |
| Delete                     | same ownership + bucket                                                       |

`public` role: no access.

Download for parsing: server uses the **user session** Storage client, not the admin secret.

Pre-signed URLs: expiration **30 s**, issued only after authorization, never stored, never logged. Prefer authenticated `getFile` for in-app preview when possible.

GraphQL `files` / `buckets` tracking: users must not list other users' files. Do not grant select on all `storage.files` columns beyond what download requires; Nhost docs note download requires select on all columns — grant select **with the row filter**, not unfiltered.

### 6.1 Quarantine bucket (Phase 6)

Unvalidated bytes must not become durable artifacts. `garmindb-quarantine` holds an upload only until validation and user confirmation complete.

| Rule            | Value                                                                      |
| --------------- | -------------------------------------------------------------------------- |
| Permissions     | Identical row filters to `garmin-imports`; `uploaded_by_user_id` prefilled |
| Max size        | 25 MiB                                                                     |
| On rejection    | Object deleted immediately; only a rejection audit record survives         |
| On confirm      | Bytes copied to `garmin-imports`, quarantine object deleted                |
| TTL             | 24 h sweep for abandoned uploads                                           |
| Pre-signed URLs | Disabled — server-side authenticated reads only                            |

Rationale for uploading before validating: Vercel request-body limits make streaming a 25 MiB file through a Route Handler impractical. The quarantine bucket preserves the guarantee that nothing unvalidated or unconfirmed is retained.

## 7. Server-only privileges

| Secret                       | Location                                                 |
| ---------------------------- | -------------------------------------------------------- |
| `NHOST_ADMIN_SECRET`         | Server env / Vercel encrypted env. Never `NEXT_PUBLIC_`. |
| Postgres connection string   | Server-only. Not used for user CRUD.                     |
| AI provider keys             | Server-only, Phase 4+ if approved                        |
| Hasura metadata / CLI tokens | Developer machine and CI, not the web bundle             |

User-facing CRUD goes through GraphQL or Storage with the user JWT.

If a maintenance script uses the admin secret, it must take an explicit `user_id` argument, log an audit event, and not be reachable from Route Handlers that the browser can call without a separate operator auth story (there is no operator UI in the MVP).

## 8. Input validation

- Zod on every Server Action and Route Handler.
- File type from magic bytes, not `File.type`.
- ZIP bomb limits (see import strategy).
- Numeric ranges for weight, BP, RPE, etc.
- Timezone must be a valid IANA name.

### 8.1 Uploads are untrusted input

Filenames, extensions, MIME types, and archive entry paths are display strings. They never drive a decision. Classification comes from content.

Archive entries are rejected for symlinks, hardlinks, path traversal (`..`, absolute paths, drive letters, backslashes, NUL), nested archives beyond the configured depth, compression ratios above threshold, and executable magic bytes (MZ, ELF, Mach-O, `#!`). Extraction is **in memory only** — the import path never writes an uploaded file to disk.

### 8.2 Credential material scanning (Phase 6)

Every candidate byte range is scanned before parsing and before durable persistence. A match rejects the whole upload.

Probes are structural, not name-based: JSON key names matching credential patterns, a `credentials` object containing `user`, JWT/`Bearer`/private-key armour shapes, the `GarminConnectConfig.json` field fingerprint, and Garmin profile identity keys. Full probe list in [garmindb-compatibility.md](garmindb-compatibility.md) §3.3.

Rejection errors are **category-level only** (`credential_material_detected`). They never echo the matched value, the key path, or any file content.

### 8.3 Untrusted SQLite (Phase 6)

An uploaded SQLite database is hostile input, not a data source to be trusted.

| Control        | Rule                                                                            |
| -------------- | ------------------------------------------------------------------------------- |
| Engine         | `sql.js` — WASM, memory-isolated, built without loadable extensions             |
| Native addons  | Forbidden                                                                       |
| Mode           | Read-only. No writes, no `ATTACH`, no `PRAGMA` writes, no `load_extension`      |
| SQL            | Frozen string literals with a fixed column allowlist. No user input reaches SQL |
| Schema check   | Inspect `sqlite_master` first; reject triggers and virtual tables               |
| View shadowing | An allowlisted table name must resolve to `type = 'table'`                      |
| Size           | ≤ 25 MiB, checked before the bytes reach the engine                             |
| Rows           | ≤ 50 000 per table, ≤ 200 000 per import, enforced via `LIMIT`                  |
| Wall clock     | 15 s per slice, then abort                                                      |
| Teardown       | `close()` in `finally`; bytes dropped before responding                         |

No column outside the allowlist is read, so device serial numbers and any identity fields never enter the application.

### 8.4 Import logging rules

Never logged: file bytes, archive entry contents, matched credential values, credential-scan key paths, pre-signed URLs, access tokens, or third-party profile identifiers.

Logged: import id, user id, checksum, detected kind, schema version, row counts, error **codes**, duration.

## 9. Threat model

Assets, in priority order: the user's health history, their Nhost session, and third-party credentials we intend never to hold.

Trust boundaries: the browser is untrusted; uploaded files are untrusted; any tool the user runs locally (GarminDB, a watch, a spreadsheet) is outside our boundary and its output is untrusted input.

| Threat                                                | Primary mitigation                                                                      | Verified by           |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------- |
| Cross-tenant read/write                               | Hasura row filters on `user_id`; insert presets; denormalized ownership on child tables | §10 tests 4–14        |
| Client forges `user_id` or role                       | JWT claims are authoritative; client headers ignored                                    | §10 tests 12–13       |
| Session theft via XSS                                 | Strict CSP, sanitization, no second token copy; cookie is not HttpOnly by design (§3)   | Review, Phase 1       |
| Credential material reaching our systems              | Content-based scanning; rejection before persistence; no credential UI                  | §8.2, §10 tests 15–17 |
| Malicious upload exploiting a parser                  | WASM isolation, size/row/time ceilings, magic-byte gating                               | §8.3, import fixtures |
| Resource exhaustion (zip bomb, row explosion)         | Ratio, entry, row, and wall-clock caps                                                  | §8.1, §8.3            |
| Path traversal or symlink write                       | In-memory extraction only; entries rejected                                             | §8.1                  |
| Unvalidated data becoming a durable artifact          | Quarantine bucket, delete on rejection                                                  | §6.1                  |
| Secret leakage through logs or errors                 | Category-only error codes; §8.4 logging rules                                           | §10 test 18           |
| Admin secret bypassing row permissions on a user path | User-session client for all user data; admin secret is CLI/maintenance only             | §7, build-time grep   |
| Silent data corruption from ambiguous units           | Refuse import when the measurement system is unknown                                    | GarminDB test 24      |
| Backend unavailable leaking internals                 | Wrapped errors, Swedish maintenance message                                             | Architecture §12      |

Out of scope for the MVP threat model, documented rather than mitigated: a malicious Nhost or Vercel operator, physical access to the user's device, and compromise of the user's email account.

Per-feature threat models live with their designs. GarminDB: [garmindb-compatibility.md](garmindb-compatibility.md) §8.

## 10. Operational security (Starter)

- Project may **pause after 7 days inactivity**. Handle 5xx/network errors without leaking internals.
- **No automated backups** on Starter. Manual `pg_dump` + separate Storage sync is required before real users. Database dump **does not** include Garmin file bytes. [Backups](https://docs.nhost.io/products/database/backups)
- Encryption at rest/transit is provided by Nhost; this does not replace row-level authorization.
- Nhost HIPAA is **not** available (“coming soon” on their security page). Do not claim HIPAA.

## 11. Automated authorization tests (minimum)

Framework: integration tests against local Nhost (`nhost up`) with two seeded users A and B plus anonymous.

Positive:

1. A selects, inserts, updates, deletes A's `activities` (and other owned tables).
2. A uploads, lists, downloads, replaces, deletes A's file in `garmin-imports`.
3. Nested `activities { activity_laps { ... } }` returns only A's laps.

Negative:

4. A cannot select B's rows (empty, not error-with-data).
5. A cannot insert a row with B's `user_id` (preset overrides or reject).
6. A cannot update B's row (including by primary key guess).
7. A cannot delete B's row.
8. A cannot update `user_id` on A's row to B.
9. A cannot list/download/replace/delete B's Storage file (by id).
10. Anonymous cannot select health tables or Storage files.
11. Nested query `activities(where: { user_id: { _eq: B }})` returns empty for A.
12. Client header `x-hasura-user-id: B` is ignored; JWT claims win.
13. `x-hasura-role: admin` fails for a normal user.
14. GraphQL mutation inserting `uploaded_by_user_id` / file metadata cannot impersonate B.

Content safety (Phase 6):

15. Credential material is rejected standalone and inside an archive.
16. The same credential file renamed to an accepted name is still rejected — content wins over filename.
17. An identity file (Garmin profile JSON) is rejected.
18. Rejection messages and logs contain no credential values, key paths, or file contents.
19. A crafted `user_id` inside an uploaded database is ignored; rows belong to the session user.
20. A cannot read, download, resume, confirm, or commit any of B's GarminDB import artifacts, in either bucket.
21. Account deletion removes the user's quarantine objects, durable objects, and normalized rows.

These tests are a Phase 1 deliverable for tables that exist then (`profiles`, `user_preferences`, `goals`, Storage), and expand in later phases. Tests 15–21 activate with Phase 6; the full list is in [garmindb-compatibility.md](garmindb-compatibility.md) §10.

## 12. Security review checkpoints

| Phase | Extra check                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------- |
| 1     | Cookie flags, env split, permission YAML in git, auth tests green                               |
| 2     | Storage tests, magic-byte tests, no admin-secret parse path                                     |
| 4     | AI: no extra health fields in prompts; rate limit; no key in client                             |
| 5     | Export/delete completeness; incident notes; backup restore drill                                |
| 6     | Credential scan coverage, SQLite sandbox limits, quarantine lifecycle, no GarminDB code in tree |
