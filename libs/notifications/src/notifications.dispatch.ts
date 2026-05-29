import {
  NotificationChannel,
  NotificationTemplate,
  renderNotificationTemplate,
} from './notifications.templates';

export const REQUIRED_NOTIFICATION_EVENT_TYPES = [
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
] as const;

export type NotificationEventType = (typeof REQUIRED_NOTIFICATION_EVENT_TYPES)[number];
export type DeferredProviderChannel = Exclude<NotificationChannel, 'in_app'>;

export type NotificationEventDecision = {
  eventType: NotificationEventType;
  templateAction: NotificationEventType;
  channels: ['in_app'];
  deferredProviderChannels: DeferredProviderChannel[];
};

export type NotificationDispatchInput = {
  eventId: string;
  eventType: NotificationEventType;
  tenantId: string;
  recipientProfileId: string;
  actorId?: string | null;
  correlationId?: string | null;
  occurredAt?: string | null;
  payload: Record<string, unknown>;
};

export type NotificationDispatchJob = {
  eventId: string;
  eventType: NotificationEventType;
  version: 1;
  tenantId: string;
  actorId: string | null;
  recipientProfileId: string;
  correlationId: string | null;
  occurredAt: string | null;
  channels: ['in_app'];
  deferredProviderChannels: DeferredProviderChannel[];
  template: NotificationTemplate;
};

const deferredProviders: Record<NotificationEventType, DeferredProviderChannel[]> = {
  'school.registration.submitted': ['email'],
  'school.review.approved': ['email'],
  'school.review.rejected': ['email'],
  'admissions.application.submitted': ['email'],
  'admissions.status_changed': ['email', 'sms'],
  'enrollment.submitted': [],
  'grade.submitted': [],
  'payment.received': ['email', 'sms'],
  'alumni.record.requested': ['email'],
  'alumni.record.status_updated': ['email'],
};

const decisions = REQUIRED_NOTIFICATION_EVENT_TYPES.reduce(
  (acc, eventType) => {
    acc[eventType] = {
      eventType,
      templateAction: eventType,
      channels: ['in_app'],
      deferredProviderChannels: deferredProviders[eventType],
    };
    return acc;
  },
  {} as Record<NotificationEventType, NotificationEventDecision>,
);

export function getNotificationEventDecision(eventType: NotificationEventType): NotificationEventDecision {
  const decision = decisions[eventType];
  if (!decision) throw new Error(`unsupported notification event: ${eventType}`);
  return decision;
}

export function createNotificationDispatchJob(input: NotificationDispatchInput): NotificationDispatchJob {
  const decision = getNotificationEventDecision(input.eventType);
  const template = renderNotificationTemplate(decision.templateAction, {
    eventId: input.eventId,
    tenantId: input.tenantId,
    actorId: input.actorId ?? null,
    correlationId: input.correlationId ?? null,
    ...input.payload,
  });

  return {
    eventId: input.eventId,
    eventType: input.eventType,
    version: 1,
    tenantId: input.tenantId,
    actorId: input.actorId ?? null,
    recipientProfileId: input.recipientProfileId,
    correlationId: input.correlationId ?? null,
    occurredAt: input.occurredAt ?? null,
    channels: decision.channels,
    deferredProviderChannels: decision.deferredProviderChannels,
    template,
  };
}
