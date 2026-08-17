# Database schema

All objects are specified in English. Schema changes ship only as Nhost/Hasura migrations plus version-controlled metadata. Dashboard-only permission clicks are not acceptable.

Canonical types: UUID PKs, `user_id uuid NOT NULL` on every user-owned table, `timestamptz` for events.

Identity: `user_id` always references `auth.users(id)` with `ON DELETE CASCADE` unless noted.

## 1. Conventions

| Rule             | Detail                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary keys     | `uuid DEFAULT gen_random_uuid()`                                                                                                                                          |
| Ownership        | `user_id uuid NOT NULL REFERENCES auth.users(id)`                                                                                                                         |
| Timestamps       | `created_at`, `updated_at timestamptz NOT NULL DEFAULT now()`                                                                                                             |
| Updates          | Trigger `set_updated_at()` on all mutable tables                                                                                                                          |
| Source           | `source text NOT NULL` with check: `garmin-file`, `garmin-api`, `manual`, `derived`, `system`                                                                             |
| Provider payload | Optional `provider_payload jsonb` **only** for non-analytical leftovers. Core filterable fields are real columns.                                                         |
| Units            | See product spec. CHECKs reject negative distances, durations, masses where physically impossible.                                                                        |
| Dedup            | Unique `(user_id, source, external_id)` where `external_id IS NOT NULL`. Unique checksums on import files.                                                                |
| GraphQL          | Track all public tables. No relationship from user A into user B. Permission filters on every table. Insert preset `user_id = X-Hasura-User-Id`. `user_id` not updatable. |

## 2. Entity relationship (logical)

```
auth.users
  ├── profiles (1:1)
  ├── user_preferences (1:1)
  ├── privacy_acknowledgements
  ├── goals (1:active via unique partial index)
  ├── goal_snapshots
  ├── integrations
  ├── data_imports
  │     ├── import_files → storage.files
  │     ├── import_jobs
  │     ├── activity_previews / daily_health_metric_previews / body_measurement_previews
  │     └── audit via audit_events
  ├── activities → activity_laps
  ├── daily_health_metrics
  ├── body_measurements
  ├── nutrition_entries → ai_estimation_requests
  ├── hydration_entries
  ├── strength_sessions → strength_sets
  ├── recommendations
  ├── data_export_jobs
  └── audit_events
```

## 3. Tables

### 3.1 `profiles`

| Column                  | Type                 | Notes                                                |
| ----------------------- | -------------------- | ---------------------------------------------------- |
| id                      | uuid PK              | Same as `user_id` (1:1). PK = `user_id`              |
| user_id                 | uuid UNIQUE NOT NULL | FK auth.users                                        |
| display_name            | text                 |                                                      |
| date_of_birth           | date                 | Optional; not required in MVP                        |
| sex_at_birth            | text                 | Optional; check `female/male/unspecified` if present |
| onboarding_completed_at | timestamptz          | Null until onboarding done                           |
| created_at, updated_at  | timestamptz          |                                                      |

Do not store medical diagnoses.

### 3.2 `user_preferences`

| Column                 | Type                 | Notes                            |
| ---------------------- | -------------------- | -------------------------------- |
| id                     | uuid PK              |                                  |
| user_id                | uuid UNIQUE NOT NULL |                                  |
| timezone               | text NOT NULL        | IANA, default `Europe/Stockholm` |
| locale                 | text NOT NULL        | Default `sv-SE`                  |
| week_starts_on         | smallint NOT NULL    | 1 = Monday                       |
| distance_unit          | text NOT NULL        | `km` \| `mi` display             |
| mass_unit              | text NOT NULL        | `kg` \| `lb` display             |
| elevation_unit         | text NOT NULL        | `m` \| `ft`                      |
| volume_unit            | text NOT NULL        | `ml` \| `floz`                   |
| temperature_unit       | text NOT NULL        | `c` \| `f`                       |
| created_at, updated_at | timestamptz          |                                  |

