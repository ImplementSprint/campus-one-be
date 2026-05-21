# Backend Consolidation Map

## Source Folders

The temporary migration copies were removed after consolidation:

- `sources/main-be`: retired platform backend copy.
- `sources/portal-be`: retired internal portal backend copy.

The active implementation now lives under `apps/`, `libs/`, and `supabase/`.

## Target Shape

```text
apps/gateway
libs/auth
libs/tenants
libs/academics
libs/admissions
libs/alumni
libs/institution-data
libs/notifications
libs/database
libs/contracts
supabase
```

## Consolidation Result

1. `apps/gateway` is the primary deployable HTTP API.
2. Platform auth and portal auth live under `libs/auth`.
3. Institution profile, public school lookup, and tenant resolution live under `libs/tenants`.
4. Institution data service lives under `libs/institution-data`.
5. Student, enrollment, grades, subjects, courses, profile, and dashboard live under `libs/academics`.
6. Application/admissions workflows live under `libs/admissions`.
7. Alumni workflows and optional Kafka listener live under `libs/alumni`.
8. Backend-owned shared contract artifacts are generated from `libs/contracts`.
9. The canonical backend schema/migration folder is `supabase/`.

## Verification Gate

Use this before backend structural cleanup or release:

```powershell
npm run verify
```
