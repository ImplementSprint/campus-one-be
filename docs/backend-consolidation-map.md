# Backend Consolidation Map

## Source Folders

- `sources/main-be`: current platform backend with auth, institution profile, and institution data service.
- `sources/portal-be`: current internal portal backend with student, enrollment, application, alumni, dashboard, profile, grades, subjects, and courses.

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

## First Consolidation Order

1. Create `apps/gateway` from the portal backend gateway baseline.
2. Move platform auth and institution profile into `libs/auth` and `libs/tenants`.
3. Move institution data service into `libs/institution-data`.
4. Move student, enrollment, grades, subjects, courses, and profile into `libs/academics`.
5. Move application into `libs/admissions`.
6. Move alumni into `libs/alumni`.
7. Merge both `supabase/` folders into one canonical backend schema/migration folder.
