import { randomUUID } from 'node:crypto';

export const DOMAIN_EVENT_VERSION = 1;
export const DOMAIN_EVENT_SOURCE_SERVICE = 'campus-one-backend';

export const DOMAIN_EVENT_TOPICS = {
  school: 'campus-one.school.v1',
  auth: 'campus-one.auth.v1',
  admissions: 'campus-one.admissions.v1',
  enrollment: 'campus-one.enrollment.v1',
  grades: 'campus-one.grades.v1',
  payments: 'campus-one.payments.v1',
  alumni: 'campus-one.alumni.v1',
  notifications: 'campus-one.notifications.v1',
  audit: 'campus-one.audit.v1',
} as const;

export type DomainEventDomain = keyof typeof DOMAIN_EVENT_TOPICS;

export const DOMAIN_EVENT_TYPES = [
  'school.registration.submitted',
  'school.review.approved',
  'school.review.rejected',
  'school.review.suspended',
  'school.review.reactivated',
  'auth.owner.activated',
  'auth.login.succeeded',
  'auth.login.failed',
  'admissions.application.submitted',
  'admissions.status_changed',
  'admissions.applicant_converted',
  'enrollment.submitted',
  'enrollment.confirmed',
  'grade.submitted',
  'payment.received',
  'alumni.record.requested',
  'alumni.record.status_updated',
  'alumni.card.status_updated',
  'notification.created',
  'audit.recorded',
] as const;

export type DomainEventType = (typeof DOMAIN_EVENT_TYPES)[number];

export type DomainEventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  eventId: string;
  eventType: DomainEventType;
  eventVersion: number;
  topic: string;
  sourceService: string;
  tenantId: string | null;
  actorId: string | null;
  correlationId: string | null;
  occurredAt: string;
  payload: TPayload;
};

export type DomainEventInput<TPayload extends Record<string, unknown> = Record<string, unknown>> = {
  eventId?: string;
  eventType: DomainEventType;
  tenantId?: string | null;
  actorId?: string | null;
  correlationId?: string | null;
  occurredAt?: string;
  payload?: TPayload;
};

export type DomainEventPublishResult = {
  envelope: DomainEventEnvelope;
  published: boolean;
  reason?: string;
};

export type DomainEventTransport = {
  publish(topic: string, message: DomainEventEnvelope): Promise<void>;
};

const EVENT_DOMAIN_OVERRIDES: Record<string, DomainEventDomain> = {
  grade: 'grades',
  payment: 'payments',
  notification: 'notifications',
};

function isDomainEventType(eventType: string): eventType is DomainEventType {
  return (DOMAIN_EVENT_TYPES as readonly string[]).includes(eventType);
}

function resolveDomain(eventType: string): DomainEventDomain {
  const prefix = eventType.split('.')[0];
  return (EVENT_DOMAIN_OVERRIDES[prefix] ?? prefix) as DomainEventDomain;
}

export function getDomainEventTopic(eventType: string): string {
  if (!isDomainEventType(eventType)) {
    throw new Error(`unsupported domain event: ${eventType}`);
  }

  const domain = resolveDomain(eventType);
  const topic = DOMAIN_EVENT_TOPICS[domain];
  if (!topic) throw new Error(`unsupported domain event: ${eventType}`);
  return topic;
}

export function createDomainEventEnvelope(input: DomainEventInput): DomainEventEnvelope {
  return {
    eventId: input.eventId ?? randomUUID(),
    eventType: input.eventType,
    eventVersion: DOMAIN_EVENT_VERSION,
    topic: getDomainEventTopic(input.eventType),
    sourceService: DOMAIN_EVENT_SOURCE_SERVICE,
    tenantId: input.tenantId ?? null,
    actorId: input.actorId ?? null,
    correlationId: input.correlationId ?? null,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    payload: input.payload ?? {},
  };
}

export class DomainEventPublisher {
  private readonly enabled: boolean;
  private readonly transport?: DomainEventTransport;

  constructor(options: { transport?: DomainEventTransport; enabled?: boolean } = {}) {
    this.transport = options.transport;
    this.enabled = options.enabled ?? process.env.DOMAIN_EVENTS_ENABLED === 'true';
  }

  async publish(input: DomainEventInput): Promise<DomainEventPublishResult> {
    const envelope = createDomainEventEnvelope(input);

    if (!this.enabled) {
      return { envelope, published: false, reason: 'event_publisher_disabled' };
    }

    if (!this.transport) {
      return { envelope, published: false, reason: 'event_transport_missing' };
    }

    await this.transport.publish(envelope.topic, envelope);
    return { envelope, published: true };
  }
}

export const domainEventPublisher = new DomainEventPublisher();

export async function publishDomainEvent(input: DomainEventInput): Promise<DomainEventPublishResult> {
  return domainEventPublisher.publish(input);
}

export async function tryPublishDomainEvent(
  publisher: Pick<DomainEventPublisher, 'publish'>,
  input: DomainEventInput,
): Promise<DomainEventPublishResult> {
  try {
    return await publisher.publish(input);
  } catch {
    return {
      envelope: createDomainEventEnvelope(input),
      published: false,
      reason: 'event_publish_failed',
    };
  }
}
