# GarminDB compatibility

**Status:** approved 18 August 2026. Implementation may proceed within the scope in §13 and §14.

Formkurvan adds a **local-export compatibility path** for [GarminDB](https://github.com/tcgoetz/GarminDB). GarminDB is a Python tool the user runs on their own computer. Formkurvan reads the data files it produces. Formkurvan does not run GarminDB, does not embed it, and never sees a Garmin credential.

## 1. Non-negotiable boundary

GarminDB is **outside the Formkurvan trust boundary**.

```
┌─ User's computer (outside trust boundary) ──────────┐
│  Garmin Connect  ──►  GarminDB (Python, GPL-2.0)    │
│                          │                          │
│                          ▼                          │
│              ~/HealthData/DBs/garmin.db             │
│                          │                          │
│                   user picks file                   │
└──────────────────────────┼──────────────────────────┘
                           │  HTTPS upload, Nhost session
┌──────────────────────────▼──────────────────────────┐
│  Formkurvan                                         │
│    quarantine → validate → preview → confirm        │
│    → GarminDbImportAdapter → canonical model        │
└─────────────────────────────────────────────────────┘
```

Formkurvan must never collect, receive, store, proxy, log, or process:

- Garmin username, password, or MFA code
- Garmin session cookies, OAuth tokens, or `garth` session material
- `GarminConnectConfig.json` or any GarminDB configuration file
- GarminDB log files, environment files, or a complete GarminDB home directory

There is no "Connect Garmin" button, no credential form, and no automatic download. This phase adds **zero** network calls to Garmin.

## 2. Repository inspection (requirement 4)

Inspected 18 August 2026 against `tcgoetz/GarminDB` default branch `master`.

| Fact             | Value                                                                        |
| ---------------- | ---------------------------------------------------------------------------- |
| License          | **GPL-2.0** (see §9)                                                         |
| Language         | Python 3.x, distributed on PyPI as `garmindb`                                |
| Storage engine   | SQLite (serverless files)                                                    |
| Default data dir | `~/HealthData` (`directories.base_dir`, `relative_to_home` configurable)     |
| Config location  | `~/.GarminDb/GarminConnectConfig.json` — **credential file, never accepted** |
| Last push        | 2026-07-15                                                                   |

### 2.1 What GarminDB actually produces

GarminDB writes five SQLite databases into `<base_dir>/DBs/`. Each database carries an explicit schema version in its own metadata, and GarminDB itself refuses to open a database whose version does not match its code (the README instructs users to run `--rebuild_db` after a schema bump). **That version number is the anchor for a safe adapter.**

| File                   | Schema version observed | Content                                               | Formkurvan support   |
| ---------------------- | ----------------------- | ----------------------------------------------------- | -------------------- |
| `garmin.db`            | 14                      | Sleep, weight, resting HR, HRV, stress, daily summary | **Tier A — support** |
| `garmin_activities.db` | 13                      | Activity summaries, laps, splits, 1 Hz records        | Tier B — see §4.3    |
| `garmin_monitoring.db` | 7                       | Per-minute HR, intensity, respiration, pulse ox       | Tier C — reject      |
| `garmin_summary.db`    | 8                       | Derived day/week/month/year rollups                   | Tier C — reject      |
| `summary.db`           | 7                       | Derived rollups                                       | Tier C — reject      |

GarminDB also retains the raw files it downloaded, under `<base_dir>`:

| Path                                         | Content                                            | Formkurvan support                        |
| -------------------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| `FitFiles/Activities/*.fit`                  | Garmin activity FIT, named `<activityId>.fit`      | **Already supported** by `garmin-file`    |
| `FitFiles/Activities/*.json`                 | `activity_<id>.json`, `activity_details_<id>.json` | Not in this phase                         |
| `FitFiles/Monitoring/<year>/*.fit`           | Wellness FIT                                       | Already supported where parseable         |
| `Sleep/`, `Weight/`, `RHR/`                  | Date-stamped Connect JSON                          | Not in this phase — `garmin.db` covers it |
| `FitFiles/personal-information.json`         | **Name, birth date, Garmin profile id**            | **Reject — identity file**                |
| `FitFiles/social-profile.json`               | **Garmin display name, profile**                   | **Reject — identity file**                |
| `FitFiles/user-settings.json`                | **Account settings**                               | **Reject — identity file**                |
| `garmindb.log`, `bugreport.txt`, `stats.txt` | Logs and diagnostics                               | **Reject**                                |

Those three profile JSON files are written by GarminDB's `login()` routine into the FIT files directory. They are not credentials, but they are direct account identifiers with no analytical value. Rejecting them is required by requirement 5's intent.

### 2.2 Correction to the brief

Requirement 3 lists CSV as a GarminDB output. **GarminDB does not emit CSV.** CSV is an _input_ format, used only for importing historical FitBit and Microsoft Health data (`make fitbit`, `make mshealth`), both of which the author documents as unmaintained. The only non-SQLite export GarminDB produces is **TCX**, written one activity at a time by `ActivityExporter`.

Formkurvan already parses TCX through the existing `garmin-file` adapter, so no new work is needed there.

**Net new surface in this phase is exactly one thing: the `garmin.db` SQLite file.**

### 2.3 Stability assessment

| Signal                                 | Assessment                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Explicit database + per-table versions | **Strong.** We can pin exact versions and refuse anything else instead of guessing.                                |
| Table and column names                 | **Stable in practice.** `sleep`, `weight`, `resting_hr`, `daily_summary` have existed for years.                   |
| Columns added over time                | Additive (`hrv` table, `spo2_avg`, `bb_*` are recent). Additive change is safe for a read-only column allowlist.   |
| Units                                  | **Unstable by design.** See §5 — this is the single biggest correctness risk.                                      |
| Timestamps                             | **Weak.** Stored as naive SQLite `DATETIME` with no timezone. See §6.                                              |
| Durations                              | Stored as `HH:MM:SS` text, not seconds. Requires explicit parsing.                                                 |
| Derived summary tables                 | Deliberately **not** supported — Formkurvan computes its own analytics and must not import someone else's rollups. |

## 3. Accepted and rejected inputs

### 3.1 Accept

| Input                      | Detection                                                | Limit           |
| -------------------------- | -------------------------------------------------------- | --------------- |
| `garmin.db`                | SQLite magic bytes + schema fingerprint + version check  | 25 MiB          |
| ZIP containing `garmin.db` | ZIP magic + exactly one accepted member after validation | 25 MiB, depth 1 |

Everything is identified by **content**, never by filename. A file called `garmin.db` that is not a GarminDB database is rejected. A file called `notes.txt` that _is_ a valid GarminDB database is accepted.

### 3.2 Reject, always

| Category            | Examples                                                                              |
| ------------------- | ------------------------------------------------------------------------------------- |
| Credentials         | `GarminConnectConfig.json`, password files, `.netrc`, keychain exports                |
| Sessions and tokens | `garth` session JSON, cookie jars, OAuth tokens, bearer tokens                        |
| Identity            | `personal-information.json`, `social-profile.json`, `user-settings.json`              |
| Diagnostics         | `garmindb.log`, `bugreport.txt`, `stats.txt`                                          |
| Environment         | `.env`, `.envrc`, shell profiles                                                      |
| Executables         | MZ, ELF, Mach-O, shebang scripts, `.py`, `.sh`, `.dll`, `.dylib`, `.so`               |
| Archive abuse       | Symlinks, hardlinks, path traversal, absolute paths, nested archives, zip bombs       |
| Whole-home upload   | An archive whose structure matches a GarminDB home directory (see §3.4)               |
| Other GarminDB DBs  | `garmin_monitoring.db`, `garmin_summary.db`, `summary.db`, `fitbit.db`, `mshealth.db` |

### 3.3 Filename-independent credential detection (requirement 6)

Every candidate byte range is scanned before it is parsed or persisted. A match rejects the **entire upload**, not just the entry.

1. **Structural JSON probe.** If the bytes parse as JSON, walk the object graph. Reject on any key matching `/^(password|secure_password|password_file|passwd|secret|token|access_token|refresh_token|id_token|oauth[_-]?token|session|cookie|authorization|api[_-]?key)$/i`, or on a `credentials` object containing `user`.
2. **Token-shape probe.** Reject on JWT-shaped runs (`eyJ` + base64url + two dots), `Bearer <token>`, `PRIVATE KEY` armour, or `Set-Cookie:` headers.
3. **GarminDB config fingerprint.** Reject on the co-occurrence of `enabled_stats`, `directories`, and `credentials` — the shape of `GarminConnectConfig.json` regardless of its name.
4. **Identity fingerprint.** Reject on Garmin profile keys (`userProfileId`, `displayName`, `profileImageUrlLarge`) at the document root.
5. **Executable magic bytes.** `4D 5A`, `7F 45 4C 46`, Mach-O variants, `#!`.

Rejection messages name the **category**, never the matched value. No matched bytes, key paths, or file contents are logged — see §8.4.

### 3.4 Whole-home-directory detection

Reject an archive whose entry paths show two or more of: a `DBs/` directory, a `FitFiles/` directory, a `.GarminDb/` directory, or more than one `*.db` member. The user gets: _"Ladda upp endast `garmin.db`, inte hela HealthData-mappen."_

### 3.5 Archive rules

| Rule               | Value                                                        |
| ------------------ | ------------------------------------------------------------ |
| Nesting depth      | **1** — GarminDB never nests; any nested archive is rejected |
| Entries            | ≤ 20                                                         |
| Accepted members   | Exactly 1 after filtering                                    |
| Uncompressed total | ≤ 25 MiB                                                     |
| Compression ratio  | Reject above 100:1                                           |
| Symlinks           | Reject — ZIP external attributes with Unix mode `S_IFLNK`    |
| Paths              | Reject `..`, absolute paths, drive letters, backslashes, NUL |

These are tighter than the general import path (depth 3, 100 entries) on purpose. A GarminDB upload has exactly one legitimate shape.

## 4. Supported tables and canonical mapping (requirement 7)

Read-only, from `garmin.db` only, via a fixed column allowlist. Any column not listed is never read.

### 4.1 `garmin.db` → `daily_health_metrics`

| Source                                                     | Canonical field                                                    | Notes                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------- |
| `sleep.day`                                                | `local_date`                                                       |                                           |
| `sleep.start` / `sleep.end`                                | `sleep_start_at` / `sleep_end_at`                                  | Timezone resolved per §6                  |
| `sleep.total_sleep`                                        | `sleep_duration_s`                                                 | `HH:MM:SS` → seconds                      |
| `sleep.deep_sleep` / `light_sleep` / `rem_sleep` / `awake` | `sleep_deep_s` / `sleep_light_s` / `sleep_rem_s` / `sleep_awake_s` | Same conversion                           |
| `sleep.avg_rr`                                             | `respiration_avg_brpm`                                             |                                           |
| `sleep.avg_stress`                                         | `stress_avg`                                                       | Prefer `daily_summary.stress_avg` if both |
| `resting_hr.resting_heart_rate`                            | `resting_heart_rate_bpm`                                           |                                           |
| `hrv.last_night_avg`                                       | `hrv_rmssd_ms`                                                     | Milliseconds; `weekly_avg` is ignored     |
| `daily_summary.steps`                                      | `steps`                                                            |                                           |
| `daily_summary.rhr`                                        | `resting_heart_rate_bpm`                                           | Fallback when `resting_hr` has no row     |
| `daily_summary.stress_avg`                                 | `stress_avg`                                                       |                                           |
| `daily_summary.bb_max` / `bb_min`                          | `body_battery_high` / `body_battery_low`                           |                                           |
| `daily_summary.rr_waking_avg`                              | `respiration_avg_brpm`                                             | Fallback                                  |

One canonical row per `local_date`, merged across those four tables. `source = 'garmindb'`. `external_id = 'garmindb:day:<YYYY-MM-DD>'`.

Deliberately **not** mapped: `daily_summary.distance`, `floors_*`, `calories_*`, `hydration_*`, `sweat_loss`. Distance and floors are unit-ambiguous (§5) and calories are provider estimates that would pollute the nutrition model.

### 4.2 `garmin.db` → `body_measurements`

| Source          | Canonical field | Notes                                     |
| --------------- | --------------- | ----------------------------------------- |
| `weight.day`    | `measured_at`   | Date promoted to timestamp per §6         |
| `weight.weight` | `mass_kg`       | **Unit-gated** — kg or lb depending on §5 |

`external_id = 'garmindb:weight:<YYYY-MM-DD>'`.

### 4.3 Activities are out of scope for this phase

`garmin_activities.db` is tempting but is not a good first target:

- **Size.** The `activity_records` table stores roughly one row per second per activity. A few years of training is commonly **150–300 MB** — an order of magnitude over the 25 MiB bucket cap. Most users' files would simply be rejected, which is a bad feature.
- **Redundancy.** The activity data is already available, per activity, as the FIT files GarminDB keeps in `FitFiles/Activities/`. Formkurvan parses those today with better fidelity, because FIT carries units explicitly.
- **Unit ambiguity.** `distance`, `avg_speed`, `ascent`, and `avg_pace` are all stored in whichever system the user configured. `steps_activities.avg_pace` is minutes per **mile** in the default configuration.

**Recommendation:** for activities, tell the user to drag the FIT files from `HealthData/FitFiles/Activities/` into the existing "Efter passet" dropzone. That path works today and needs no new code.

Revisit `garmin_activities.db` only if the owner approves either a larger bucket cap or a documented slim-export step. Listed as open question O-2.

## 5. The unit problem (highest correctness risk)

GarminDB stores distance, speed, elevation, and temperature in **either metric or statute units depending on the user's local configuration**. The column comments in `garmin_db.py` and `activities_db.py` say so plainly: `# kms or miles`, `# kmph or mph`, `# feet or meters`, `# C or F`. `settings.metric` in `GarminConnectConfig.json` drives it, and the resulting measurement system is recorded in the `attributes` key-value table under `measurement_system`.

A silent guess here would mean importing a 70 kg runner as 70 lb, or a 10 km run as 10 miles. That is data corruption in the user's own training history, and it would be invisible until the analytics looked wrong.

**Rule:** the adapter reads `attributes.measurement_system` and:

| Value                           | Behaviour                                                        |
| ------------------------------- | ---------------------------------------------------------------- |
| `metric`                        | Import unit-bearing fields directly                              |
| `statute`                       | Convert to canonical SI, and label the conversion in the preview |
| Missing, empty, or unrecognised | **Refuse the import.** Do not guess, do not default to metric.   |

The preview must state the detected system in plain Swedish, for example _"Din GarminDB-fil använder metriska enheter (kg, km)."_, so the user can catch a mismatch before committing.

Unit-free fields (heart rate in bpm, steps, sleep durations, stress, HRV in ms, body battery) are imported regardless, since they carry no ambiguity.

## 6. Timestamps and timezone

GarminDB stores naive `DATETIME` values with no offset. Formkurvan's canonical model uses `timestamptz`.

| Case                                        | Rule                                                                   |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `sleep.day`, `weight.day`, `resting_hr.day` | Treat as a **local calendar date**. Map straight to `local_date`.      |
| `sleep.start`, `sleep.end`                  | Interpret in the user's `user_preferences.timezone`, then store as UTC |
| `weight.day` → `measured_at`                | Promote to 12:00 local, then UTC. Record `provenance = date_only`      |

Interpreting in the profile timezone is a documented assumption, not a fact recovered from the file. It is recorded per import in provenance (§7.3) and surfaced as a preview warning when the user's timezone has changed during the imported date range.

## 7. Adapter design

### 7.1 Placement

```
lib/import/
  adapters/
    types.ts          # ImportProviderId gains "garmindb"
    garmin-file.ts    # unchanged
    garmin-api.ts     # unchanged stub
    garmindb.ts       # GarminDbImportAdapter
  garmindb/
    fingerprint.ts    # SQLite magic, schema + version identification
    open.ts           # read-only sql.js handle, limits, teardown
    queries.ts        # frozen parameterized SELECTs, column allowlist
    units.ts          # measurement_system resolution + conversion
    map.ts            # rows → CanonicalDailyHealth / CanonicalBodyMeasurement
  credentials/
    scan.ts           # §3.3 filename-independent probes
```

`GarminDbImportAdapter` implements the existing `ImportProviderAdapter` contract, so it plugs into the current preview/confirm pipeline unchanged:

```ts
export const garminDbAdapter: ImportProviderAdapter = {
  id: "garmindb",
  detect(bytes),                     // FileKind | null
  parse(bytes, context),             // ParseResult (canonical + warnings)
  externalId(record),
};
```

`FileKind` gains `"sqlite"`. `detect` returns it only when the bytes are a real SQLite database **and** carry a recognised GarminDB fingerprint at a supported version.

### 7.2 Reading untrusted SQLite (requirement 11)

**Engine: `sql.js` (SQLite compiled to WebAssembly).** Chosen over the alternatives:

| Option           | Verdict                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------- |
| `better-sqlite3` | **No.** Native addon; already ruled out by the runtime constraints in the architecture. |
| `node:sqlite`    | **No.** Needs `--experimental-sqlite` on Node 22; flag handling on Vercel is fragile.   |
| `sql.js`         | **Yes.** Pure WASM, no native addon, memory-isolated, runs identically everywhere.      |

The WASM linear-memory boundary is the primary containment: a malformed database that corrupts SQLite's internal state cannot reach the host process. `sql.js` is also built without loadable extensions, so `load_extension`, `fileio`, and `csv` are unavailable — the classic SQLite-file-read and exfiltration paths do not exist.

On top of that:

| Control        | Value                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------ |
| File size      | ≤ 25 MiB, checked before the bytes reach the engine                                        |
| Memory         | WASM heap capped; adapter aborts rather than growing                                       |
| Wall clock     | 15 s per slice, then abort and mark the file failed                                        |
| Rows per table | ≤ 50 000, enforced with `LIMIT` in the query itself                                        |
| Total rows     | ≤ 200 000 per import                                                                       |
| SQL            | **Frozen string literals only.** No user input reaches SQL, ever.                          |
| Writes         | None. No `INSERT`/`UPDATE`/`DELETE`/`ATTACH`/`PRAGMA` writes.                              |
| Schema objects | Only real tables read. Reject if an allowlisted name is a view, virtual table, or shadowed |
| Triggers       | Reject the file if `sqlite_master` contains any `type = 'trigger'`                         |
| Virtual tables | Reject on any `CREATE VIRTUAL TABLE`                                                       |
| Teardown       | `db.close()` in `finally`; bytes dropped from memory before the response                   |

Schema inspection happens **before** any data query: read `sqlite_master`, confirm the expected tables exist as tables, confirm no triggers or virtual tables, confirm the version, then run the frozen SELECTs. A file that passes inspection but fails mid-read is marked failed without partial commit.

Note that GarminDB legitimately creates **views** (`*_view`). Views are tolerated in the file but never read; the rule is that an _allowlisted table name_ must resolve to a real table.

### 7.3 Provenance (requirement 13)

Each `import_files` row for a GarminDB import records:

| Field                     | Example                                              |
| ------------------------- | ---------------------------------------------------- |
| `detected_kind`           | `sqlite`                                             |
| `garmindb_database`       | `garmin`                                             |
| `garmindb_schema_version` | `14`                                                 |
| `garmindb_table_versions` | `{"sleep": 4, "weight": 2, "resting_hr": 2}`         |
| `measurement_system`      | `metric`                                             |
| `assumed_timezone`        | `Europe/Stockholm`                                   |
| `row_counts`              | `{"sleep": 412, "weight": 380, "skipped": 12}`       |
| `partial_failures`        | Array of `{ table, reason, count }`, no row contents |

Per-table failure is recorded and does not abort the rest of the import. The import is `partial` if any table failed. Every commit writes an `audit_events` row with the checksum, version, and counts — never file bytes.

### 7.4 Deduplication (requirement 9)

Three layers:

1. **File level.** SHA-256 over the raw uploaded bytes → `import_files (user_id, sha256)`. Re-uploading the same `garmin.db` is a no-op.
2. **Record level.** `(user_id, source, external_id)` with `source = 'garmindb'`.
3. **Cross-source.** A GarminDB import will overlap heavily with data the user already imported from FIT files, because GarminDB's own activity ids and dates match Garmin's. The unique index is per-source, so overlap would create duplicate rows.

For layer 3, preview performs an explicit cross-source overlap check on `local_date` for daily metrics and `measured_at` date for body measurements. Overlapping records are shown as **"already have this day"** and are **deselected by default**. The user can override per row. `garmin.db` is re-run incrementally by its own users, so partial overlap is the normal case, not the exception.

## 8. Threat model

Assets: the user's health history, their Nhost session, and their Garmin credentials (which we intend never to hold).

### 8.1 Credential exposure

| Threat                                                       | Mitigation                                                                      |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| User uploads `GarminConnectConfig.json` by mistake           | §3.3 content probes; rejected before persistence; category-only error message   |
| Credential file hidden inside a ZIP under a benign name      | Every entry scanned by content, not name                                        |
| Credential-bearing bytes reach Nhost Storage durably         | Quarantine-first flow (§8.6) — nothing durable until validation passes          |
| Credentials leak into logs or error reports                  | §8.4 logging rules; matched values never emitted                                |
| Credentials leak into `provider_payload`                     | GarminDB path writes **no** `provider_payload`. Allowlisted columns only        |
| Future contributor adds a credential field "for convenience" | Explicitly forbidden here and in the security model; covered by a negative test |

### 8.2 Malicious file

| Threat                                                                  | Mitigation                                                             |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Malformed SQLite targeting a parser bug                                 | WASM memory isolation; size cap; wall-clock abort                      |
| `load_extension` / `fileio` / `csv` for local file read or exfiltration | `sql.js` ships without loadable extensions; no `ATTACH`                |
| Trigger or view with side effects                                       | Rejected at schema inspection; we never write, so triggers cannot fire |
| View shadowing an allowlisted table name                                | Allowlisted names must resolve to `type = 'table'`                     |
| Row explosion / memory exhaustion                                       | `LIMIT` in every query; per-table and per-import row ceilings          |
| Zip bomb                                                                | Ratio, entry count, and uncompressed-total caps (§3.5)                 |
| Symlink or path traversal                                               | Rejected; extraction is in-memory only, nothing is written to disk     |
| Nested archive abuse                                                    | Depth 1 — any nested archive is rejected outright                      |
| Executable payload                                                      | Magic-byte rejection; nothing is ever executed                         |

### 8.3 Cross-tenant access

| Threat                                             | Mitigation                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------------- |
| Upload claims another `user_id`                    | `user_id` never read from input; Hasura column preset from `X-Hasura-User-Id` |
| Imported database carries an identity field        | No identity column is ever read; the allowlist has none                       |
| User A reads user B's quarantined or stored object | Storage row filter on `uploaded_by_user_id`; negative tests (§10)             |
| User A resumes user B's import job                 | Job loaded with `user_id = X-Hasura-User-Id`                                  |
| Admin secret used to bypass Storage permissions    | Forbidden on the user import path; parsing uses the user session              |

### 8.4 Logging and observability

Never logged: file bytes, ZIP entry contents, matched credential values, key paths from the credential scan, pre-signed URLs, access tokens, or Garmin profile identifiers.

Logged: import id, user id, checksum, detected kind, schema version, measurement system, row counts, error **codes**, and duration.

Rejection errors are category-level (`credential_material_detected`, `unsupported_schema_version`, `archive_shape_rejected`). They never echo the input.

### 8.5 Resource abuse

Per-user rate limit on GarminDB imports (default 5 per hour). Slice budget of 15 s keeps Vercel function time bounded. An import that cannot finish within the row ceilings fails with a clear message rather than retrying forever.

### 8.6 Ordering conflict — quarantine buckets

Requirement 8 says preserve the original **only after** validation and explicit user confirmation. The existing architecture uploads to Storage **first**, because Vercel request-body limits make it impractical to stream a 25 MiB file through a Route Handler. These conflict.

**Proposed resolution — two buckets:**

| Bucket                | Purpose                                      | Retention                                    |
| --------------------- | -------------------------------------------- | -------------------------------------------- |
| `garmindb-quarantine` | Landing zone for unvalidated bytes           | Deleted on rejection; 24 h TTL otherwise     |
| `garmin-imports`      | Durable, validated, user-confirmed originals | Until the user deletes the import or account |

Flow: browser uploads to `garmindb-quarantine` → server validates → preview → user confirms → server copies the bytes to `garmin-imports` and deletes the quarantine object. Rejected uploads are deleted immediately, and only a rejection audit record survives.

This satisfies the intent (nothing unvalidated becomes a durable artifact, nothing is kept without confirmation) while respecting the platform's body limits. **This is a deviation from the literal wording of requirement 8 and needs explicit approval** — see open question O-1.

## 9. GPL-2.0 analysis (requirement 15)

GarminDB is licensed **GPL-2.0**. Nothing in this design may be implemented until the owner accepts this analysis.

### 9.1 What we are and are not doing

| Action                                                    | Triggers GPL-2.0?   | In this design |
| --------------------------------------------------------- | ------------------- | -------------- |
| Reading a data file produced by a GPL program             | **No**              | Yes            |
| Reimplementing an understanding of a database schema      | **No**              | Yes            |
| Copying GarminDB source code into Formkurvan              | **Yes**             | **Never**      |
| Linking to or importing the `garmindb` package            | **Yes**             | **Never**      |
| Bundling, vendoring, or redistributing GarminDB           | **Yes**             | **Never**      |
| Shipping an installer or wrapper that ships GarminDB      | **Yes**             | **Never**      |
| The user running GarminDB themselves on their own machine | Their act, not ours | Yes            |

The GPL is a license on **distribution and modification of the covered work**. It does not extend to independent programs that read data a GPL program wrote. If GPL output were itself covered, every file written by a GPL text editor would be encumbered — which the FSF explicitly rejects.

### 9.2 Rules that keep us clear

1. **No GarminDB code, in any form.** Not copied, not adapted, not translated to TypeScript, not paraphrased line by line from source.
2. **Describe the schema in our own words.** Field semantics documented from behaviour and observation. Do not paste source comments or docstrings into our code or docs.
3. **No dependency.** `garmindb` never appears in `package.json`, a container image, a script, or CI.
4. **No redistribution.** We never host, mirror, or ship GarminDB or its databases.
5. **Attribution without implying endorsement.** Reference the project by name and link; do not suggest affiliation.

If any of these is ever violated, GPL-2.0's copyleft would arguably reach the whole Formkurvan application. That outcome is unacceptable and the rules above exist to make it impossible by construction.

### 9.3 Residual non-licensing risk (flagged, needs a decision)

GarminDB downloads from Garmin Connect using **unofficial, credential-based access**. Formkurvan does not do this and never will. But there is a positioning question the owner should settle deliberately:

Formkurvan's product principles forbid unofficial Garmin authentication. Publishing a prominent "set up GarminDB" tutorial would route users into exactly that, using their Garmin password, against Garmin's terms — with Formkurvan as the reason they did it. Supporting a file format is defensible; actively recruiting users into credential-based scraping is harder to defend.

**Recommendation:** support the format, do not evangelise the tool. Describe the feature as _"Redan använder GarminDB? Ladda upp din `garmin.db`."_ Link to the upstream project for people who already run it. Do not ship setup instructions, and do not present GarminDB as the recommended way to get data into Formkurvan. The official Garmin Connect Developer Program remains the stated path for automatic sync.

Tracked as open question O-3.

## 10. Test plan (requirement 14)

### 10.1 Fixtures

Built at test time with `sql.js`, never checked in as binaries. Generators: a valid `garmin.db` at the supported version; a version-mismatched database; a database with a trigger; a database with a view shadowing `sleep`; a statute-units database; a database with no `measurement_system`; a truncated SQLite header; a synthetic `GarminConnectConfig.json`; a ZIP with a symlink; a ZIP with `../` traversal; a zip bomb; a whole-home-directory ZIP.

Fixture credentials are obviously fake (`user@example.invalid`) and asserted never to appear in output.

### 10.2 Positive

1. Valid metric `garmin.db` produces the expected `daily_health_metrics` and `body_measurements` preview rows.
2. Statute database converts correctly — 154.3 lb imports as 70.0 kg, not 154.3.
3. Durations `HH:MM:SS` convert to seconds.
4. Re-uploading identical bytes is detected as a file-level duplicate.
5. Overlapping days against existing FIT-sourced data are flagged and deselected by default.
6. Partial failure in one table still commits the others and marks the import `partial`.
7. Provenance records schema version, measurement system, and row counts.
8. A ZIP containing exactly one valid `garmin.db` is accepted.
9. User A commits their own import and reads it back.

### 10.3 Negative — content and safety

10. `GarminConnectConfig.json` rejected, standalone and inside a ZIP.
11. Same file renamed `garmin.db` still rejected — content wins over name.
12. A JSON blob with a `credentials.user` key rejected even with an unrelated name.
13. JWT-shaped and `Bearer` token content rejected.
14. `personal-information.json` and `social-profile.json` rejected.
15. `garmindb.log` rejected.
16. Executable magic bytes rejected.
17. Symlink entry rejected.
18. `../` traversal rejected.
19. Nested archive rejected.
20. Zip bomb rejected on ratio.
21. Whole-home-directory ZIP rejected with the specific message.
22. `garmin_monitoring.db` and `summary.db` rejected as unsupported.
23. Unsupported schema version rejected — no partial import.
24. Missing `measurement_system` rejected — no guessing.
25. Database with a trigger rejected.
26. View shadowing `sleep` rejected.
27. Oversized file rejected before reaching the engine.
28. Row-ceiling breach fails cleanly with no partial commit.
29. Rejection messages contain no credential values, key paths, or file contents.

### 10.4 Negative — cross-tenant isolation (explicitly required)

30. User A cannot select user B's `import_files` rows for a GarminDB import.
31. User A cannot download B's object in `garmindb-quarantine` by id.
32. User A cannot download B's object in `garmin-imports` by id.
33. User A cannot read `daily_health_metrics` or `body_measurements` normalized from B's GarminDB import.
34. User A cannot resume or process B's import job.
35. User A cannot confirm B's preview.
36. A crafted `user_id` in the upload payload is ignored; the row belongs to the session user.
37. Header `x-hasura-user-id: B` is ignored; JWT claims win.
38. Anonymous cannot read any GarminDB import artifact.
39. Nested GraphQL from A's import cannot reach B's rows.
40. Deleting A's account removes A's quarantine and durable objects and normalized rows.

Tests 30–40 satisfy requirement 14 and extend the existing authorization suite in the security model.

## 11. What this phase explicitly does not add

- No automatic downloading from Garmin Connect (requirement 17)
- No Python worker, container service, queue, or paid hosting (requirement 18)
- No Garmin login UI, credential field, or OAuth-looking flow
- No GarminDB source code in this repository (requirement 15)
- No `garmin_activities.db`, `garmin_monitoring.db`, or summary-database support
- No import of Garmin's derived rollups — Formkurvan computes its own analytics

## 12. New dependency

| Package  | Why                                                  | Risk                                                |
| -------- | ---------------------------------------------------- | --------------------------------------------------- |
| `sql.js` | Read untrusted SQLite in WASM without a native addon | MIT. WASM binary must be pinned by version and hash |

One new dependency. Pinned exactly, lockfile committed, WASM asset served from our own bundle rather than a CDN.

## 13. Owner decisions (resolved 18 August 2026)

| ID  | Question                                                                                               | Decision                                                                                |
| --- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| O-1 | Approve the quarantine-bucket deviation from the literal wording of requirement 8?                     | **Approved.** Two-bucket flow per §8.6. Delete on rejection, copy to durable on confirm |
| O-2 | Support `garmin_activities.db` later, given it usually exceeds 25 MiB?                                 | **Not now.** Activities come from FIT files via the existing dropzone                   |
| O-3 | How prominently should GarminDB be presented, given it uses unofficial credential-based Garmin access? | **Support the format, do not evangelise the tool.** No setup tutorial. See §9.3         |
| O-4 | Accept `sql.js` as the only new dependency?                                                            | **Approved.** Pinned exactly, WASM served from our own bundle                           |
| O-5 | Accept "refuse the import" as the response to a missing `measurement_system`?                          | **Approved.** Refuse rather than guess. Silent unit corruption is worse than a block    |

### 13.1 Copy constraint from O-3

The only user-facing mention of GarminDB is for people who already run it. Permitted framing: _"Redan använder GarminDB? Ladda upp din `garmin.db`."_ with a neutral link to the upstream project.

Forbidden: installation or setup instructions, any wording that presents GarminDB as the recommended route into Formkurvan, and any suggestion of affiliation. The official Garmin Connect Developer Program remains the stated path for automatic sync.

## 14. Approval gate

Design **approved** 18 August 2026, including the GPL-2.0 analysis in §9 and all five decisions in §13.

The Phase 6 acceptance criteria in [implementation-plan.md](implementation-plan.md) are now active. Implementation may proceed within the scope recorded here; any change to the accepted input set, the sandbox limits, the credential-rejection rules, the dependency list, or the §13.1 copy constraint requires a new approval.
