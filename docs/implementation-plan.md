# Implementation plan

Work in small phases. Do not implement all phases at once. **Stop after each phase until the owner approves the next.**

## Current repository state (17 August 2026)

Phase 5 coaching and hardening is in the repository: deterministic recommendations, weekly report, data export, account deletion with grace period, and [operations.md](operations.md). Phase 4 logging (nutrition, hydration, strength) and the disabled AI stub remain unchanged. Local `nhost up` and a live Vercel preview still require Docker + Nhost CLI and owner-created cloud projects. Starter still pauses after 7 days and has no automated backups.

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

**Phase 5 — Coaching and hardening:** deterministic recommendations, weekly report, export, account deletion, manual backup/restore drill, monitoring notes. No external user launch until the owner approves the operational plan.

Wait for explicit approval before starting Phase 5.
