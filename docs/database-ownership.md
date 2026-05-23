# Campus One Database Ownership

Date: 2026-05-22

## Canonical Schema Decision

Campus One keeps the existing `public` schema for SIS data and the existing `alumni` schema for alumni log-style microservice tables during this phase.

Reason:

- Renaming schemas before the backend/frontend/mobile query paths are replaced would create migration risk.
- Phase 2 makes the existing schema reproducible and tenant-safe first.
- Backup schema snapshots are marked reference-only and are not part of the active migration path.

## Active Migration Source

```text
supabase/schema.sql
supabase/migrations/*.sql
supabase/seed.sql
```

Reference-only files:

```text
supabase/schema-portal.sql
supabase/schema-portal-backup.sql
```

## Ownership Matrix

| Table | Owner Domain | Tenant Boundary | Access Model |
|---|---|---|---|
| `public.portal_accounts` | Platform auth | platform | backend/auth only |
| `public.super_admins` | Platform auth | platform | backend/auth only |
| `public.institution_profiles` | Platform school onboarding | tenant root | public approved lookup plus backend writes; non-empty `target_subdomain` values are lowercase and unique |
| `public.tenant_user_memberships` | Auth/RBAC | `institution_id` | backend authoritative membership |
| `public.profiles` | Identity | user profile | temporary RLS self read/write |
| `public.admin_users` | Tenant users | `institution_id` | backend only |
| `public.login_attempts` | Auth security | platform | backend only |
| `public.user_sessions` | Auth security | user session | backend only |
| `public.applicant_profiles` | Admissions | `institution_id` | backend only |
| `public.academic_background` | Admissions | `institution_id` | backend only |
| `public.alumni_relatives` | Admissions | `institution_id` | backend only |
| `public.parent_information` | Admissions | `institution_id` | backend only |
| `public.program_selections` | Admissions | `institution_id` | backend only |
| `public.applicant_documents` | Admissions/files | `institution_id` | backend only |
| `public.admissions_results` | Admissions | `institution_id` | backend only |
| `public.admissions_activity_logs` | Admissions audit | `institution_id` | backend only |
| `public.testing_centers` | Admissions exams | `institution_id` | backend only |
| `public.exam_schedules` | Admissions exams | `institution_id` | backend only |
| `public.exam_registrations` | Admissions exams | `institution_id` | backend only |
| `public.exam_logs` | Admissions exams | `institution_id` | backend only |
| `public.exam_scores` | Admissions exams | `institution_id` | backend only |
| `public.reschedule_requests` | Admissions exams | `institution_id` | backend only |
| `public.fee_configuration` | Finance | `institution_id` | backend only |
| `public.payment_transactions` | Finance | `institution_id` | backend only |
| `public.guidelines` | School settings | `institution_id` | backend only |
| `public.student_accounts` | Student records | `institution_id` | backend only |
| `public.professor_users` | Professor records | `institution_id` | backend only |
| `public.subjects` | Academic master data | `institution_id` | backend only |
| `public.curriculum` | Academic master data | `institution_id` | backend only |
| `public.class_assignments` | Academic classes | `institution_id` | backend only |
| `public.class_enrollments` | Enrollment | `institution_id` | backend only |
| `public.grades` | Grades | `institution_id` | backend only |
| `public.grade_history` | Grades audit | `institution_id` | backend only |
| `public.announcements` | Professor communications | `institution_id` | backend only |
| `public.submissions` | Deferred LMS/classroom | no Phase 2 tenant boundary | deferred until LMS scope |
| `public.subject_offerings` | Enrollment | `institution_id` | backend only |
| `public.enrollments` | Enrollment | `institution_id` | backend only |
| `public.enrollment_items` | Enrollment | `institution_id` | backend only |
| `public.enrollment_activity_logs` | Enrollment audit/events | log payload | backend only |
| `public.alumni` | Alumni identity | `institution_id` | backend only |
| `alumni.accounts` | Alumni microservice logs | `tenant_id` | backend service schema |
| `alumni.reg_activity_logs` | Alumni microservice logs | `tenant_id` | backend service schema |
| `alumni.record_requests` | Alumni microservice logs | `tenant_id` | backend service schema |
| `alumni.card_applications` | Alumni microservice logs | `tenant_id` | backend service schema |
| `public.notifications` | Notifications | `institution_id` | backend only |
| `public.institution_resources` | Legacy generic tenant resources | `institution_id` | backend only; replace with explicit APIs |

## Phase 2 Boundary

All tenant-owned `public` tables used by SIS workflows must have:

- `institution_id`
- a foreign key to `public.institution_profiles`
- an `institution_id` index
- RLS enabled

The backend service role remains the authority for protected reads/writes. Frontend and mobile direct Supabase access is not approved for protected SIS data.
