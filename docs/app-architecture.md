# Application architecture

## 1. Stack (locked)

| Layer      | Choice                                            | Why                               |
| ---------- | ------------------------------------------------- | --------------------------------- |
| UI         | React + Next.js App Router                        | Required; Server Components first |
| Language   | TypeScript **strict**                             | Required                          |
| Styling    | Tailwind CSS as required by shadcn.io             | Required                          |
| Components | **https://www.shadcn.io** only                    | Required; no other component kit  |
| Validation | Zod                                               | Required                          |
| Backend    | Nhost: Postgres, Auth, Storage, Functions, Hasura | Required                          |
| Hosting    | Vercel                                            | Required                          |
| Auth SDK   | `@nhost/nhost-js`                                 | Current official JS SDK           |

Do not introduce another UI system. Low-level packages required by a chosen shadcn.io primitive are allowed if listed in [design-system.md](design-system.md).

## 2. Repository layout

```
app/
  (auth)/
    login/
    signup/
    forgot-password/
    callback/
  (dashboard)/
    overview/
    running/
    recovery/
    nutrition/
    strength/
    goals/
    import/
    settings/
      profile/
      privacy/
      integrations/
  onboarding/
  layout.tsx
  globals.css
proxy.ts
components/
  ui/                 # shadcn.io copies only
  dashboard/
  charts/
  forms/
  navigation/
features/
  auth/
  profiles/
  goals/
  activities/
  health/
  nutrition/
  hydration/
  strength/
  recommendations/
  imports/
lib/
  nhost/
    server.ts
    client.ts         # only if a Client Component must call Nhost
  graphql/
    queries/
    mutations/
  import/
    adapters/
    fit/
    tcx/
    gpx/
    csv/
    zip/
    garmindb/         # GarminDB garmin.db adapter
    credentials/      # content-based credential rejection
  analytics/
  ai/
  validation/
  units/
nhost/
  migrations/
  metadata/
  seeds/
  nhost.toml
functions/            # avoid for Garmin parse on Starter; keep empty unless a tiny webhook is approved
graphql/
  generated/
tests/
  unit/
  integration/
  authorization/
  import-fixtures/
docs/
```

Prefer **no `src/` directory** so `app/` matches the suggested structure. If `create-next-app` defaults to `src/`, either disable `src/` or keep Nhost's tutorial path (`src/app`) consistently. **Default: no `src/`**, `proxy.ts` at repo root beside `app/`.

## 3. Rendering model

| Use Server Components             | Use Client Components                                                       |
| --------------------------------- | --------------------------------------------------------------------------- |
| Dashboards, lists, settings reads | Forms, file picker, import progress polling, toasts, charts that need hover |
| Auth-aware navigation             | Sign-out button (calls Server Action)                                       |

Data fetching: `createNhostClient()` + `nhost.graphql.request` in Server Components (official pattern).

Mutations: Server Actions that use the same client. Do not expose Hasura from the browser for writes if we can avoid it; if a Client Component must mutate, it still uses the user session cookie and never the admin secret.

## 4. Environment variables

Public (browser-safe):

- `NEXT_PUBLIC_NHOST_SUBDOMAIN`
- `NEXT_PUBLIC_NHOST_REGION`

Server:

- `NHOST_SUBDOMAIN` / `NHOST_REGION` (as in the official tutorial)
- `NHOST_ADMIN_SECRET` — **server/CLI only**, unused by user CRUD
- `DATABASE_URL` — backup scripts only
- AI keys — Phase 4+ if approved

Never commit `.env.local`. Provide `.env.example` with empty values.

## 5. GraphQL

- Hand-written operations in `lib/graphql` for Phase 1.
- Optional codegen (`graphql-codegen`) in Phase 1 if it reduces error risk. Additional dependency justification: type-safe operations against Hasura schema. Pin versions.

Do not enable Hasura subscriptions in MVP (realtime is extra moving parts for health data).

## 6. Nhost local workflow

