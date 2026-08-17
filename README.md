# Formkurvan

Premium, Apple-inspired half-marathon and health tracker. Multi-user. Isolated accounts. File-based Garmin import.

Swedish UI. English code. Current phase: **Phase 5 — coaching and hardening** (in the repository). External launch requires owner approval of [docs/operations.md](docs/operations.md).

## Run locally (app)

```bash
cp .env.example .env.local
# Fill NHOST_SUBDOMAIN / NHOST_REGION after creating a Starter project in eu-central-1
npm install
npm run dev
```

```bash
npm run format
npm run lint
npm run typecheck
npm run test
npm run build
npm run check:bundle
```

Authorization contract tests always run (they parse Hasura metadata YAML). Live GraphQL/Storage tests run only when `NHOST_TEST_GRAPHQL_URL`, `NHOST_TEST_USER_A_JWT`, and `NHOST_TEST_USER_B_JWT` are set.

## Nhost backend

Hand-written `nhost/` files (CLI/Docker were not available in the Phase 1 environment):

- `nhost/nhost.toml` — email+password, verification required, anonymous off, default role `user`, allowed `user`/`me`, locale `sv`, no OAuth/AI
- `nhost/migrations/` — profiles, preferences, privacy, goals, snapshots, integrations, audit, import/preview/canonical tables, nutrition/hydration/strength logging, recommendations/export/deletion, buckets `garmin-imports` and `user-exports`
- `nhost/metadata/` — `user` row ownership, insert presets, no `user_id` on update, `public` denied, Storage uploader identity
- `.secrets.example` — copy to `.secrets` (gitignored) for local CLI

Owner steps:

1. Install [Nhost CLI](https://docs.nhost.io/reference/cli) and Docker.
2. `cp .secrets.example .secrets`
3. `nhost up`
4. Create a cloud **Starter** project in `eu-central-1`. Do not upgrade to Pro.
5. Connect the GitHub repo to Nhost for migration/metadata deploys.
6. Create a Vercel Hobby project. Set `NHOST_SUBDOMAIN`, `NHOST_REGION`, `NEXT_PUBLIC_*` copies, and `NHOST_ADMIN_SECRET` as a **server** env var only.
7. Add the Vercel preview URL to Nhost Auth allowed redirect URLs.

Starter limits: pause after 7 days of inactivity, **no automated backups**, 1 GB database/storage.

## Security notes (Phase 1–2)

- Official Nhost Next.js session cookie is **not HttpOnly** (`httpOnly: false`). XSS can steal the session. PKCE verifier cookie **is** HttpOnly.
- User CRUD uses the user JWT. Admin secret is not used for profile/goals/imports and must not appear in the client bundle.
- No Garmin OAuth. Files upload from the browser to Storage (`garmin-imports`); Vercel processes one bounded slice at a time.
- `@garmin/fitsdk` 21.213.0 is used under the Garmin FIT Protocol License for internal product parsing. Do not treat that as a Garmin Connect API.

## Specs

| Document                                                           | Purpose                                                 |
| ------------------------------------------------------------------ | ------------------------------------------------------- |
| [docs/product-spec.md](docs/product-spec.md)                       | Product vision, principles, and decisions               |
| [docs/mvp-scope.md](docs/mvp-scope.md)                             | In-scope / out-of-scope for the MVP                     |
| [docs/user-flows.md](docs/user-flows.md)                           | End-to-end user flows                                   |
| [docs/data-import-strategy.md](docs/data-import-strategy.md)       | Garmin file import, limits, and resumable processing    |
| [docs/database-schema.md](docs/database-schema.md)                 | PostgreSQL model, constraints, and retention            |
| [docs/security-model.md](docs/security-model.md)                   | Auth, Hasura, Storage, and authorization tests          |
| [docs/ai-nutrition-estimation.md](docs/ai-nutrition-estimation.md) | Opt-in calorie estimation design (no paid provider yet) |
| [docs/app-architecture.md](docs/app-architecture.md)               | Next.js, Nhost, and repository layout                   |
| [docs/design-system.md](docs/design-system.md)                     | shadcn.io design system and component sources           |
| [docs/implementation-plan.md](docs/implementation-plan.md)         | Phased plan                                             |
| [docs/operations.md](docs/operations.md)                           | Backup drill, deletion purge, monitoring, launch gate   |

## MVP complete (private)

Phase 5 adds deterministic recommendations, weekly report (`/report`), data export, account deletion with 7-day grace, and operational notes. Run `node scripts/purge-deletion-requests.mjs` on a schedule with admin secrets.
