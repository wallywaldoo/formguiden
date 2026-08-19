# Data import strategy

File-based Garmin import is the **primary MVP integration**. Official Garmin APIs are out of scope until the product is eligible for the Garmin Connect Developer Program.

This document is a design, not an implementation. No paid queue or processing service may be added without explicit approval.

## 1. Principles

- Never scrape Garmin Connect.
- Never ask for Garmin passwords.
- Never use unofficial Garmin authentication libraries.
- Never display a misleading “Connect Garmin” OAuth flow.
- Never accept, store, proxy, or log any Garmin credential, session, token, or configuration file — including files a third-party tool wrote on the user's machine.
- Never trust filenames, MIME types, archive contents, or client-provided user IDs.
- Validate type from **magic bytes** and parser success, not extensions.
- Calculate a **SHA-256** checksum of the raw bytes.
- Detect duplicates before canonical insert.
- Store originals in a **private** Nhost Storage bucket.
- Parse on the server.
- Normalize to canonical units.
- Show a preview and require confirmation.
- Report partial failures clearly.
- Keep an import history and audit trail.
- Structure code behind **provider adapters** so an official API can be added later.

## 2. How users obtain files (documented, legal)

Garmin Connect (web), per activity (Strava’s documentation of Garmin’s UI, consistent with Garmin Connect’s gear menu):

- Export Original → FIT (often delivered inside a small ZIP)
- Export to TCX
- Export to GPX

Garmin also offers a full account data export via Garmin account data management. That archive is typically a large nested ZIP of FIT files and JSON, not a simple CSV dump.

CSV support in the MVP covers:

- Garmin Connect **activity list** CSV (summary rows)
- Well-formed wellness/body CSVs the user may have
- A documented Formkurvan column mapping for generic CSV

Official Garmin API access is **not** used.

**GarminDB exports** are a separate, opt-in compatibility path designed in [garmindb-compatibility.md](garmindb-compatibility.md) (Phase 6, implemented). GarminDB runs on the user's own computer, outside our trust boundary; we accept only its `garmin.db` output and reject every credential, session, identity, and log file it produces.

Sources:

