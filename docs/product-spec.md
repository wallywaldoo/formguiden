# Product specification

**Product name:** Formkurvan  
**Phase:** 0 — specification only  
**Status:** Awaiting approval before Phase 1  
**Language:** Swedish in the product UI. English in all code, filenames, database objects, types, comments, tests, and technical conventions.

## 1. Vision

Formkurvan is a premium, Apple-inspired, simple, and data-driven web application that helps runners understand their own health and training data.

It helps each user:

- Import and understand Garmin health and activity data through official user-exported files.
- Track running, recovery, body metrics, nutrition, hydration, and strength training.
- Set personal goals such as race time, race date, target weight, and weekly training volume.
- See which factors may be helping or limiting progress.
- Receive transparent, non-medical recommendations based on their own data.

This is a real multi-user product. Every user has an isolated account and must never be able to access another user's health data, imports, files, goals, or recommendations.

## 2. Reference user

The initial reference user wants to run a half marathon in **1:30**, corresponding to approximately **4:16 min/km**.

That reference is a default, not a product constraint. Every user must be able to configure:

- Race type and distance
- Race date
- Target finish time
- Target pace (derived from distance and finish time, editable)
- Target body weight
- Weekly running volume
- Weekly strength-training volume

Default race distance for a new half-marathon goal: **21,097.5 m** (World Athletics half of the marathon distance 42,195 m).

Default target for the reference onboarding sample (clearly labelled as a sample, not stored until confirmed):

- Distance: 21,097.5 m
- Finish time: 01:30:00 (5,400 s)
- Derived pace: 5,400 / 21.0975 ≈ 255.95 s/km ≈ **4:16 min/km**

## 3. Product principles

1. **Own your data.** The user imports files they exported. The product never asks for Garmin passwords and never pretends to be an official Garmin OAuth client.
2. **Isolation by default.** Health data is sensitive. Ownership is derived from the verified Nhost access token, never from a client-supplied `user_id`.
3. **Transparent analytics.** Every calculated value has a formula, a unit, missing-data behaviour, tests, and a display explanation. No unexplained scores.
4. **No medical claims.** Recommendations are training and lifestyle observations, not diagnoses, treatment, injury assessment, or prescriptive medical advice.
5. **No false precision.** Missing Garmin metrics are shown as missing. AI nutrition values are estimates. Vague portions produce stated assumptions, not invented grams.
6. **One primary action per screen.** The interface is calm, sparse, and mobile-first, with an excellent desktop dashboard.
7. **Deterministic first.** Coaching starts as testable rules. AI is opt-in, narrowly scoped, and server-only.
8. **Honest operations.** The free Nhost project is acceptable for private development, not a production resilience plan. Real external users require an approved backup, restore, monitoring, privacy, retention, deletion, and incident-response plan.

## 4. Non-goals for the MVP

- Official Garmin Connect Developer Program / Garmin Health API integration
- Scraping Garmin Connect or using unofficial Garmin authentication libraries
- A misleading “Connect Garmin” OAuth button
- Food-photo analysis
- Social features, clubs, leaderboards, or sharing another user's data
- Wearable vendors other than Garmin file import (adapter interface is prepared)
- Native iOS/Android apps
- Medical device claims, CE marking, or clinical decision support
- Paid AI providers, paid queues, Nhost Pro, custom domains, or Nhost Run until explicitly approved
- Onboarding real external users before operational approval

## 5. Success criteria for the private MVP

A single authenticated user can:

1. Create an isolated account, complete onboarding, and set personal goals.
2. Upload Garmin-exported FIT, TCX, GPX, CSV, or ZIP files into a private bucket.
3. Preview parsed data, confirm import, and see duplicates rejected.
4. View running, recovery, body, nutrition, hydration, and strength data they logged or imported.
5. See deterministic recommendations with signals, comparison period, completeness, confidence, and a safety disclaimer.
6. Export their data and delete their account.

A second user must be unable to read, write, list, or delete the first user's records or files. Automated authorization tests prove this.

## 6. Legal and privacy posture

Formkurvan processes special-category health data. Until a documented privacy program is approved:

