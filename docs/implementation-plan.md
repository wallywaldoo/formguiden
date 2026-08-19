# Implementation plan

Work in small phases. Do not implement all phases at once. **Stop after each phase until the owner approves the next.**

## Current repository state (18 August 2026)

Phase 5 coaching and hardening is in the repository: deterministic recommendations, weekly report, data export, account deletion with grace period, and [operations.md](operations.md). Phase 4 logging (nutrition, hydration, strength) and the disabled AI stub remain unchanged. Local `nhost up` and a live Vercel preview still require Docker + Nhost CLI and owner-created cloud projects. Starter still pauses after 7 days and has no automated backups.

Phase 6 (GarminDB compatibility) is **designed and approved** in [garmindb-compatibility.md](garmindb-compatibility.md), but no integration code has been written yet.

## Phase 0 — Specification (complete)

**Objective:** Lock product, security, data, import, AI, and design decisions without writing production app code.

**Created:**

- `README.md`
- `docs/product-spec.md`
- `docs/mvp-scope.md`
- `docs/user-flows.md`
- `docs/data-import-strategy.md`
- `docs/database-schema.md`
- `docs/security-model.md`
- `docs/ai-nutrition-estimation.md`
- `docs/app-architecture.md`
- `docs/design-system.md`
- `docs/implementation-plan.md` (this file)

**Amended 18 August 2026** for the GarminDB compatibility path:

- `docs/garmindb-compatibility.md` (new — architecture, import strategy, threat model, licensing, acceptance criteria)
- `docs/data-import-strategy.md` §11 and the adapter model
- `docs/security-model.md` §1a, §6.1, §8.1–8.4, §9 threat model, §11 tests 15–21, §12
- `docs/app-architecture.md` §2, §8.1, §11

**Not done:** Next.js app, Nhost init, Vercel project, secrets.

---

## Phase 1 — Foundation (complete in repo; cloud preview pending owner accounts)

### Objective

Ship a deployable Next.js app with Nhost Auth, isolated profile/goals data, Hasura + Storage authorization, onboarding, and a Vercel preview. No Garmin parser yet.

### Files to create or modify (expected)

- `package.json`, lockfile, `tsconfig.json` (strict), `next.config.ts`, `eslint.config.*`
- `app/` auth + dashboard shells + onboarding
- `proxy.ts`
- `lib/nhost/server.ts` (and client only if required)
- `components/ui/*` from shadcn.io allowlist
- `features/auth`, `features/profiles`, `features/goals`
- `nhost/nhost.toml`, `nhost/migrations/*`, `nhost/metadata/*`, `nhost/seeds/*`
- `tests/authorization/*`, `tests/unit/*` for goal pace
- `.env.example`, `.gitignore`
- `docs/` updates only if APIs differ from this spec after re-verification

### External accounts, secrets, approvals, costs

| Item                                                  | Who   | Cost                          | Approval                            |
| ----------------------------------------------------- | ----- | ----------------------------- | ----------------------------------- |
| GitHub repo (already named formkurvan)                | Owner | $0                            | —                                   |
| Nhost account + **Starter** project in `eu-central-1` | Owner | $0                            | Allowed. Do **not** upgrade to Pro. |
| Vercel Hobby project                                  | Owner | $0                            | Allowed for preview                 |
| SMTP / email (Nhost default email)                    | Nhost | $0 on Starter with limits     | Confirm deliverability in Phase 1   |
| Custom domain                                         | —     | Nhost lists $10/project/month | **Not now**                         |
| AI provider                                           | —     | Paid                          | **Not now**                         |
| Nhost Pro / backups add-on                            | —     | from $25/month                | **Not now**                         |

Owner must create the Nhost project and send subdomain + region for env vars. Admin secret stays in Vercel/server env, never in git.

### Re-verify before coding