Verified CLI: [https://docs.nhost.io/reference/cli/commands](https://docs.nhost.io/reference/cli/commands)

```text
nhost login
nhost init
nhost up
nhost down
nhost config validate
nhost config apply          # cloud, after approval
nhost dev hasura            # Hasura CLI wrapper for migrate/metadata
```

Discover exact Hasura subcommands with `nhost dev hasura --help` in Phase 1. Do not guess.

Migrations live in `nhost/migrations`. Metadata in `nhost/metadata`. Seeds in `nhost/seeds`.

## 7. Deployment

- **Vercel** project from this GitHub repo.
- Preview deployments for branches.
- Production env: Nhost cloud subdomain/region + secrets.
- Do not attach custom domains without approval (`$10/project/month` on Nhost pricing for custom domains).

Nhost GitHub integration can deploy migrations/metadata to the Nhost project. Configure in Phase 1 after the owner creates the Nhost project.

## 8. Import processing placement

See [data-import-strategy.md](data-import-strategy.md).

| Job                 | Where                                         |
| ------------------- | --------------------------------------------- |
| Upload bytes        | Browser → Nhost Storage (user JWT)            |
| Create import rows  | Next.js Server Action                         |
| Parse slices        | Next.js Route Handler, user JWT, bounded time |
| Dashboard analytics | TypeScript in `lib/analytics`, unit-tested    |

Nhost Functions stay unused for parsing on Starter (10 s, 6 MB, no native addons).

### 8.1 GarminDB compatibility (Phase 6)

Design: [garmindb-compatibility.md](garmindb-compatibility.md). No code until the owner approves.

GarminDB runs on the user's computer and is outside the trust boundary. Formkurvan reads one of its output files and nothing else.

| Job                        | Where                                                                |
| -------------------------- | -------------------------------------------------------------------- |
| Run GarminDB               | **User's own machine.** Never our infrastructure                     |
| Upload `garmin.db`         | Browser → `garmindb-quarantine` (user JWT)                           |
| Credential + shape scan    | Server, before parsing and before durable persistence                |
| Parse SQLite               | `lib/import/garmindb` via `sql.js` (WASM), read-only, bounded        |
| Promote to durable storage | Server, on user confirm: copy to `garmin-imports`, delete quarantine |

The "no native addons" constraint that rules out Nhost Functions also rules out `better-sqlite3`. WASM keeps the parser portable and memory-isolated.

Explicitly not added: Python worker, container service, queue, paid hosting, GarminDB as a dependency, or any Garmin network call.

## 9. Analytics engine

`lib/analytics` implements documented formulas with:

- Unit
- Missing-data behaviour
- Unit tests
- Display explanation keys

No opaque “readiness score” in MVP.

Initial formulas (Phase 3):

| Metric                    | Formula (summary)                                                                           | Missing data                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Weekly run distance       | Sum `distance_m` for activities `activity_type` in run family with `started_at` in ISO week | Treat missing distance as exclude activity from sum; show completeness |
| Rolling 7/28/90d distance | Sum last N local days                                                                       | Same                                                                   |
| Long-run consistency      | Count of runs ≥ 0.3 × weekly target distance per week over 4 weeks                          | Insufficient weeks → low completeness                                  |
| Intensity distribution    | Buckets by % of target pace or HR zones if HR present                                       | If no HR and no pace, skip                                             |
| Pace trend                | Median avg_pace of easy/long runs per week                                                  | Null pace excluded                                                     |
| HRV baseline              | Median `hrv_rmssd_ms` last 28 days with ≥ 14 points                                         | Else incomplete                                                        |
| RHR baseline              | Median resting HR last 28 days                                                              | Same                                                                   |
| Sleep duration            | Mean `sleep_duration_s` last 7 days                                                         | Null nights excluded; completeness = nights with data / 7              |
| Sleep consistency         | Std dev of sleep start clock time                                                           | Need ≥ 5 nights                                                        |
| Body-weight trend         | Linear slope of `mass_kg` last 28 days                                                      | Need ≥ 4 points                                                        |
| Strength frequency        | Sessions last 7 local days vs weekly target (`weekly_strength_sessions`)                    | No target → completeness 1 only if at least one session                |
| Goal-pace gap             | Latest representative run pace − target_pace                                                | No recent run → empty                                                  |
| Data completeness         | Weighted fraction of expected series present                                                | Always shown                                                           |

Exact constants and tests live in `lib/analytics` and `tests/unit/analytics.test.ts`.

## 10. Testing layout

| Suite         | Tool (default)       | Purpose                        |
| ------------- | -------------------- | ------------------------------ |
| Unit          | Vitest               | analytics, units, parsers, Zod |
| Integration   | Vitest + local Nhost | GraphQL CRUD as user           |
| Authorization | Vitest + two users   | Section 10 of security model   |
| Build         | `next build`         | Phase gate                     |

Pin `vitest` because Next.js does not include an assertion runner. Alternative: Node test runner. Default: Vitest for DX. Justify at install time.

Playwright is optional for Phase 5 smoke tests; not required in Phase 1.

## 11. Additional dependencies (expected)

Only install when a phase needs them. Each must be justified:

| Package                                                                | Phase | Why                                                                 |
| ---------------------------------------------------------------------- | ----- | ------------------------------------------------------------------- |
| `@nhost/nhost-js`                                                      | 1     | Official Auth/GraphQL/Storage SDK                                   |
| `zod`                                                                  | 1     | Required validation                                                 |
| `class-variance-authority`, `clsx`, `tailwind-merge`                   | 1     | Required by shadcn.io `cn` helper                                   |
| `lucide-react`                                                         | 1     | Icons used by shadcn.io primitives                                  |
| `radix-ui` (or per-component radix packages as the registry specifies) | 1     | shadcn.io primitive behaviour/a11y                                  |
| `react-hook-form`, `@hookform/resolvers`                               | 1     | shadcn.io Form                                                      |
| `sonner`                                                               | 1     | shadcn.io toasts                                                    |
| `next-themes`                                                          | 1     | Only if the installed shadcn preset requires it; skip if not        |
| `@garmin/fitsdk`                                                       | 2     | FIT parse, no native addon                                          |
| `fflate`                                                               | 2     | ZIP inflate in pure JS                                              |
| `@xmldom/xmldom`                                                       | 2     | TCX/GPX XML without browser `DOMParser` in Node                     |
| `recharts`                                                             | 3     | shadcn.io Chart                                                     |
| AI vendor SDK                                                          | 4     | Only after approval                                                 |
| `sql.js`                                                               | 6     | Read untrusted SQLite in WASM; no native addon. Only after approval |

`garmindb` itself is **never** a dependency — not in `package.json`, a container image, a script, or CI. See [garmindb-compatibility.md](garmindb-compatibility.md) §9 for the GPL-2.0 reasoning.

Pin versions and commit the lockfile (`package-lock.json` or `pnpm-lock.yaml`). Default package manager: **npm** to match Nhost tutorials unless the owner prefers pnpm.

## 12. Error handling for paused Nhost

Wrap server GraphQL/Storage calls. If the backend is unreachable, render a Swedish maintenance message. Do not dump Hasura errors to the client in production.
