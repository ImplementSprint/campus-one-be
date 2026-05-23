# Phase 6 School Administration Core

Status: backend implementation ready for SIS domain review.

## Runtime Surface

All routes are mounted under `/api/school-admin` through the gateway and require a bearer route token plus tenant identity headers. Allowed roles are `school_owner`, `school_admin`, `registrar`, and `super_admin`.

Settings:

- `GET /school-admin/settings/profile`
- `PATCH /school-admin/settings/profile`

User management:

- `GET /school-admin/users?role=&status=`
- `POST /school-admin/users/invite`
- `POST /school-admin/users`
- `PATCH /school-admin/users/:id/role`
- `PATCH /school-admin/users/:id/status`
- `POST /school-admin/users/:id/password-reset`
- `POST /school-admin/users/invitations/:id/resend`
- `POST /school-admin/users/:id/alumni-admin-assignment`

Academic master data:

- `GET /school-admin/academic/:resource`
- `POST /school-admin/academic/:resource`
- `PATCH /school-admin/academic/:resource/:id`
- `DELETE /school-admin/academic/:resource/:id`
- `POST /school-admin/imports/:resource`
- `GET /school-admin/export/:resource`

Supported academic resources are `departments`, `programs`, `subjects`, `curricula`, `sections`, `rooms`, `class-assignments`, and `terms`.

## Data Boundary

Phase 6 uses the existing `institution_resources` JSONB storage boundary with `institution_id` on every record. The migration `supabase/migrations/20260523061000_phase_6_school_admin_resources.sql` extends the resource type constraint for Phase 6 records and the delivery queue used by invitation/password-reset dispatch.

User management actions and academic data changes write audit events with `school_admin.*` action names. Invitation and password-reset requests queue email delivery records so the later shared email provider integration can drain a backend-owned queue instead of requiring direct UI/database writes.

## Verification

Fresh local checks:

```text
npm run verify
npm run contracts:check
ts-node -r tsconfig-paths/register libs/school-admin/src/school-admin.service.test.ts
ts-node -r tsconfig-paths/register libs/school-admin/src/school-admin.controller.test.ts
npm run build
npm run smoke:gateway
```

`npm run verify` passed after the gateway repository injection issue was fixed. It covered contract check, the full backend test script, TypeScript build, gateway smoke, core smoke, and the route security matrix.
