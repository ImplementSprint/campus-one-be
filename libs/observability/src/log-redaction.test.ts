import { deepEqual, equal, fail } from 'assert';

type LogRedactionModule = {
  redactLogMetadata: (metadata: Record<string, unknown>) => Record<string, unknown>;
  redactLogValue: (value: unknown, key?: string) => unknown;
  redactLogError: (error: unknown) => string;
};

function loadRedactionModule(): LogRedactionModule {
  try {
    return require('./log-redaction') as LogRedactionModule;
  } catch {
    fail('log-redaction module should export redactLogMetadata, redactLogValue, and redactLogError');
  }
}

const { redactLogError, redactLogMetadata, redactLogValue } = loadRedactionModule();

const metadata = redactLogMetadata({
  tenant_id: 'tenant-1',
  actor_uuid: 'actor-1',
  correlation_id: 'corr-1',
  status_code: 200,
  action: 'payment.received',
  password: 'secret-password',
  password_hash: 'scrypt$salt$hash',
  authorization: 'Bearer access-token',
  access_token: 'jwt-access',
  refreshToken: 'jwt-refresh',
  otp: '123456',
  oneTimePassword: '654321',
  email: 'student@example.test',
  phone: '+639171234567',
  mobile_number: '+639181234567',
  payment_reference: 'PAY-123',
  referenceNumber: 'REF-123',
  nested: {
    token: 'nested-token',
    applicantEmail: 'applicant@example.test',
    paymentMetadata: {
      providerReference: 'PM-456',
      payment_status: 'paid',
    },
  },
  events: [
    { authToken: 'array-token', tenant_id: 'tenant-2' },
    { contact_phone: '+639191234567', status_code: 400 },
  ],
});

deepEqual(metadata, {
  tenant_id: 'tenant-1',
  actor_uuid: 'actor-1',
  correlation_id: 'corr-1',
  status_code: 200,
  action: 'payment.received',
  password: '[REDACTED]',
  password_hash: '[REDACTED]',
  authorization: '[REDACTED]',
  access_token: '[REDACTED]',
  refreshToken: '[REDACTED]',
  otp: '[REDACTED]',
  oneTimePassword: '[REDACTED]',
  email: '[REDACTED]',
  phone: '[REDACTED]',
  mobile_number: '[REDACTED]',
  payment_reference: '[REDACTED]',
  referenceNumber: '[REDACTED]',
  nested: {
    token: '[REDACTED]',
    applicantEmail: '[REDACTED]',
    paymentMetadata: {
      providerReference: '[REDACTED]',
      payment_status: 'paid',
    },
  },
  events: [
    { authToken: '[REDACTED]', tenant_id: 'tenant-2' },
    { contact_phone: '[REDACTED]', status_code: 400 },
  ],
});

equal(redactLogValue('student@example.test'), '[REDACTED]');
equal(redactLogValue('Bearer abc.def.ghi'), '[REDACTED]');
equal(redactLogValue('Owner OTP is 123456'), '[REDACTED]');
equal(redactLogValue('tenant-1'), 'tenant-1');
equal(redactLogError(new Error('connect postgresql://user:secret@localhost:5432/app failed')), '[REDACTED]');