### 3.3 `privacy_acknowledgements`

| Column           | Type                 | Notes                                              |
| ---------------- | -------------------- | -------------------------------------------------- |
| id               | uuid PK              |                                                    |
| user_id          | uuid NOT NULL        |                                                    |
| document_version | text NOT NULL        | e.g. `mvp-2026-08-17`                              |
| acknowledged_at  | timestamptz NOT NULL |                                                    |
| ip_hash          | text                 | Optional SHA-256 of IP; no raw IP stored long term |

Unique `(user_id, document_version)`.

### 3.4 `goals`

| Column                     | Type             | Notes                                                      |
| -------------------------- | ---------------- | ---------------------------------------------------------- |
| id                         | uuid PK          |                                                            |
| user_id                    | uuid NOT NULL    |                                                            |
| status                     | text NOT NULL    | `active` \| `archived`                                     |
| race_type                  | text NOT NULL    | `5k` \| `10k` \| `half_marathon` \| `marathon` \| `custom` |
| race_distance_m            | numeric NOT NULL | CHECK > 0. Half marathon default 21097.5                   |
| race_date                  | date             |                                                            |
| target_duration_s          | integer          | CHECK > 0                                                  |
| target_pace_s_per_km       | numeric          | Derived; stored for stable display                         |
| target_mass_kg             | numeric          | CHECK > 0                                                  |
| weekly_run_distance_m      | numeric          |                                                            |
| weekly_run_duration_s      | integer          |                                                            |
| weekly_strength_sessions   | integer          |                                                            |
| weekly_strength_duration_s | integer          |                                                            |
| notes                      | text             |                                                            |
| created_at, updated_at     | timestamptz      |                                                            |

Partial unique index: one active goal per user:

```sql
CREATE UNIQUE INDEX goals_one_active_per_user
  ON goals (user_id)
  WHERE status = 'active';
```

Pace derivation (application + CHECK optional):

`target_pace_s_per_km = target_duration_s / (race_distance_m / 1000)` when both duration and distance are set.

### 3.5 `goal_snapshots`

Point-in-time copy when a goal changes or on a weekly job.

| Column          | Type                     | Notes                                        |
| --------------- | ------------------------ | -------------------------------------------- |
| id              | uuid PK                  |                                              |
| user_id         | uuid NOT NULL            |                                              |
| goal_id         | uuid NOT NULL FK goals   |                                              |
| captured_at     | timestamptz NOT NULL     |                                              |
| payload columns | same numeric goal fields | Denormalized copy, not JSON for core numbers |
| source          | text NOT NULL            | `user_edit` \| `weekly_job`                  |

### 3.6 `integrations`

| Column              | Type          | Notes                                        |
| ------------------- | ------------- | -------------------------------------------- |
| id                  | uuid PK       |                                              |
| user_id             | uuid NOT NULL |                                              |
| provider            | text NOT NULL | `garmin-file` \| `garmin-api`                |
| status              | text NOT NULL | `active` \| `disabled`                       |
| external_athlete_id | text          | Null for file-only                           |
| connected_at        | timestamptz   |                                              |
| metadata            | jsonb         | Non-secret only. **No OAuth tokens in MVP.** |

Unique `(user_id, provider)`.

When `garmin-api` exists in the future, tokens belong in a server-only secrets table **not** exposed to GraphQL.

### 3.7 `data_imports`

| Column                 | Type                       | Notes                                                                                                            |
| ---------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| id                     | uuid PK                    |                                                                                                                  |
| user_id                | uuid NOT NULL              |                                                                                                                  |
| provider               | text NOT NULL              |                                                                                                                  |
| status                 | text NOT NULL              | `uploaded` \| `queued` \| `processing` \| `preview_ready` \| `partial` \| `failed` \| `committed` \| `abandoned` |
| confirmed_at           | timestamptz                |                                                                                                                  |
| committed_at           | timestamptz                |                                                                                                                  |
| error_summary          | text                       | Safe, no secrets                                                                                                 |
| file_count             | integer NOT NULL DEFAULT 0 |                                                                                                                  |
| previewed_count        | integer NOT NULL DEFAULT 0 |                                                                                                                  |
| committed_count        | integer NOT NULL DEFAULT 0 |                                                                                                                  |
| failed_count           | integer NOT NULL DEFAULT 0 |                                                                                                                  |
| duplicate_count        | integer NOT NULL DEFAULT 0 |                                                                                                                  |
| created_at, updated_at | timestamptz                |                                                                                                                  |

