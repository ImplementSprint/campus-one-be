import { deepEqual, equal, fail, rejects } from 'assert';

type DomainEventsModule = {
  DOMAIN_EVENT_TOPICS: Record<string, string>;
  DomainEventPublisher: new (options?: {
    transport?: { publish: (topic: string, message: unknown) => Promise<void> };
    enabled?: boolean;
  }) => {
    publish: (input: Record<string, unknown>) => Promise<{ envelope: Record<string, unknown>; published: boolean; reason?: string }>;
  };
  createDomainEventEnvelope: (input: Record<string, unknown>) => Record<string, unknown>;
  getDomainEventTopic: (eventType: string) => string;
  tryPublishDomainEvent: (
    publisher: { publish: (input: Record<string, unknown>) => Promise<{ envelope: Record<string, unknown>; published: boolean; reason?: string }> },
    input: Record<string, unknown>,
  ) => Promise<{ envelope: Record<string, unknown>; published: boolean; reason?: string }>;
};

function loadDomainEvents(): DomainEventsModule {
  try {
    return require('./domain-events') as DomainEventsModule;
  } catch {
    fail('domain-events module should export topic map, envelope helper, topic resolver, and publisher');
  }
}

const {
  DOMAIN_EVENT_TOPICS,
  DomainEventPublisher,
  createDomainEventEnvelope,
  getDomainEventTopic,
  tryPublishDomainEvent,
} = loadDomainEvents();

deepEqual(DOMAIN_EVENT_TOPICS, {
  school: 'campus-one.school.v1',
  auth: 'campus-one.auth.v1',
  admissions: 'campus-one.admissions.v1',
  enrollment: 'campus-one.enrollment.v1',
  grades: 'campus-one.grades.v1',
  payments: 'campus-one.payments.v1',
  alumni: 'campus-one.alumni.v1',
  notifications: 'campus-one.notifications.v1',
  audit: 'campus-one.audit.v1',
});

equal(getDomainEventTopic('school.registration.submitted'), 'campus-one.school.v1');
equal(getDomainEventTopic('school.review.approved'), 'campus-one.school.v1');
equal(getDomainEventTopic('auth.owner.activated'), 'campus-one.auth.v1');
equal(getDomainEventTopic('admissions.status_changed'), 'campus-one.admissions.v1');
equal(getDomainEventTopic('enrollment.submitted'), 'campus-one.enrollment.v1');
equal(getDomainEventTopic('grade.submitted'), 'campus-one.grades.v1');
equal(getDomainEventTopic('payment.received'), 'campus-one.payments.v1');
equal(getDomainEventTopic('alumni.record.requested'), 'campus-one.alumni.v1');
equal(getDomainEventTopic('notification.created'), 'campus-one.notifications.v1');
equal(getDomainEventTopic('audit.recorded'), 'campus-one.audit.v1');

const envelope = createDomainEventEnvelope({
  eventId: 'event-1',
  eventType: 'school.registration.submitted',
  tenantId: 'tenant-1',
  actorId: 'owner-1',
  correlationId: 'corr-1',
  occurredAt: '2026-05-25T11:00:00.000Z',
  payload: { schoolSlug: 'demo' },
});

deepEqual(envelope, {
  eventId: 'event-1',
  eventType: 'school.registration.submitted',
  eventVersion: 1,
  topic: 'campus-one.school.v1',
  sourceService: 'campus-one-backend',
  tenantId: 'tenant-1',
  actorId: 'owner-1',
  correlationId: 'corr-1',
  occurredAt: '2026-05-25T11:00:00.000Z',
  payload: { schoolSlug: 'demo' },
});

async function main() {
  const sent: Array<{ topic: string; message: unknown }> = [];
  const publisher = new DomainEventPublisher({
    enabled: true,
    transport: {
      async publish(topic, message) {
        sent.push({ topic, message });
      },
    },
  });

  const published = await publisher.publish({
    eventId: 'event-2',
    eventType: 'grade.submitted',
    tenantId: 'tenant-1',
    actorId: 'professor-1',
    payload: { enrollmentId: 'enrollment-1' },
  });

  equal(published.published, true);
  equal(sent[0].topic, 'campus-one.grades.v1');
  equal((sent[0].message as any).eventType, 'grade.submitted');
  equal((sent[0].message as any).eventVersion, 1);

  const disabled = await new DomainEventPublisher({ enabled: false }).publish({
    eventType: 'payment.received',
    tenantId: 'tenant-1',
    payload: { paymentId: 'payment-1' },
  });
  equal(disabled.published, false);
  equal(disabled.reason, 'event_publisher_disabled');

  await rejects(
    () => publisher.publish({ eventType: 'unknown.created', tenantId: 'tenant-1', payload: {} }),
    /unsupported domain event/,
  );

  const safe = await tryPublishDomainEvent(
    {
      async publish(input: Record<string, unknown>) {
        throw new Error(`broker failed for ${input.eventType}`);
      },
    },
    { eventType: 'alumni.record.requested', tenantId: 'tenant-1', payload: { logId: 'log-1' } },
  );
  equal(safe.published, false);
  equal(safe.reason, 'event_publish_failed');
  equal(safe.envelope.eventType, 'alumni.record.requested');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
