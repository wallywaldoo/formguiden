# User flows

UI copy is Swedish. Flow names and technical identifiers are English.

All authenticated flows assume Nhost session refresh in `proxy.ts` and Hasura/Storage authorization using `X-Hasura-User-Id` from the verified JWT. Identity is never taken from the form payload.

## 1. Actors

| Actor                                | Access                                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Anonymous                            | Marketing/home, login, signup, forgot-password, email callback                                                 |
| Authenticated, onboarding incomplete | Only onboarding and sign out                                                                                   |
| Authenticated, onboarded             | Full app for **their** rows and files                                                                          |
| System (server)                      | Privileged operations only with the user's token, or narrowly scoped admin-secret jobs that re-check ownership |

There is no coach, admin-in-app, or family-sharing role in the MVP.

## 2. Authentication

### 2.1 Sign up

1. User opens `/signup`.
2. Submits email + password (Zod-validated; password rules from Nhost project config).
3. Server Action calls Nhost sign-up and stores the PKCE verifier in a cookie (official pattern).
4. User sees “check your email”.
5. User clicks the verification link.
6. `/callback` (or `/verify`) Route Handler exchanges `code` + verifier via `nhost.auth.tokenExchange`.
7. Session cookie is set. Redirect to onboarding.

Failure states: invalid email, weak password, already registered, missing code, missing PKCE verifier (different browser), expired link.

### 2.2 Sign in

1. User opens `/login`.
2. Server Action signs in with email and password.
3. Session cookie is set.
4. If onboarding incomplete → `/onboarding`. Else → `/overview`.

### 2.3 Password reset

1. User opens `/forgot-password` and submits email.
2. Server Action requests Nhost password reset. Always show a generic success message (no account enumeration).
3. User opens email link → set new password → sign in.

Magic link is **not** the default MVP path. Nhost supports it; adding it later does not change the data model.

### 2.4 Sign out

Client button → Server Action `signOut` → clear session cookie → `/login`.

### 2.5 Session expiry and paused backend

- Access token refresh happens in the proxy when expiry is within 60 seconds (official Nhost helper).
- If Nhost Starter is paused after 7 days of inactivity, the user sees a clear “service temporarily unavailable” state, not a generic GraphQL dump.

## 3. Onboarding

Gate: authenticated, `profiles.onboarding_completed_at` is null.

Steps (one primary action each):

1. **Privacy** — acknowledge that this is not medical advice; health data is private to this account; Garmin files are user-exported.
2. **Profile** — display name, timezone, distance/weight/temperature display units.
3. **Goals** — race type, date, finish time; show derived pace; weekly running and strength; optional target weight.
4. **Done** — enter `/overview`. Empty dashboard with one CTA: “Importera Garmin-fil”.

The user can skip optional fields. Race date and finish time are required to compute pace; if finish time is omitted, pace stays empty.

## 4. Dashboard (overview)

On load (Server Component):

1. Load profile, active goal, last 90 days of activities and daily health metrics, recent imports, latest recommendation.
2. Compute today's status, completeness, trends (documented formulas).
3. Render one primary action (from recommendations if any, else the highest-value empty-state CTA).

Quick actions open compact sheets/dialogs for food, hydration, weight, strength.

## 5. Garmin import

See [data-import-strategy.md](data-import-strategy.md) for processing. User-visible flow:

1. User opens `/import`.
2. Reads short instructions: export from Garmin Connect (activity gear menu: Original/FIT, TCX, GPX; or a ZIP of those files). No “Connect Garmin” button.
3. Selects files (client validates extension **as a hint only**).
4. Files upload **directly to Nhost Storage** bucket `garmin-imports` with the user session. The app does not trust client `user_id` or `uploaded_by_user_id`.
5. Server creates `data_imports` + `import_files` rows from Storage metadata after verifying `uploaded_by_user_id` matches the session user.
6. Server computes SHA-256, magic-byte type, size. Duplicates (`user_id` + checksum) are marked and not re-parsed as new activities.
7. A bounded worker parses into **preview** tables. Status polling on the import page.
8. User reviews preview: activities, health days, warnings, partial failures.
9. User confirms. Server copies preview → canonical tables in a transaction scoped to that import and user.
10. Import history shows status, file count, inserted/skipped/failed, and timestamps.

The user can abandon a preview. Unconfirmed preview rows expire (default 7 days) and are deleted; original files remain until the user deletes the import or the account.

## 6. Running, recovery, body

- **Running** list and detail from `activities` / `activity_laps`. Notes are editable by the owner.
- **Recovery** from `daily_health_metrics` (and sleep fields when present).
- **Body** from `body_measurements` plus goal target weight.

Empty states explain which Garmin export usually contains the metric (FIT wellness vs activity FIT vs CSV).

## 7. Nutrition

1. User taps “Logga mat”.
2. Enters description, meal type, time.
3. Optionally enters calories/macros.
4. Optionally taps “Uppskatta med AI” — **disabled until a provider is approved**. The button explains that estimation is optional and not nutrition advice.
5. If AI is enabled: server-only call with description + locale/unit context only. User edits values. Nothing is saved until confirm.
6. Provenance stored: `manual` | `ai_estimated` | `ai_estimated_edited`.

## 8. Hydration and strength

Hydration: volume (display ml or oz; store ml), beverage type, time, optional caffeine mg, notes.

Strength: create session → add sets. Autosave per session after first successful insert. Delete set/session with confirm.

## 9. Recommendations

Generated on a schedule (daily, user timezone) and on-demand refresh.

User sees a card:

- Recommended action
- Signals
- Comparison period
- Completeness
- Confidence
- Safety disclaimer

Tapping “Varför?” expands the rule id and formula names. No “the data proves X caused Y”.

## 10. Settings

- Profile and units
- Privacy text, export data, delete account
- Integrations: Garmin **file import instructions** only. Future official API is an adapter stub, hidden.

## 11. Export and deletion

**Export:** user requests export → server job (same bounded pattern as import) writes a ZIP of JSON/CSV of their rows. Download via short-lived authorized URL. Original Garmin files included if still in Storage.

**Delete account:**

1. Confirm with password or re-auth.
2. Soft-delete: session revoked, data hidden, grace period 7 days.
3. After grace: delete Storage objects, then user-owned rows, then `auth.users` via Nhost Auth (server-only).

## 12. Error and empty catalogue

Every flow must handle:

| State        | Example                                 |
| ------------ | --------------------------------------- |
| Loading      | Skeleton on overview                    |
| Empty        | No activities yet                       |
| Success      | Toast after save                        |
| Partial      | ZIP with 3 good FIT + 1 corrupt         |
| Error        | Validation, auth, paused Nhost, timeout |
| Duplicate    | Same checksum already imported          |
| Unauthorized | Direct GraphQL/Storage probe as user B  |