### 3.8 `import_files`

| Column                 | Type                                       | Notes                                                                              |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------- |
| id                     | uuid PK                                    |                                                                                    |
| user_id                | uuid NOT NULL                              |                                                                                    |
| import_id              | uuid NOT NULL FK data_imports              |                                                                                    |
| storage_file_id        | uuid NOT NULL REFERENCES storage.files(id) |                                                                                    |
| original_filename      | text                                       | Display only; untrusted                                                            |
| declared_mime_type     | text                                       | Untrusted                                                                          |
| detected_kind          | text                                       | `fit` \| `tcx` \| `gpx` \| `csv` \| `zip` \| `unknown`                             |
| byte_size              | bigint NOT NULL                            |                                                                                    |
| sha256                 | text NOT NULL                              | Hex                                                                                |
| status                 | text NOT NULL                              | `pending` \| `processing` \| `previewed` \| `duplicate` \| `failed` \| `committed` |
| parent_file_id         | uuid                                       | Nested ZIP entry parent                                                            |
| zip_entry_path         | text                                       | Untrusted path, stored escaped                                                     |
| error_code             | text                                       |                                                                                    |
| error_message          | text                                       |                                                                                    |
| created_at, updated_at | timestamptz                                |                                                                                    |

Unique `(user_id, sha256)` for committed files. Preview of the same bytes on a second import is a duplicate.

Index `(user_id, import_id)`, `(storage_file_id)`.

### 3.9 `import_jobs`

Resumable slice processing.

| Column           | Type                       | Notes                                    |
| ---------------- | -------------------------- | ---------------------------------------- |
| id               | uuid PK                    |                                          |
| user_id          | uuid NOT NULL              |                                          |
| import_id        | uuid UNIQUE NOT NULL       |                                          |
| cursor           | jsonb NOT NULL             | `{ "file_id": "...", "entry_index": 0 }` |
| lease_expires_at | timestamptz                |                                          |
| heartbeat_at     | timestamptz                |                                          |
| attempt_count    | integer NOT NULL DEFAULT 0 |                                          |
| last_error       | text                       |                                          |

### 3.10 Preview tables

`activity_previews`, `activity_lap_previews`, `daily_health_metric_previews`, `body_measurement_previews`

Same analytical columns as canonical tables plus `import_id`, `import_file_id`, `expires_at`. Not used by dashboard queries.

### 3.11 `activities`

| Column                 | Type                 | Notes                                                                                       |
| ---------------------- | -------------------- | ------------------------------------------------------------------------------------------- |
| id                     | uuid PK              |                                                                                             |
| user_id                | uuid NOT NULL        |                                                                                             |
| import_id              | uuid                 | FK data_imports, null if manual                                                             |
| import_file_id         | uuid                 |                                                                                             |
| source                 | text NOT NULL        |                                                                                             |
| external_id            | text                 |                                                                                             |
| activity_type          | text NOT NULL        | `run` \| `trail_run` \| `treadmill` \| `walk` \| `hike` \| `cycle` \| `strength` \| `other` |
| started_at             | timestamptz NOT NULL |                                                                                             |
| ended_at               | timestamptz          |                                                                                             |
| duration_s             | integer              | Moving or elapsed; see `duration_kind`                                                      |
| duration_kind          | text                 | `elapsed` \| `moving` \| `unknown`                                                          |
| distance_m             | numeric              |                                                                                             |
| elevation_gain_m       | numeric              |                                                                                             |
| elevation_loss_m       | numeric              |                                                                                             |
| avg_pace_s_per_km      | numeric              | Derived                                                                                     |
| avg_heart_rate_bpm     | numeric              |                                                                                             |
| max_heart_rate_bpm     | numeric              |                                                                                             |
| avg_cadence            | numeric              |                                                                                             |
| calories_kcal          | numeric              |                                                                                             |
| training_load          | numeric              | Provider-specific; nullable; labelled in UI                                                 |
| perceived_effort       | numeric              | 1–10 if manual                                                                              |
| notes                  | text                 |                                                                                             |
| provider_payload       | jsonb                | Residual FIT fields only                                                                    |
| created_at, updated_at | timestamptz          |                                                                                             |

