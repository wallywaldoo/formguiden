# Operations (Phase 5)

Private MVP hardening notes. **Do not launch to external users** until the owner approves this plan.

## Backup and restore drill

Nhost Starter has **no automated backups**. Use manual Postgres dumps.

### Backup (owner workstation or CI with secrets)

```bash
export DATABASE_URL="postgres://..."   # from Nhost dashboard, server-only
pg_dump "$DATABASE_URL" --format=custom --file "formkurvan-$(date +%Y%m%d).dump"
```

Store dumps encrypted offline. Never commit dumps or `DATABASE_URL` to git.

### Restore drill (non-production only)

1. Create a throwaway Nhost project or local `nhost up`.
2. `pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" formkurvan-YYYYMMDD.dump`
3. Apply metadata: `nhost dev hasura metadata apply` (exact subcommand per CLI help).
4. Sign in as a seed user and verify one dashboard page loads.

Document the date and result of the last successful drill in the owner runbook.

## Account deletion purge

Grace period: **7 days** (`ACCOUNT_DELETION_GRACE_DAYS`).

Schedule (cron, GitHub Action, or manual weekly):

```bash
export NHOST_SUBDOMAIN=...
export NHOST_REGION=...
export NHOST_ADMIN_SECRET=...
export DATABASE_URL=...   # required to remove auth.users
node scripts/purge-deletion-requests.mjs
```

Dry run:

```bash
node scripts/purge-deletion-requests.mjs --dry-run
```

Order: Storage files → `auth.users` (CASCADE public rows) → mark request `purged`.

## Data export

- User-initiated from **Integritet** (`/settings/privacy`).
- Bounded job (`data_export_jobs`) builds ZIP server-side; max **20 MiB** of Garmin originals.
- Bucket `user-exports`, presigned download **300 s** (migration).
- Monitor failed jobs via Hasura / audit events (`export.request`).

## Monitoring (minimal)

| Signal                              | Source                                           | Action                          |
| ----------------------------------- | ------------------------------------------------ | ------------------------------- |
| Import/export job failures          | `data_imports.status`, `data_export_jobs.status` | Inspect `error_summary`, re-run |
| Nhost project pause (Starter 7-day) | Nhost dashboard                                  | Owner wakes project             |
| Vercel function errors              | Vercel logs                                      | Fix route / env                 |
| Auth anomalies                      | Nhost Auth logs                                  | Rotate secrets if compromise    |

No paid APM in MVP.

## Launch checklist (owner sign-off)

- [ ] Backup/restore drill completed and logged
- [ ] Deletion purge script scheduled and tested with `--dry-run`
- [ ] Privacy text and export/deletion flows reviewed
- [ ] `NHOST_ADMIN_SECRET` and `DATABASE_URL` only in server env
- [ ] No external marketing / open signup until approved

## Incident notes

- **Session cookie not HttpOnly** — XSS equals account compromise; treat CSP and input sanitization seriously.
- **Admin secret leak** — rotate in Nhost, redeploy Vercel, review audit logs.
- **Accidental deletion** — user can log in within 7 days and cancel on `/account/deletion-pending`.
