import { equal, ok } from 'node:assert/strict';
import {
  createRateLimitMiddleware,
  getRateLimitPolicyForRequest,
  resolveRateLimitOptions,
} from './rate-limit';

const previousEnabled = process.env.RATE_LIMIT_ENABLED;
const previousWindow = process.env.RATE_LIMIT_WINDOW_MS;
const previousAuthLimit = process.env.RATE_LIMIT_AUTH_MAX;

delete process.env.RATE_LIMIT_ENABLED;
delete process.env.RATE_LIMIT_WINDOW_MS;
delete process.env.RATE_LIMIT_AUTH_MAX;

equal(resolveRateLimitOptions().enabled, true);
equal(resolveRateLimitOptions().windowMs, 60_000);
equal(resolveRateLimitOptions().limits.auth, 10);

process.env.RATE_LIMIT_WINDOW_MS = '30000';
process.env.RATE_LIMIT_AUTH_MAX = '2';
equal(resolveRateLimitOptions().windowMs, 30_000);
equal(resolveRateLimitOptions().limits.auth, 2);

equal(getRateLimitPolicyForRequest('POST', '/api/auth/login')?.id, 'auth');
equal(getRateLimitPolicyForRequest('POST', '/api/auth/signin')?.id, 'auth');
equal(getRateLimitPolicyForRequest('POST', '/api/auth/signup')?.id, 'signup');
equal(getRateLimitPolicyForRequest('POST', '/api/platform/schools/register')?.id, 'school_registration');
equal(getRateLimitPolicyForRequest('POST', '/api/application/track')?.id, 'applicant_tracking');
equal(getRateLimitPolicyForRequest('POST', '/api/application/upload-document')?.id, 'file_submission');
equal(getRateLimitPolicyForRequest('POST', '/api/files/sign-upload')?.id, 'file_submission');
equal(getRateLimitPolicyForRequest('POST', '/api/billing/student/student-1/manual-payments')?.id, 'payment_creation');
equal(getRateLimitPolicyForRequest('POST', '/api/otp/request')?.id, 'otp');
equal(getRateLimitPolicyForRequest('GET', '/api/health'), undefined);

let now = 1_000;
const middleware = createRateLimitMiddleware({
  enabled: true,
  windowMs: 30_000,
  limits: {
    auth: 2,
    signup: 2,
    schoolRegistration: 2,
    applicantTracking: 2,
    fileSubmission: 2,
    paymentCreation: 2,
    otp: 2,
  },
  now: () => now,
});

let nextCount = 0;
const makeResponse = () => {
  const headers = new Map<string, string>();
  return {
    statusCode: 200,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      headers.set(name, value);
    },
    getHeader(name: string) {
      return headers.get(name);
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
};

const request = {
  method: 'POST',
  path: '/api/auth/login',
  ip: '192.0.2.10',
  headers: {},
};

const first = makeResponse();
middleware(request as any, first as any, () => { nextCount += 1; });
equal(first.getHeader('X-RateLimit-Limit'), '2');
equal(first.getHeader('X-RateLimit-Remaining'), '1');

const second = makeResponse();
middleware(request as any, second as any, () => { nextCount += 1; });
equal(second.getHeader('X-RateLimit-Remaining'), '0');
equal(nextCount, 2);

const blocked = makeResponse();
middleware(request as any, blocked as any, () => { nextCount += 1; });
equal(blocked.statusCode, 429);
equal((blocked.body as any).error, 'Too many requests');
equal((blocked.body as any).rateLimit.policy, 'auth');
ok(Number(blocked.getHeader('Retry-After')) > 0);
equal(nextCount, 2);

now = 31_001;
const afterWindow = makeResponse();
middleware(request as any, afterWindow as any, () => { nextCount += 1; });
equal(afterWindow.statusCode, 200);
equal(nextCount, 3);

if (previousEnabled === undefined) {
  delete process.env.RATE_LIMIT_ENABLED;
} else {
  process.env.RATE_LIMIT_ENABLED = previousEnabled;
}

if (previousWindow === undefined) {
  delete process.env.RATE_LIMIT_WINDOW_MS;
} else {
  process.env.RATE_LIMIT_WINDOW_MS = previousWindow;
}

if (previousAuthLimit === undefined) {
  delete process.env.RATE_LIMIT_AUTH_MAX;
} else {
  process.env.RATE_LIMIT_AUTH_MAX = previousAuthLimit;
}