Unique `(user_id, source, external_id)` WHERE `external_id IS NOT NULL`.

Indexes: `(user_id, started_at DESC)`, `(user_id, activity_type, started_at DESC)`.

### 3.12 `activity_laps`

| Column             | Type                                          | Notes                                                   |
| ------------------ | --------------------------------------------- | ------------------------------------------------------- |
| id                 | uuid PK                                       |                                                         |
| user_id            | uuid NOT NULL                                 | Denormalized for Hasura row filters without join bypass |
| activity_id        | uuid NOT NULL FK activities ON DELETE CASCADE |                                                         |
| lap_index          | integer NOT NULL                              |                                                         |
| kind               | text NOT NULL                                 | `lap` \| `split`                                        |
| started_at         | timestamptz                                   |                                                         |
| duration_s         | integer                                       |                                                         |
| distance_m         | numeric                                       |                                                         |
| avg_pace_s_per_km  | numeric                                       |                                                         |
| avg_heart_rate_bpm | numeric                                       |                                                         |
| elevation_gain_m   | numeric                                       |                                                         |

Unique `(activity_id, kind, lap_index)`.

**Hasura:** select/update/delete where `user_id = X-Hasura-User-Id`. Relationship `activities` must also be permission-filtered (same user). Nested queries cannot walk to another user's activity.

### 3.13 `daily_health_metrics`

One row per user per calendar date in the user's timezone **or** UTC date with `local_date` stored explicitly.

| Column                 | Type          | Notes                             |
| ---------------------- | ------------- | --------------------------------- |
| id                     | uuid PK       |                                   |
| user_id                | uuid NOT NULL |                                   |
| local_date             | date NOT NULL |                                   |
| source                 | text NOT NULL |                                   |
| import_id              | uuid          |                                   |
| external_id            | text          |                                   |
| sleep_duration_s       | integer       |                                   |
| sleep_start_at         | timestamptz   |                                   |
| sleep_end_at           | timestamptz   |                                   |
| sleep_light_s          | integer       |                                   |
| sleep_deep_s           | integer       |                                   |
| sleep_rem_s            | integer       |                                   |
| sleep_awake_s          | integer       |                                   |
| hrv_rmssd_ms           | numeric       |                                   |
| resting_heart_rate_bpm | numeric       |                                   |
| stress_avg             | numeric       | Garmin scale if present; nullable |
| body_battery_high      | numeric       |                                   |
| body_battery_low       | numeric       |                                   |
| steps                  | integer       |                                   |
| respiration_avg_brpm   | numeric       |                                   |
| systolic_mmhg          | integer       |                                   |
| diastolic_mmhg         | integer       |                                   |
| provider_payload       | jsonb         |                                   |
| created_at, updated_at | timestamptz   |                                   |

Unique `(user_id, local_date, source)`. Merging multiple sources on the same day is application logic (prefer FIT wellness over CSV, never silently overwrite manual).

### 3.14 `body_measurements`

