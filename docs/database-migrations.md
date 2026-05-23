# Campus One Database Migrations

Date: 2026-05-22

## Migration Naming Convention

Use Supabase CLI generated migration names:

```text
supabase migration new <short_snake_case_description>
```

Do not hand-invent timestamps. The CLI owns migration filenames.

## Active Files

```text
supabase/schema.sql
supabase/migrations/20260522092225_phase_2_schema_baseline.sql
supabase/seed.sql
```

Legacy schema snapshots are reference-only:

```text
supabase/schema-portal.sql
supabase/schema-portal-backup.sql
```

## Local Verification

Repo-local verification that does not require a live Supabase project:

```bash
npm run schema:check
npm run verify
```

Supabase CLI verification when Docker/local Supabase is available:

```bash
supabase db reset
supabase migration list --local
```

The installed CLI in this workspace was checked at `2.75.0`; newer `db advisors`/query workflows should be rechecked before use.

## Fresh Project Setup

1. Create the Supabase project.
2. Configure secrets outside source control.
3. Apply migrations:

```bash
supabase db push
```

4. Apply sandbox seed only for non-production:

```bash
supabase db reset
```

## Rollback Guidance

The Phase 2 baseline migration is an initial schema baseline. For a fresh sandbox project, rollback is project reset/recreate.

For later incremental migrations:

- Prefer additive changes.
- Add backfill SQL in the same migration when required.
- Add explicit rollback notes in this file for destructive changes.
- Never run destructive migration changes in production without backup and reviewer approval.
