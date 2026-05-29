export type NotificationChannel = 'in_app' | 'email' | 'sms';

export type NotificationTemplate = {
  title: string;
  body: string;
  channels: NotificationChannel[];
  metadata: Record<string, unknown>;
};

type TemplateInput = Record<string, unknown>;

function text(value: unknown, fallback: string): string {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : fallback;
}

const renderers: Record<string, (input: TemplateInput) => Omit<NotificationTemplate, 'metadata'>> = {
  'school.registration.submitted': (input) => ({
    title: 'School registration submitted',
    body: `${text(input.schoolName, 'A school')} submitted a Campus One registration for review.`,
    channels: ['in_app'],
  }),
  'school.review.approved': (input) => ({
    title: 'School approved',
    body: `${text(input.schoolName, 'Your school')} has been approved for Campus One onboarding.`,
    channels: ['in_app'],
  }),
  'school.review.rejected': (input) => ({
    title: 'School registration needs attention',
    body: `${text(input.schoolName, 'Your school')} registration needs review before approval.`,
    channels: ['in_app'],
  }),
  'admissions.status_changed': (input) => ({
    title: 'Admissions status updated',
    body: `Application ${text(input.reference, 'status')} is now ${text(input.status, 'updated')}.`,
    channels: ['in_app'],
  }),
  'admissions.application.submitted': (input) => ({
    title: 'Admissions application submitted',
    body: `Application ${text(input.reference, 'reference')} for ${text(input.applicantName, 'the applicant')} has been submitted.`,
    channels: ['in_app'],
  }),
  'enrollment.submitted': (input) => ({
    title: 'Enrollment submitted',
    body: `Your enrollment for ${text(input.termName, 'the selected term')} has been submitted.`,
    channels: ['in_app'],
  }),
  'grade.submitted': (input) => ({
    title: 'Grade submitted',
    body: `Your ${text(input.courseCode, 'course')} grade for ${text(input.className, 'your class')} has been submitted.`,
    channels: ['in_app'],
  }),
  'payment.received': (input) => ({
    title: 'Payment received',
    body: `Payment of ${text(input.amount, 'the required amount')} was recorded for ${text(input.paymentFor, 'your account')}.`,
    channels: ['in_app'],
  }),
  'alumni.record.requested': (input) => ({
    title: 'Alumni document requested',
    body: `Your ${text(input.documentType, 'document')} request has been submitted.`,
    channels: ['in_app'],
  }),
  'alumni.record.status_updated': (input) => ({
    title: 'Alumni document status updated',
    body: `Your ${text(input.documentType, 'document')} request is now ${text(input.status, 'updated')}.`,
    channels: ['in_app'],
  }),
};

export function renderNotificationTemplate(action: string, input: TemplateInput = {}): NotificationTemplate {
  const normalizedAction = text(action, 'notification.created');
  const render = renderers[normalizedAction];
  const rendered = render
    ? render(input)
    : {
        title: 'Campus One update',
        body: 'A new Campus One update is available.',
        channels: ['in_app'] as NotificationChannel[],
      };

  return {
    ...rendered,
    metadata: {
      action: normalizedAction,
      ...input,
    },
  };
}