| Column         | Type                 | Notes                                |
| -------------- | -------------------- | ------------------------------------ |
| id             | uuid PK              |                                      |
| user_id        | uuid NOT NULL        |                                      |
| measured_at    | timestamptz NOT NULL |                                      |
| source         | text NOT NULL        |                                      |
| import_id      | uuid                 |                                      |
| external_id    | text                 |                                      |
| mass_kg        | numeric              |                                      |
| body_fat_pct   | numeric              | CHECK 0–100 if present               |
| waist_m        | numeric              | Store meters (e.g. 0.82); display cm |
| systolic_mmhg  | integer              |                                      |
| diastolic_mmhg | integer              |                                      |
| notes          | text                 |                                      |

Indexes: `(user_id, measured_at DESC)`.

### 3.15 `nutrition_entries`

| Column                   | Type                 | Notes                                                    |
| ------------------------ | -------------------- | -------------------------------------------------------- |
| id                       | uuid PK              |                                                          |
| user_id                  | uuid NOT NULL        |                                                          |
| eaten_at                 | timestamptz NOT NULL |                                                          |
| meal_type                | text NOT NULL        | `breakfast` \| `lunch` \| `dinner` \| `snack` \| `other` |
| description              | text NOT NULL        |                                                          |
| energy_kcal              | numeric              |                                                          |
| protein_g                | numeric              |                                                          |
| carbohydrate_g           | numeric              |                                                          |
| fat_g                    | numeric              |                                                          |
| fiber_g                  | numeric              |                                                          |
| provenance               | text NOT NULL        | `manual` \| `ai_estimated` \| `ai_estimated_edited`      |
| ai_estimation_request_id | uuid                 |                                                          |
| notes                    | text                 |                                                          |
| created_at, updated_at   | timestamptz          |                                                          |

No food photos in MVP.

### 3.16 `ai_estimation_requests`

| Column                  | Type          | Notes                                                  |
| ----------------------- | ------------- | ------------------------------------------------------ |
| id                      | uuid PK       |                                                        |
| user_id                 | uuid NOT NULL |                                                        |
| provider                | text NOT NULL | `none` \| `openai` \| `anthropic` \| `stub`            |
| model                   | text          |                                                        |
| status                  | text NOT NULL | `pending` \| `succeeded` \| `failed` \| `rate_limited` |
| prompt_description      | text NOT NULL | Food text only                                         |
| locale                  | text          |                                                        |
| response_energy_kcal    | numeric       |                                                        |
| response_protein_g      | numeric       |                                                        |
| response_carbohydrate_g | numeric       |                                                        |
| response_fat_g          | numeric       |                                                        |
| response_fiber_g        | numeric       |                                                        |
| assumptions             | text          |                                                        |
| confidence              | text          | `low` \| `medium` \| `high`                            |
| range_energy_kcal_min   | numeric       |                                                        |
| range_energy_kcal_max   | numeric       |                                                        |
| error_code              | text          |                                                        |
| duration_ms             | integer       |                                                        |
| created_at              | timestamptz   |                                                        |

Do **not** store raw provider API keys. Do **not** send or store unrelated health history. Optional: store a redacted provider request id for support, never the full prompt dump of other user fields.

GraphQL: user can select own rows; insert only via server (no client insert permission) so the client cannot spoof AI results. Server uses user JWT or a restricted mutation.

**Default permission:** `user` role **select** own rows; **no insert/update/delete** from the client. Server Action writes using the user's session (Hasura still sees `X-Hasura-User-Id`) via a dedicated `insert` permission that is only reachable if we lock columns — safer: **no insert for `user`**, server uses a Hasura action or forwards the user JWT to a mutation allowed for `user` with server-set columns.

Chosen default: `user` may **insert** only `prompt_description` (and meal context locale) with `user_id` preset; numeric response columns are **not** insertable by `user`. A Server Action using the admin secret would bypass RLS — **forbidden** for this table unless the operation independently verifies ownership. Prefer: Server Action calls the model, then inserts with the **user JWT** and column presets for estimates (Hasura `set` from server headers is not available). Practical pattern:

