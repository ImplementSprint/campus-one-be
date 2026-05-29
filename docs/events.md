# Domain Events

Campus One uses `libs/events/src/domain-events.ts` as the backend-owned domain event wrapper.

## Topic Convention

| Domain | Topic |
|---|---|
| School | `campus-one.school.v1` |
| Auth | `campus-one.auth.v1` |
| Admissions | `campus-one.admissions.v1` |
| Enrollment | `campus-one.enrollment.v1` |
| Grades | `campus-one.grades.v1` |
| Payments | `campus-one.payments.v1` |
| Alumni | `campus-one.alumni.v1` |
| Notifications | `campus-one.notifications.v1` |
| Audit | `campus-one.audit.v1` |

## Envelope

Every event uses this shape:

```ts
{
  eventId: string;
  eventType: string;
  eventVersion: 1;
  topic: string;
  sourceService: 'campus-one-backend';
  tenantId: string | null;
  actorId: string | null;
  correlationId: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
}
```

## Runtime Behavior

`DomainEventPublisher` is disabled by default. When disabled or when no transport exists, publishing returns the event envelope with `published: false` and does not fail the calling workflow. Use `tryPublishDomainEvent(...)` from request/command paths so provider or broker failures do not roll back admissions, enrollment, grading, payment, alumni, or onboarding state changes.

Kafka/shared-service transport binding remains external-provider work until `api-center-shared-services` is available. Do not use Kafka for synchronous request/response workflows.

## Current Event Emitters

- School registration and school review approval/rejection/suspension/reactivation.
- Admissions application submission, status changes, and applicant-to-student conversion.
- Student enrollment submission.
- Professor grade submission.
- Manual payment received.
- Alumni record requested and alumni record status updated.
