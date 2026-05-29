import { deepEqual, equal, ok, throws } from 'node:assert/strict';
import {
  REQUIRED_NOTIFICATION_EVENT_TYPES,
  createNotificationDispatchJob,
  getNotificationEventDecision,
} from './notifications.dispatch';

deepEqual(REQUIRED_NOTIFICATION_EVENT_TYPES, [
  'school.registration.submitted',
  'school.review.approved',
  'school.review.rejected',
  'admissions.application.submitted',
  'admissions.status_changed',
  'enrollment.submitted',
  'grade.submitted',
  'payment.received',
  'alumni.record.requested',
  'alumni.record.status_updated',
]);

for (const eventType of REQUIRED_NOTIFICATION_EVENT_TYPES) {
  const decision = getNotificationEventDecision(eventType);
  equal(decision.eventType, eventType);
  deepEqual(decision.channels, ['in_app']);
  ok(decision.templateAction.length > 0);
}

deepEqual(getNotificationEventDecision('admissions.status_changed').deferredProviderChannels, ['email', 'sms']);
deepEqual(getNotificationEventDecision('admissions.application.submitted').deferredProviderChannels, ['email']);
deepEqual(getNotificationEventDecision('school.review.approved').deferredProviderChannels, ['email']);
deepEqual(getNotificationEventDecision('grade.submitted').deferredProviderChannels, []);

const job = createNotificationDispatchJob({
  eventId: 'event-1',
  eventType: 'grade.submitted',
  tenantId: 'demo',
  actorId: 'professor-1',
  recipientProfileId: 'student-1',
  correlationId: 'corr-1',
  occurredAt: '2026-05-25T10:00:00.000Z',
  payload: {
    courseCode: 'IT101',
    className: 'BSIT 1A',
  },
});

equal(job.eventId, 'event-1');
equal(job.eventType, 'grade.submitted');
equal(job.version, 1);
equal(job.tenantId, 'demo');
equal(job.actorId, 'professor-1');
equal(job.recipientProfileId, 'student-1');
equal(job.correlationId, 'corr-1');
deepEqual(job.channels, ['in_app']);
deepEqual(job.deferredProviderChannels, []);
equal(job.template.title, 'Grade submitted');
equal(job.template.body, 'Your IT101 grade for BSIT 1A has been submitted.');
deepEqual(job.template.metadata, {
  action: 'grade.submitted',
  eventId: 'event-1',
  tenantId: 'demo',
  actorId: 'professor-1',
  correlationId: 'corr-1',
  courseCode: 'IT101',
  className: 'BSIT 1A',
});

throws(
  () =>
    createNotificationDispatchJob({
      eventId: 'event-2',
      eventType: 'unknown.event',
      tenantId: 'demo',
      recipientProfileId: 'student-1',
      payload: {},
    } as any),
  /unsupported notification event/,
);