- Server Action uses `createNhostClient()` (user session) and a mutation that includes estimate columns **if** we trust the session. The client never gets the mutation; only the server action calls it. Column permissions still apply to the `user` role, so the browser GraphQL playground could call it.

**Hardening:** do not grant `user` insert on estimate result columns. Add a PostgreSQL function `submit_ai_nutrition_estimate(...)` `SECURITY INVOKER` that writes results, exposed as a Hasura mutation, with the function reading `current_setting('hasura.user.id')` / session variable. Alternatively keep insert on the table but **do not expose** the mutation in the user-facing GraphQL by using Hasura **allowed queries** (if available on plan) or by only inserting from a trusted server role that still sets `user_id` from the verified token after local JWT verification.

MVP default (Starter-compatible): Server Action verifies session, calls AI, inserts via GraphQL **as the user**. Authorization tests must include “browser cannot insert a fake high-confidence estimate for another user”. Accept that the user can insert their own spoofed estimates — that only affects their data. They cannot insert for another `user_id`.

### 3.17 `hydration_entries`

| Column        | Type                       | Notes                                                    |
| ------------- | -------------------------- | -------------------------------------------------------- |
| id            | uuid PK                    |                                                          |
| user_id       | uuid NOT NULL              |                                                          |
| consumed_at   | timestamptz NOT NULL       |                                                          |
| volume_ml     | numeric NOT NULL CHECK > 0 |                                                          |
| beverage_type | text NOT NULL              | `water` \| `coffee` \| `tea` \| `electrolyte` \| `other` |
| caffeine_mg   | numeric                    |                                                          |
| notes         | text                       |                                                          |

### 3.18 `strength_sessions` and `strength_sets`

**sessions**

| Column           | Type                           | Notes |
| ---------------- | ------------------------------ | ----- |
| id               | uuid PK                        |       |
| user_id          | uuid NOT NULL                  |       |
| started_at       | timestamptz NOT NULL           |       |
| duration_s       | integer                        |       |
| perceived_effort | numeric                        | 1–10  |
| notes            | text                           |       |
| source           | text NOT NULL DEFAULT `manual` |       |

**sets**

| Column        | Type                              | Notes                  |
| ------------- | --------------------------------- | ---------------------- |
| id            | uuid PK                           |                        |
| user_id       | uuid NOT NULL                     | Denormalized ownership |
| session_id    | uuid NOT NULL FK sessions CASCADE |                        |
| set_index     | integer NOT NULL                  |                        |
| exercise_name | text NOT NULL                     | Free text in MVP       |
| repetitions   | integer                           |                        |
| mass_kg       | numeric                           |                        |
| rpe           | numeric                           |                        |
| notes         | text                              |                        |

Unique `(session_id, set_index)`.

### 3.19 `recommendations`

| Column                 | Type                 | Notes                                                                  |
| ---------------------- | -------------------- | ---------------------------------------------------------------------- |
| id                     | uuid PK              |                                                                        |
| user_id                | uuid NOT NULL        |                                                                        |
| generated_at           | timestamptz NOT NULL |                                                                        |
| rule_id                | text NOT NULL        | e.g. `sleep_debt_limit_intensity`                                      |
| action                 | text NOT NULL        | User-facing Swedish stored in `action_sv`; English key in `action_key` |
| action_key             | text NOT NULL        |                                                                        |
| action_sv              | text NOT NULL        |                                                                        |
| comparison_period_days | integer NOT NULL     |                                                                        |
| completeness           | numeric              | 0–1                                                                    |
| confidence             | text NOT NULL        | `low` \| `medium` \| `high`                                            |
| disclaimer_key         | text NOT NULL        |                                                                        |
| valid_until            | timestamptz          |                                                                        |

`recommendation_signals`

| Column            | Type          | Notes |
| ----------------- | ------------- | ----- |
| id                | uuid PK       |       |
| user_id           | uuid NOT NULL |       |
| recommendation_id | uuid NOT NULL |       |
| signal_key        | text NOT NULL |       |
| observed_value    | numeric       |       |
| unit              | text          |       |
| comparator        | text          |       |
| reference_value   | numeric       |       |