- Development uses the owner's own data or synthetic fixtures only.
- The Nhost Starter project is treated as a development backend, not production.
- The product copy must not claim HIPAA, medical-device status, or “production-ready backups”.
- Nhost is a data processor. A signed Nhost DPA is required before external users: [https://nhost.io/legal/data-processing-agreement](https://nhost.io/legal/data-processing-agreement)
- Privacy hints and subprocessors: [https://nhost.io/legal/privacy-hints](https://nhost.io/legal/privacy-hints)
- Nhost security overview (AES-256 at rest, TLS in transit; HIPAA “coming soon”, not available): [https://nhost.io/security](https://nhost.io/security)

Default region for the Nhost project: **`eu-central-1`** (EU data residency for Swedish users). Confirm the exact region list in the Nhost dashboard at project creation. This is a default, not a paid add-on.

## 7. Verified platform facts (Phase 0)

Inspected on 17 August 2026. Re-verify at the start of each later phase.

| Topic            | Finding                                                                                                                                                        | Source                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Next.js          | Nhost's current tutorial scaffolds **Next.js 16**, App Router, TypeScript, Node.js 22+. Route protection uses **`proxy.ts`**, not `middleware.ts`.             | [Protected routes](https://docs.nhost.io/getting-started/tutorials/nextjs/2-protected-routes/)      |
| Nhost SDK        | Official package is `@nhost/nhost-js` with `createServerClient` and cookie session storage.                                                                    | Same tutorial                                                                                       |
| Session cookie   | Official example sets `httpOnly: false` so the client can read the session. Secure and SameSite=lax are used. This is a documented XSS implication.            | Same tutorial                                                                                       |
| Auth flow        | Sign up / sign in via Server Actions; email verification via PKCE in a Route Handler; sign out via Server Action.                                              | [User authentication](https://docs.nhost.io/getting-started/tutorials/nextjs/3-user-authentication) |
| GraphQL          | Server Components fetch; Server Actions mutate; `user_id` insert preset from `X-Hasura-User-Id`.                                                               | [GraphQL operations](https://docs.nhost.io/getting-started/tutorials/nextjs/4-graphql-operations)   |
| Storage          | Private bucket + uploader identity + `uploaded_by_user_id = X-Hasura-User-Id`. Zero-trust default.                                                             | [Storage permissions](https://docs.nhost.io/products/storage/permissions/)                          |
| Functions        | Starter timeout **10 s**. Request/response **6 MB**. JavaScript/TypeScript only; **no native addons**.                                                         | [Function limits](https://docs.nhost.io/products/functions/limits)                                  |
| Nhost Starter    | $0. 1 active project. **Paused after 1 week of inactivity.** 1 GB database, 1 GB storage, 5 GB egress. **No automated backups.**                               | [Pricing](https://nhost.io/pricing), [Backups](https://docs.nhost.io/products/database/backups)     |
| Nhost Pro        | From **$25/month**. Automated backups, 10 GB DB, 50 GB storage, function timeout 180 s.                                                                        | [Pricing](https://nhost.io/pricing)                                                                 |
| Vercel functions | Hobby with Fluid compute: default/max duration **300 s**.                                                                                                      | [Vercel duration](https://vercel.com/docs/functions/configuring-functions/duration)                 |
| UI source        | **https://www.shadcn.io** registry. Install with `npx shadcn@latest add https://www.shadcn.io/r/{name}.json`. Do not use ui.shadcn.com as the source of truth. | [Next.js install](https://www.shadcn.io/ui/installation/nextjs)                                     |
| CLI              | `nhost init`, `nhost up`, `nhost down`, `nhost config apply`, `nhost dev hasura`.                                                                              | [CLI reference](https://docs.nhost.io/reference/cli/commands)                                       |

## 8. Defaults for unresolved product decisions

These defaults do not change the architecture. They can be revisited without a redesign.

| Decision               | Default                                                                                         | Why                                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Display name           | Formkurvan                                                                                      | Repository name; Swedish, distinctive, not a medical claim                                                                                |
| UI locale              | Swedish (`sv-SE`)                                                                               | Owner and reference user                                                                                                                  |
| Code locale            | English                                                                                         | Required technical convention                                                                                                             |
| Auth method            | Email + password, email verification, password reset                                            | Matches the current official Nhost Next.js tutorial. Magic link remains a supported Nhost method and can be added without schema changes. |
| Units                  | Metric stored. Display follows `user_preferences`.                                              | Canonical units are SI-like as specified                                                                                                  |
| Timezone               | IANA, default `Europe/Stockholm` until the user sets one                                        | Reference user                                                                                                                            |
| Week start             | Monday                                                                                          | ISO-8601, Sweden                                                                                                                          |
| Goal model             | One **active** goal set per user; historical rows in `goal_snapshots`                           | Simpler MVP than concurrent race goals                                                                                                    |
| Strength logging       | Session + sets. No exercise library in MVP; free-text exercise name with optional later catalog | Keeps onboarding light                                                                                                                    |
| Nutrition              | Manual text + optional macros. No food database in MVP                                          | Matches the product brief                                                                                                                 |
| AI provider            | **None until approved**                                                                         | Cost and vendor lock-in                                                                                                                   |
| Import processing host | Vercel Route Handlers, not Nhost Functions, for parse jobs                                      | 300 s vs 10 s; see [data-import-strategy.md](data-import-strategy.md)                                                                     |
| File size cap (MVP)    | 25 MB per uploaded file; 100 files / 200 MB uncompressed per ZIP                                | Fits Starter storage and serverless memory                                                                                                |
| Retention              | Keep until the user deletes. No silent expiry in MVP                                            | Health history is the product                                                                                                             |
| Account deletion       | Soft-delete 7-day grace, then hard-delete DB rows and Storage files                             | Accidental-delete protection                                                                                                              |
| Charts                 | shadcn.io Chart (Recharts) in Phase 3                                                           | Official shadcn.io primitive                                                                                                              |

## 9. Related documents

- [mvp-scope.md](mvp-scope.md)
- [user-flows.md](user-flows.md)
- [data-import-strategy.md](data-import-strategy.md)
- [database-schema.md](database-schema.md)
- [security-model.md](security-model.md)
- [ai-nutrition-estimation.md](ai-nutrition-estimation.md)
- [app-architecture.md](app-architecture.md)
- [design-system.md](design-system.md)
- [implementation-plan.md](implementation-plan.md)
