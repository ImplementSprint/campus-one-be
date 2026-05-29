export const LOG_REDACTED_VALUE = '[REDACTED]';

const SENSITIVE_KEY_TOKENS = [
  'authorization',
  'authtoken',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'jwt',
  'password',
  'passwordhash',
  'passcode',
  'secret',
  'token',
  'otp',
  'onetimepassword',
  'verificationcode',
  'mfacode',
  'email',
  'phone',
  'mobilenumber',
  'contactphone',
  'paymentreference',
  'providerreference',
  'paymongoreference',
  'referencenumber',
  'receipturl',
  'checkouturl',
];

const SAFE_OPERATIONAL_KEYS = new Set([
  'action',
  'actoruuid',
  'correlationid',
  'institutionid',
  'requestid',
  'schoolslug',
  'status',
  'statuscode',
  'tenantid',
]);

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const BEARER_PATTERN = /\bbearer\s+[A-Za-z0-9._~+/=-]+\b/i;
const JWT_PATTERN = /\b[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const OTP_PATTERN = /\b(?:otp|one[-\s]?time password|verification code|mfa code)\D{0,16}\d{4,8}\b/i;
const PHONE_PATTERN = /(?:\+?\d[\s-]?){10,15}/;
const URL_CREDENTIAL_PATTERN = /\b[a-z][a-z0-9+.-]*:\/\/[^/\s:@]+:[^/\s@]+@/i;

function normalizeKey(key: string | undefined): string {
  return (key ?? '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function isSensitiveKey(key: string | undefined): boolean {
  const normalized = normalizeKey(key);
  if (!normalized || SAFE_OPERATIONAL_KEYS.has(normalized)) return false;

  return SENSITIVE_KEY_TOKENS.some((token) => normalized === token || normalized.endsWith(token));
}

function isSensitiveString(value: string): boolean {
  return (
    EMAIL_PATTERN.test(value) ||
    BEARER_PATTERN.test(value) ||
    JWT_PATTERN.test(value) ||
    OTP_PATTERN.test(value) ||
    PHONE_PATTERN.test(value) ||
    URL_CREDENTIAL_PATTERN.test(value)
  );
}

export function redactLogValue(value: unknown, key?: string, seen = new WeakSet<object>()): unknown {
  if (isSensitiveKey(key)) return LOG_REDACTED_VALUE;

  if (typeof value === 'string') {
    return isSensitiveString(value) ? LOG_REDACTED_VALUE : value;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redactLogValue(item, undefined, seen));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
      entryKey,
      redactLogValue(entryValue, entryKey, seen),
    ]),
  );
}

export function redactLogMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return redactLogValue(metadata) as Record<string, unknown>;
}

export function redactLogError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const redacted = redactLogValue(message);
  return typeof redacted === 'string' ? redacted : LOG_REDACTED_VALUE;
}