### 3.20 `audit_events`

| Column        | Type                 | Notes                                           |
| ------------- | -------------------- | ----------------------------------------------- |
| id            | uuid PK              |                                                 |
| user_id       | uuid NOT NULL        |                                                 |
| actor_user_id | uuid NOT NULL        | Same as user for MVP                            |
| action        | text NOT NULL        | `import.confirm`, `account.delete.request`, ... |
| entity_type   | text                 |                                                 |
| entity_id     | uuid                 |                                                 |
| metadata      | jsonb                | No secrets, no presigned URLs                   |
| created_at    | timestamptz NOT NULL |                                                 |

`user` role: insert limited / select own. Prefer insert only from server with user JWT.

### 3.21 `data_export_jobs` and `account_deletion_requests`

Export: status, storage_file_id, created_at, completed_at, error.

Deletion: requested_at, purge_after, status `pending` \| `cancelled` \| `purged`.

## 4. Storage bucket (migration)

```sql
INSERT INTO storage.buckets (
  id,
  min_upload_file_size,
  max_upload_file_size,
  cache_control,
  presigned_urls_enabled,
  download_expiration
) VALUES (
  'garmin-imports',
  1,
  26214400,          -- 25 MiB
  'private, no-store',
  true,
  30                 -- seconds
);
```

Do not use `default` for health files.

## 5. Hasura metadata requirements

Version-control under `nhost/metadata/`:

- Track all public tables
- Object/array relationships
- Permissions per role `user` and `public` (public: none on health tables)
- Insert `set: { user_id: x-hasura-user-id }`
- Update filter + post-update check: `user_id _eq X-Hasura-User-Id`
- `user_id` excluded from update columns
- Column allow-lists per operation
- Storage permissions for `storage.files` equivalent to dashboard uploader identity

Roles: default `user`, allowed `user` and `me`. Do not add `admin` to allowed roles for application users. Do not use `users.metadata` for authorization.

## 6. Views and functions

Avoid views that join across users. Any SQL function used by Hasura must be `SECURITY INVOKER` unless a written exception exists. No function should be `SECURITY DEFINER` merely to skip row permissions.

Analytics: prefer computed columns in the application layer (tested TypeScript) for MVP. PostgreSQL functions for heavy aggregates can be added later with invoker rights and `user_id` arguments ignored in favor of session identity.

## 7. Retention and deletion

| Data                           | Retention                                                           |
| ------------------------------ | ------------------------------------------------------------------- |
| Canonical health/training rows | Until user deletes account or the row                               |
| Preview rows                   | Delete 7 days after `expires_at` or on commit                       |
| Original Storage files         | Until user deletes the import or account                            |
| AI requests                    | Until account deletion                                              |
| Audit events                   | Until account deletion (MVP). Later: minimum legal hold if required |
| Auth user                      | Deleted after purge                                                 |

Account purge order:

1. Revoke refresh tokens
2. Delete Storage files in `garmin-imports` for `uploaded_by_user_id`
3. Delete public schema rows (CASCADE from user_id)
4. Delete auth user

Rollback risk: destructive migrations (DROP COLUMN) require a written data-loss note in the migration comment and owner approval if data already exists.

## 8. Rebuild from zero

A clean environment must apply:

1. `nhost/migrations/**`
2. `nhost/metadata/**`
3. `nhost/nhost.toml`
4. `nhost/seeds/**` (synthetic users only; never real health data in git)

Phase 1 will verify this against local `nhost up`.

## 9. Query plan expectations

Minimum indexes listed above. Before closing a database phase, `EXPLAIN (ANALYZE, BUFFERS)` for:

- Activities last 90 days for one user
- Daily metrics last 90 days
- Import files by import_id

No sequential scans of other users' rows; the `user_id` predicate must be index-supported.
