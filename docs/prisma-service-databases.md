# Prisma Service Databases

Date: 2026-05-22

## Purpose

This backend slice starts the Prisma file structure for the planned one-database-per-service architecture. It also defines the local and CI verification policy for service-owned Prisma clients.

## Current Structure

Each service owns one Prisma schema folder:

```text
prisma/
  tenant-registry/schema.prisma
  identity-access/schema.prisma
  academics/schema.prisma
  admissions/schema.prisma
  registrar/schema.prisma
  alumni/schema.prisma
  billing/schema.prisma
  notifications-audit/schema.prisma
```

Each schema has:

- a PostgreSQL datasource
- one service-specific database URL environment variable
- one generated Prisma client output under `src/generated/prisma/<service-folder>`
- models for any domain table already moved behind a Prisma repository boundary, or placeholder comments for domains not migrated yet

## Generated Client Policy

Generated Prisma clients are build-generated artifacts and are not committed to Git.

```text
src/generated/prisma/
```

The backend build runs Prisma generation before TypeScript compilation through `prebuild`. CI and local verification must also run the dedicated Prisma gate:

```bash
npm run prisma:ci
```

That command runs:

```text
npm run prisma:validate
npm run prisma:migrations:check
npm run prisma:generate
npm run security:audit
```

This keeps reviews focused on schema and repository changes instead of generated client churn. Developers should run `npm run prisma:generate` after changing any service schema if they need local editor/type support before the next build.

## Database Environment Variables

| Service folder | Database URL env var |
|---|---|
| `tenant-registry` | `TENANT_REGISTRY_DATABASE_URL` |
| `identity-access` | `IDENTITY_ACCESS_DATABASE_URL` |
| `academics` | `ACADEMICS_DATABASE_URL` |
| `admissions` | `ADMISSIONS_DATABASE_URL` |
| `registrar` | `REGISTRAR_DATABASE_URL` |
| `alumni` | `ALUMNI_DATABASE_URL` |
| `billing` | `BILLING_DATABASE_URL` |
| `notifications-audit` | `NOTIFICATIONS_AUDIT_DATABASE_URL` |

## Migrated Runtime Boundaries

| Runtime path | Service database | Prisma model | Repository |
|---|---|---|---|
| Tenant subdomain/mobile tenant resolution | `tenant_registry` | `InstitutionProfile` mapped to `institution_profiles` | `libs/tenants/src/tenant-registry.repository.ts` |
| Public approved school search and slug lookup | `tenant_registry` | `InstitutionProfile` mapped to `institution_profiles` | `libs/tenants/src/tenant-registry.repository.ts` |
| Active tenant membership verification for `/auth/me` | `identity_access` | `TenantUserMembership` mapped to `tenant_user_memberships` | `libs/auth/src/platform-auth/identity-access.repository.ts` |
| Auth role/account detection reads | `identity_access` | `PortalAccount`, `AdminUser`, `StudentAccount`, `ProfessorUser`, `AlumniAccount` | `libs/auth/src/platform-auth/identity-access.repository.ts` |

The tenant resolution and public school lookup paths no longer query `institution_profiles` directly through the Supabase client. Tenant resolution uses:

```text
TenantResolutionService -> TenantRegistryRepository -> TenantRegistryPrismaClient -> tenant_registry Prisma client
```

Public school lookup uses:

```text
PublicSchoolService -> TenantRegistryRepository -> TenantRegistryPrismaClient -> tenant_registry Prisma client
```

Tenant membership verification uses:

```text
AuthService -> IdentityAccessRepository -> IdentityAccessPrismaClient -> identity_access Prisma client
```

Auth role/account detection reads use the same identity-access boundary. The compatibility signup path still writes through Supabase Auth/Admin APIs and existing Supabase tables until the account creation workflow is migrated.

Runtime Prisma clients fail fast when their required database URL is missing. Runtime code must not use the Prisma CLI placeholder URLs that are only intended for offline schema validation and generation.

Tenant subdomains are normalized to lowercase before public slug lookup. The SQL baseline and tenant-registry service migration require a non-empty lowercase `target_subdomain` value and enforce uniqueness for `target_subdomain`.

## Ownership Rules

- A service schema owns only the tables for that service database.
- Cross-service reads must go through service APIs or approved integration events, not direct table joins across service databases.
- Generated clients must stay service-specific and must not be shared as a single global database client.
- Runtime modules should import only the generated client for the service they own.
- New domain models should be added to the matching service schema during that service's migration slice.
- Shared tenant identifiers and user identifiers should remain stable integration keys, not implicit foreign keys across physical databases.

## Commands

Generate one service client directly:

```bash
npx prisma generate --schema prisma/tenant-registry/schema.prisma
```

Validate one service schema directly:

```bash
npx prisma validate --schema prisma/tenant-registry/schema.prisma
```

Create or apply migrations for a service database after that service owns models:

```bash
npx prisma migrate dev --schema prisma/tenant-registry/schema.prisma
npx prisma migrate deploy --schema prisma/tenant-registry/schema.prisma
```

The repo-level package scripts wrap those direct commands:

```bash
npm run prisma:schemas
npm run prisma:validate
npm run prisma:migrations:check
npm run prisma:generate
npm run prisma:migrate:deploy
npm run prisma:ci
```

## Current Limitations

- Tenant registry `InstitutionProfile` and identity/access `TenantUserMembership`, `PortalAccount`, `AdminUser`, `StudentAccount`, `ProfessorUser`, and `AlumniAccount` models have been added so far.
- Tenant-registry and identity-access service migration files now exist under their service-specific Prisma migration folders.
- `npm run prisma:migrations:check` is part of `npm run prisma:ci` and fails when a Prisma-owned service has models without migration files.
- Existing Supabase SQL files remain the active database baseline until service migrations are executed against Cloud SQL or local Postgres and cutover is approved.
- Most runtime code still needs later slices to use service-specific Prisma clients.
- GitHub Actions must still execute once on the remote branch to prove the new CI gate in the hosted environment.
- Secret Manager and deployed runtime injection for `TENANT_REGISTRY_DATABASE_URL` and `IDENTITY_ACCESS_DATABASE_URL` are not proven yet.