- [Exporting Files from Garmin Connect (Strava Help, describes Garmin Connect UI)](https://support.strava.com/en-us/articles/15402167-exporting-files-from-garmin-connect)
- Garmin Support: “How Do I Export Data Out of Garmin Connect?” and “Accessing your Personal Data from Garmin”

## 3. Provider adapter model

```
lib/import/
  types.ts                 # CanonicalImportBatch, warnings, units
  checksum.ts
  detect.ts                # magic bytes, zip bomb limits
  adapters/
    types.ts               # ImportProviderAdapter
    garmin-file.ts         # MVP adapter
    garmin-api.ts          # stub: throws NotEligibleError
    garmindb.ts            # Phase 6 — GarminDbImportAdapter
  fit/
  tcx/
  gpx/
  csv/
  zip/
  garmindb/                # GarminDB garmin.db adapter
  credentials/             # Phase 6 — content-based secret scan
  normalize.ts
  preview.ts
  commit.ts
```

`ImportProviderAdapter`:

- `id: "garmin-file" | "garmin-api" | "garmindb" | "garmin-connect"`
- `detect(bytes): FileKind | null`
- `parse(bytes, context): ParseResult` (canonical records + warnings)
- `externalId(record): string | null`

The Garmin API adapter exists only as a typed stub and is not wired to any UI. The GarminDB adapter does not exist yet; it is specified in [garmindb-compatibility.md](garmindb-compatibility.md) and awaits owner approval.

## 4. Supported formats

| Kind   | Detection                                     | Typical content                      | Canonical mapping                          |
| ------ | --------------------------------------------- | ------------------------------------ | ------------------------------------------ |
| FIT    | Header `.FIT` at offset 8                     | Activities, sometimes wellness/sleep | activities, laps, some daily metrics       |
| TCX    | XML TrainingCenterDatabase                    | Activities with HR/GPS               | activities, laps                           |
| GPX    | XML gpx                                       | Track points; often no HR            | activities (distance/time/elevation)       |
| CSV    | Text after ZIP/XML/FIT rejected; header sniff | Summaries                            | activities or body/health if columns match |
| ZIP    | `PK` magic                                    | Nested supported files               | Recurse with limits                        |
| SQLite | `SQLite format 3\0` + GarminDB fingerprint    | GarminDB `garmin.db` only            | daily health, body measurements — Phase 6  |
| JSON   | Top-level `{` after credential scan           | Local `python-garminconnect` runner  | daily health, body measurements — Phase 7  |

FIT parsing library: official **`@garmin/fitsdk` 21.213.0** (Garmin FIT Protocol License; internal product use). Pure JavaScript, no native addons.

TCX/GPX: XML parsed with a non-evaluating parser (for example `@xmldom/xmldom` + explicit schema walk). Disable DTDs / external entities.

ZIP: `fflate` or Node `zlib` + local file headers. **Do not** use a library that auto-executes content.

## 5. Canonical units

All analytical columns store:

| Quantity            | Unit                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| Distance, elevation | meters                                                                 |
| Duration            | seconds                                                                |
| Mass                | kilograms                                                              |
| Volume              | milliliters                                                            |
| Heart rate          | bpm                                                                    |
| Energy              | kilocalories                                                           |
| Macronutrients      | grams                                                                  |
| Pace                | seconds per kilometer (derived, not stored as the only distance field) |
| Cadence             | steps per minute or rpm as labelled on the column                      |
| Temperature         | Celsius                                                                |

Display conversion happens in `lib/units/` from `user_preferences`.

## 6. Validation, checksum, duplicates

For every uploaded object:

1. Reject if Storage `uploaded_by_user_id` ≠ session user id.
2. Reject if `bucket_id` ≠ `garmin-imports`.
3. Read bytes from Storage using the **user's** access token (or a server client that forwards that JWT). Do not use the admin secret to bypass Storage permissions for user imports.
4. Reject size outside `[min, max]` (default max 25 MB per object).
5. SHA-256 over raw bytes.
6. Magic-byte classify. If ZIP, inspect entries without trusting names.
7. Duplicate if `(user_id, sha256)` already exists in `import_files` with status `committed` (and optionally `previewed` of an in-flight import).
8. Activity-level duplicate if `(user_id, source, external_id)` matches an existing activity.

`external_id` for Garmin FIT: manufacturer + product + serial + timestamp / FIT activity id when present. If missing, checksum of the file plus start timestamp.

## 7. ZIP and FIT execution limits (Phase 0 verification)

### 7.1 Nhost Functions (Starter)

Verified: [https://docs.nhost.io/products/functions/limits](https://docs.nhost.io/products/functions/limits)

| Limit        | Starter                                        |
| ------------ | ---------------------------------------------- |
| Timeout      | **10 seconds**                                 |
| Request body | **6 MB** parsed                                |
| Response     | **6 MB**                                       |
| Runtime      | Bundled JS/TS only, **native addons stripped** |

A Garmin activity FIT is often small (tens to hundreds of KB). A long activity with 1 Hz records can be several MB. A **full Garmin account ZIP** is commonly hundreds of MB with nested ZIPs.

**Conclusion:** A synchronous Nhost Function **cannot** reliably parse every export. It also cannot accept large files in the request body. Do not use Nhost Functions as the primary parser on the free tier.

### 7.2 Vercel Functions (Hobby, Fluid compute)

Verified: [https://vercel.com/docs/functions/configuring-functions/duration](https://vercel.com/docs/functions/configuring-functions/duration)

| Limit        | Hobby (Fluid, current default)       |
| ------------ | ------------------------------------ |
| Max duration | **300 seconds**                      |
| Memory       | Plan-dependent (Hobby commonly 2 GB) |

Vercel still should **not** receive the Garmin file as the HTTP body for large ZIPs. Next.js Server Actions have a configurable `bodySizeLimit`; Nhost’s own upload tutorial raises it for small personal files. For Garmin, **upload to Storage first**, then parse by downloading from Storage.

300 seconds is enough for a handful of FIT files, not for an unbounded account dump in one request.

### 7.3 Nhost Storage

Upload path is S3-compatible and is the correct place for large bytes. Bucket `max_upload_file_size` enforces the cap. Pre-signed download URLs default to **30 seconds** expiration and must stay short-lived. [Buckets](https://docs.nhost.io/products/storage/buckets), [Pre-signed URLs](https://docs.nhost.io/products/storage/guides/presigned-urls/)

**Do not persist or log pre-signed URLs.**

## 8. Bounded, resumable, authorization-safe processing

Approved design for Phase 2. **No extra paid worker.**

### 8.1 Why not “just parse in the upload request”

- Timeouts (Nhost 10 s; even Vercel 300 s is not a full archive).
- Memory (unzip bombs, FIT record arrays).
- Request size.
- Partial failure needs a durable cursor.

### 8.2 Job model

Tables: `data_imports`, `import_files`, `import_jobs` (see [database-schema.md](database-schema.md)).

States for an import: `uploaded` → `queued` → `processing` → `preview_ready` | `failed` | `partial` → user `confirmed` → `committed`.

Each `import_files` row: `pending` | `processing` | `previewed` | `duplicate` | `failed` | `committed`.

`import_jobs` holds:

- `import_id`, `user_id`
- `cursor` (next `import_files.id` or ZIP entry index)
- `heartbeat_at`, `attempt_count`
- `lease_expires_at`

### 8.3 Control plane (no paid queue)

1. After Storage upload succeeds, a Server Action inserts DB rows and returns the import id.
2. The same action (or a Route Handler) processes **one slice**:
   - Time budget: stop after ~20 s or 1 file, whichever comes first (leave margin under Vercel 300 s; keep slices small for UX).
   - Work: download one file, parse, write preview rows, update cursor.
3. If more files remain, the handler returns `{ status: "continue", importId, cursor }`.
4. The **browser** continues by calling the same authenticated endpoint until `preview_ready` or `failed`. Closing the tab pauses work; opening import history resumes.
5. A stale lease (`lease_expires_at` in the past) may be resumed only by the **owning user**.

This is a user-driven continuation loop, not a hidden third-party queue. It remains authorization-safe because every slice:

- Requires a valid Nhost session
- Loads the job with `user_id = X-Hasura-User-Id`
- Downloads Storage objects that already have `uploaded_by_user_id` permission checks
- Inserts preview rows via GraphQL/mutations that cannot set `user_id` (column preset)

If the user is offline, the import stays `processing` until they return. That is an accepted MVP limitation.

### 8.4 ZIP handling

- Max nesting depth: 3
- Max entries: 100
- Max uncompressed total: 200 MB
- Max single entry: 25 MB
- Reject stored ratios that look like zip bombs (uncompressed >> compressed beyond a threshold)
- Skip unknown types; record a warning, do not fail the whole archive unless every entry fails

Nested Garmin account ZIPs (`DI_CONNECT/.../UploadedFiles_*.zip`) are supported **within these bounds**. A full multi-year dump that exceeds bounds is rejected with a clear message: split the export or upload individual activities. Raising limits or adding a paid worker requires owner approval.

### 8.5 Preview vs commit

Preview tables (`activity_previews`, etc.) or a `status = preview` on the same tables with `confirmed_at IS NULL`.

**Default:** separate preview tables so a failed confirm cannot leave half-visible analytics in dashboards.

Commit is a server operation:

- Re-check ownership
- Insert canonical rows
- Mark files committed
- Write `audit_events`

### 8.6 What we will not do without approval

- Inngest, Trigger.dev, SQS, Cloud Tasks, Nhost Run
- Nhost Pro solely to raise function timeout
- Parsing in the browser as the source of truth (XSS + integrity)
- Storing admin secrets in the client to “make parsing easier”

## 9. Partial failures

The preview UI lists each file:

- Parsed activity count
- Skipped (duplicate)
- Failed (corrupt FIT, unsupported TCX, empty GPX)
- Warnings (no heart rate, timezone assumed UTC, distance from GPS vs device)

Confirm may proceed with a subset. The import is `partial` if any file failed.

## 10. Audit trail

Every import writes `audit_events` with action, actor `user_id`, import id, checksums, and counts. No file bytes, no pre-signed URLs, no access tokens.

## 11. GarminDB compatibility path (Phase 6)

Full design: [garmindb-compatibility.md](garmindb-compatibility.md).

GarminDB is a GPL-2.0 Python tool that users run themselves. It is **outside our trust boundary**. We add compatibility with one of its output files; we do not run it, embed it, depend on it, or handle any credential it uses.

| Decision        | Value                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| Accepted input  | `garmin.db` only (schema version pinned), standalone or in a flat ZIP                                        |
| Rejected input  | Config, session, token, identity, and log files; all other GarminDB databases                                |
| Activities      | **Not** from SQLite — users drag FIT files from `HealthData/FitFiles/Activities/` into the existing dropzone |
| Engine          | `sql.js` (WASM), read-only, frozen SQL, no extensions, no `ATTACH`                                           |
| Units           | Read `attributes.measurement_system`; **refuse** the import if absent                                        |
| Source value    | `garmindb`                                                                                                   |
| Durable storage | Only after validation and explicit user confirmation, via a quarantine bucket                                |

Two additions to the general pipeline:

1. **Content-based credential scanning** (`lib/import/credentials/`) runs on every candidate byte range before parsing or persistence, independent of filename. A match rejects the whole upload.
2. **Quarantine-first storage.** Unvalidated bytes land in `garmindb-quarantine`, not `garmin-imports`. They are copied to the durable bucket only on user confirmation, and deleted otherwise.

Tighter archive limits apply to this path than to general imports: depth 1, 20 entries, exactly one accepted member.

## 12. Future official API

When eligible:

- Implement `garmin-api` adapter using Garmin’s official OAuth and data types.
- Map to the same canonical records.
- Keep file import forever (users without API access, historical dumps).
- Do not mix unofficial libraries into that path.

## 13. Phase 2 test fixtures

`tests/import-fixtures/` includes TCX, GPX, CSV samples plus helpers that encode FIT via `@garmin/fitsdk` and build ZIP archives. Coverage includes truncated FIT, mixed ZIP, zip-bomb rejection, and a PNG with FIT-like naming.

Authorization tests: user A cannot commit or read user B’s `import_files` or Storage objects. Live GraphQL cases skip unless test JWTs are set.