1. [Nhost protected routes](https://docs.nhost.io/getting-started/tutorials/nextjs/2-protected-routes/) — `createServerClient`, cookie flags, `proxy.ts`
2. [Nhost authentication](https://docs.nhost.io/getting-started/tutorials/nextjs/3-user-authentication)
3. [Nhost GraphQL tutorial](https://docs.nhost.io/getting-started/tutorials/nextjs/4-graphql-operations)
4. [Nhost Storage permissions](https://docs.nhost.io/products/storage/permissions/)
5. [Nhost CLI](https://docs.nhost.io/reference/cli/commands) — run `nhost --help` and `nhost dev hasura --help`
6. [shadcn.io Next.js install](https://www.shadcn.io/ui/installation/nextjs) and each component page in the Phase 1 allowlist
7. Next.js 16 `proxy.ts` docs
8. Nhost pricing/backups (Starter still no automated backups)

### Implementation steps (Phase 1)

1. `npx create-next-app` TypeScript, App Router, ESLint, Tailwind, no `src/` if possible.
2. `npx shadcn@latest init` then add allowlisted components via `https://www.shadcn.io/r/{name}.json`.
3. `nhost init` locally; Docker for `nhost up`.
4. Auth pages + proxy + Server Actions matching official Nhost Next.js recipe. Document cookie `httpOnly: false`.
5. Migrations for `profiles`, `user_preferences`, `privacy_acknowledgements`, `goals`, `goal_snapshots`, `integrations`, `audit_events` (minimal), Storage bucket `garmin-imports`.
6. Hasura metadata: track tables, relationships, **user** permissions, insert presets, update checks. `public` denied.
7. Storage permission metadata for `user` on `garmin-imports` (upload/download/replace/delete + uploader identity). No UI uploader required yet; foundation + tests.
8. Onboarding + settings profile/goals.
9. Authorization tests (A vs B vs anonymous) on tables that exist.
10. Vercel preview with env vars. No production “ready” claim.

### Phase 1 acceptance criteria

Functional:

- [ ] Sign up, email verification (PKCE), sign in, sign out, password reset work against local Nhost and the cloud preview.
- [ ] Unauthenticated users cannot open dashboard routes (`proxy.ts`).
- [ ] Onboarding collects privacy acknowledgement, timezone, units, and goals.
- [ ] Target pace is calculated from race distance and finish time (half marathon 21,097.5 m and 1:30 → ~4:16 min/km) and is editable.
- [ ] Authenticated user can view/update only their profile and goals.
- [ ] Swedish UI; English code.

Authorization (automated):

- [ ] User A reads/writes A's profile and goals.
- [ ] User A cannot select/insert-as/update/delete User B's profile or goals.
- [ ] Client-supplied `user_id` cannot create rows for B.
- [ ] `user_id` cannot be changed on update.
- [ ] Anonymous cannot read profile/goals.
- [ ] Nested GraphQL (if any relationship exists in Phase 1) cannot return B's data.
- [ ] User A cannot list/download/replace/delete B's files in `garmin-imports` (seed a file as B in tests).
- [ ] User A can upload and then select metadata for A's own file (even if the import UI is a stub/test helper).
- [ ] Admin secret is not present in the client bundle (`next build` grep / env split).

Engineering:

- [ ] `nhost.toml`, migrations, and metadata rebuild a clean local stack.
- [ ] Package versions pinned; lockfile committed.
- [ ] `npm run format` (or project equivalent), lint, `tsc --noEmit`, unit + authorization tests, `next build` succeed.
- [ ] Loading/empty/error/success states on auth and onboarding.
- [ ] No Garmin OAuth UI.
- [ ] No paid Nhost resources enabled.

Security notes to report at Phase 1 close: cookie HttpOnly trade-off, Starter pause behaviour, no automated backups.

### Phase 1 non-goals

Garmin parsing, dashboards of activities, AI, recommendations, account deletion job, Pro plan.

---

## Phase 2 — Import (complete in repo; live Storage/GraphQL tests skip without env)

Private upload UI, magic-byte detection, checksum, FIT/TCX/GPX/CSV/ZIP, preview, confirm, duplicates, history, bounded resumable slices on Vercel. Authorization tests for import tables and files. See [data-import-strategy.md](data-import-strategy.md).

In the repository: browser uploads go directly to `garmin-imports`; `POST /api/imports/[id]/process` parses one file or ZIP entry per request; confirm copies preview rows to canonical tables; Garmin API adapter is a typed stub only. FIT SDK `@garmin/fitsdk` 21.213.0 (Garmin FIT Protocol License).

## Phase 3 — Training dashboards (complete in repo)

Running, recovery, body, goal progress, 7/28/90-day trends, completeness, tested formulas. shadcn.io Chart, Tabs, Tooltip, Empty. No nutrition/strength logging and no recommendations engine.

## Phase 4 — Logging (complete in repo)

Nutrition, hydration, manual weight, strength sessions and sets. AI estimator is a **disabled stub** (`lib/ai/nutrition`); no paid provider. shadcn.io Dialog, Switch, Slider.

## Phase 5 — Coaching and hardening (complete in repo)

Deterministic recommendations (`lib/recommendations`), weekly report (`/report`), bounded data export (`/settings/privacy`), account deletion with 7-day grace and `scripts/purge-deletion-requests.mjs`, [docs/operations.md](operations.md). **No external user launch** until the owner approves the operational plan.

## Phase 6 — GarminDB compatibility (implemented)

### Objective

Let users who already run [GarminDB](https://github.com/tcgoetz/GarminDB) on their own computer upload its `garmin.db` output and get sleep, resting heart rate, HRV, stress, body battery, steps, and weight into Formkurvan's canonical model — without Formkurvan ever touching a Garmin credential.

Full design: [garmindb-compatibility.md](garmindb-compatibility.md).

### Scope

| In                                                        | Out                                                               |
| --------------------------------------------------------- | ----------------------------------------------------------------- |
| `garmin.db` only, schema version pinned                   | `garmin_activities.db`, `garmin_monitoring.db`, summary databases |
| Content-based credential and shape rejection              | Any Garmin login, OAuth, or credential field                      |
| `sql.js` WASM read-only parsing with hard limits          | Native SQLite addons, Python worker, container, queue             |
| Quarantine bucket, preview, explicit confirm              | Automatic downloading from Garmin Connect                         |
| Cross-source duplicate detection against FIT-sourced data | Importing Garmin's derived rollups                                |
| Activities via existing FIT drag-and-drop                 | Activities from SQLite                                            |

### Decisions (resolved 18 August 2026)

Design approved, including the GPL-2.0 analysis. O-1 through O-5 in [garmindb-compatibility.md](garmindb-compatibility.md) §13 are answered: quarantine buckets approved, `garmin_activities.db` out of scope, GarminDB supported but not evangelised, `sql.js` accepted, unknown units refused rather than guessed.

### Phase 6 acceptance criteria

Functional:

- [x] A valid metric `garmin.db` previews expected daily health and body measurement rows, then commits on confirm.
- [x] A statute-units database converts to SI correctly (160 lb → 72.57 kg).
- [x] A database with no `attributes.measurement_system` is **refused**, with no partial import and no guessed units.
- [x] An unsupported schema version is refused with a clear Swedish message naming the supported version.
- [x] A ZIP containing exactly one valid `garmin.db` is accepted; a whole `HealthData` directory is rejected with specific guidance.
- [x] Provenance records schema version, table versions, measurement system, assumed timezone, and row counts.
- [x] Re-uploading identical bytes is a file-level duplicate no-op (existing `sha256` path).
- [x] Swedish UI; English code.
- [ ] The detected measurement system and assumed timezone are shown in the preview before confirm. _Computed and stored; not yet rendered on `/import/[id]`._
- [ ] Days that overlap existing FIT-sourced data are flagged and deselected by default.
- [ ] Partial failure in one table commits the rest and marks the import `partial`.

Security (automated):

- [x] `GarminConnectConfig.json` rejected standalone and inside an archive, even when a valid database sits beside it.
- [x] The same file renamed to an accepted name is still rejected — every probe reads bytes, never filenames.
- [x] JSON with a `credentials.user` key, JWT-shaped content, and `Bearer` tokens rejected.
- [x] Garmin identity files (`personal-information.json`, `social-profile.json`) rejected.
- [x] `garmindb.log`, Python tracebacks, and executables (PE, ELF, Mach-O, WASM, shebang) rejected.
- [x] Databases containing triggers or virtual tables rejected; an allowlisted name that resolves to a view is not read.
- [x] Oversized files rejected before reaching the parser; row and time ceilings enforced per table and per import.
- [x] Rejection messages carry a category code only — no credential value, key path, or file content.
- [x] Only allowlisted columns are read, verified against a database that also contains non-allowlisted ones.
- [x] `source_provenance` is server-written only; the metadata contract test proves a client cannot forge it.
- [ ] Tests 30–40 of [garmindb-compatibility.md](garmindb-compatibility.md) §10.4: written in `tests/authorization/live-graphql.test.ts`, but they skip until `NHOST_TEST_*` credentials are supplied.
- [ ] Symlink and `../` traversal rejection is implemented in `archive.ts` but not yet covered by a fixture test.
- [ ] Account deletion removes quarantine objects.

Engineering and licensing:

- [x] No GarminDB source code, vendored, adapted, or translated, anywhere in the tree.
- [x] `garmindb` is not a dependency in `package.json`, any image, script, or CI job.
- [x] `sql.js` pinned by exact version; WASM asset read from our own `node_modules`, never a CDN.
- [x] No Garmin network call is added; no Python worker, container, queue, or paid hosting.
- [x] Format, lint, `tsc --noEmit`, unit, authorization, and import-fixture suites pass; `next build` succeeds.
- [ ] Quarantine objects are deleted on rejection and on confirm; the 24 h sweep is tested.

### Remaining before Phase 6 can be called done

The parsing, rejection, and mapping layers are complete and tested. What is left is
flow work, not analysis:

1. **Quarantine graduation.** The bucket, its permissions, and its isolation tests exist, but uploads still land directly in `garmin-imports`. Route GarminDB uploads to `garmindb-quarantine`, move them across on confirm, and delete on rejection.
2. **Quarantine sweep.** A 24 h cleanup job plus account-deletion coverage for the new bucket.
3. **Preview disclosure.** Render the measurement system and assumed timezone on `/import/[id]`, so a wrong unit system is caught before commit rather than after.
4. **Cross-source overlap.** Flag days that already have FIT-sourced data and deselect them by default.
5. **Live authorization run.** Supply `NHOST_TEST_*` credentials and execute tests 30–40 against a real project.

### Phase 6 non-goals

Activity import from SQLite, monitoring tables, summary tables, automatic sync, FitBit/MS Health data, and any change to the official Garmin API stub.

---

## Phase 7 — Local garmin-connect automation (implemented)

A user-owned runner (`scripts/garmin-sync`) uses `python-garminconnect` on the user's machine and posts to `/api/ingest`. Garmin credentials never enter Formkurvan. First run stays on preview; later runs auto-commit when engine, library version, and script version match the last approved import.

In: PAT-authenticated ingest, JSON health payload, FIT upload for activities, body-measurement dedupe index.

Out: embedding Garmin login in the web app, unofficial credentials in Nhost, Apple Health, a native iOS app.

---

## Expected upgrade point (cost)

Do **not** upgrade without approval. The first likely paid step is **Nhost Pro from $25/month** when any of these is true:

- Real external users (need automated DB backups; Storage files still need a separate backup)
- Inactivity pause (7 days) is unacceptable
- Database or storage exceeds 1 GB
- Function timeout on Nhost must exceed 10 s **and** we choose Functions over Vercel workers
- Custom domain on Nhost ($10/project/month extra per pricing page)

Vercel Hobby is enough for early preview. Watch function GB-hours if import parsing is heavy.

Manual backup on Starter (Phase 5 drill, not Phase 1):

```bash
pg_dump "$DATABASE_URL" --format=custom --file=formkurvan-$(date -u +%Y%m%d).dump
# Storage: separate sync of garmin-imports objects; dump is not enough
```

Restore is destructive; practice on a throwaway project.

---

## Unresolved decisions (defaults already chosen)

See [product-spec.md](product-spec.md) §8. Owner should confirm especially:

1. Email+password (not magic-link-first)
2. Nhost region `eu-central-1`
3. 25 MB / 100 files ZIP bounds
4. Light mode only
5. AI remains off
6. Product display name Formkurvan

---

## Exactly one next phase

**Phase 7 — Local garmin-connect automation.** Implemented. Remaining: live Nhost migration apply, first-run confirm in the UI, and a machine that stays awake for the schedule.
