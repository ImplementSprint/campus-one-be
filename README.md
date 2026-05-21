# Campus One Backend

Centralized backend repository for Campus One.

## Current Phase

This repository is the active centralized NestJS backend for Campus One.

## Layout

- `apps/gateway` - primary HTTP API gateway.
- `libs/auth` - platform and portal auth modules.
- `libs/tenants` - institution profiles, school lookup, and tenant resolution.
- `libs/academics` - student, enrollment, dashboard, profile, subjects, courses, and grades modules.
- `libs/admissions` - applicant/application workflows.
- `libs/alumni` - alumni workflows and optional Kafka graduation listener.
- `libs/institution-data` - tenant-scoped generic resources.
- `libs/contracts` - backend-owned shared DTO/type contracts.
- `supabase` - canonical schema and migrations.

The temporary `sources/` migration copies were removed after the consolidated gateway passed contract checks, tests, build, and the `/api/health` smoke check.

## Verification

```powershell
npm run verify
```
