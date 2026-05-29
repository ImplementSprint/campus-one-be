import type { NextFunction, Request, Response } from 'express';

type RateLimitPolicyId =
  | 'auth'
  | 'signup'
  | 'school_registration'
  | 'applicant_tracking'
  | 'file_submission'
  | 'payment_creation'
  | 'otp';

type RateLimitBucket = keyof RateLimitOptions['limits'];

export type RateLimitPolicy = {
  id: RateLimitPolicyId;
  bucket: RateLimitBucket;
  methods: string[];
  patterns: RegExp[];
};

export type RateLimitOptions = {
  enabled: boolean;
  windowMs: number;
  limits: {
    auth: number;
    signup: number;
    schoolRegistration: number;
    applicantTracking: number;
    fileSubmission: number;
    paymentCreation: number;
    otp: number;
  };
  now?: () => number;
};

type WindowEntry = {
  count: number;
  resetAt: number;
};

const policies: RateLimitPolicy[] = [
  {
    id: 'auth',
    bucket: 'auth',
    methods: ['POST'],
    patterns: [/^\/api\/auth\/login$/, /^\/api\/auth\/signin$/],
  },
  {
    id: 'signup',
    bucket: 'signup',
    methods: ['POST'],
    patterns: [/^\/api\/auth\/signup$/],
  },
  {
    id: 'school_registration',
    bucket: 'schoolRegistration',
    methods: ['POST'],
    patterns: [/^\/api\/platform\/schools\/register$/],
  },
  {
    id: 'applicant_tracking',
    bucket: 'applicantTracking',
    methods: ['POST'],
    patterns: [/^\/api\/application\/track$/],
  },
  {
    id: 'file_submission',
    bucket: 'fileSubmission',
    methods: ['POST'],
    patterns: [/^\/api\/application\/upload-document$/, /^\/api\/files\/(sign-upload|upload|sign-download)$/],
  },
  {
    id: 'payment_creation',
    bucket: 'paymentCreation',
    methods: ['POST'],
    patterns: [/^\/api\/billing\/student\/[^/]+\/manual-payments$/, /^\/api\/payments(\/.*)?$/],
  },
  {
    id: 'otp',
    bucket: 'otp',
    methods: ['POST'],
    patterns: [/^\/api\/otp\/(request|verify)$/, /^\/api\/auth\/otp\/(request|verify)$/],
  },
];

export function resolveRateLimitOptions(): RateLimitOptions {
  return {
    enabled: process.env.RATE_LIMIT_ENABLED?.trim().toLowerCase() !== 'false',
    windowMs: positiveNumber(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
    limits: {
      auth: positiveNumber(process.env.RATE_LIMIT_AUTH_MAX, 10),
      signup: positiveNumber(process.env.RATE_LIMIT_SIGNUP_MAX, 5),
      schoolRegistration: positiveNumber(process.env.RATE_LIMIT_SCHOOL_REGISTRATION_MAX, 10),
      applicantTracking: positiveNumber(process.env.RATE_LIMIT_APPLICANT_TRACKING_MAX, 30),
      fileSubmission: positiveNumber(process.env.RATE_LIMIT_FILE_SUBMISSION_MAX, 10),
      paymentCreation: positiveNumber(process.env.RATE_LIMIT_PAYMENT_CREATION_MAX, 10),
      otp: positiveNumber(process.env.RATE_LIMIT_OTP_MAX, 5),
    },
  };
}

export function getRateLimitPolicyForRequest(method: string, path: string) {
  const normalizedMethod = method.toUpperCase();
  const normalizedPath = normalizePath(path);
  return policies.find(
    (policy) =>
      policy.methods.includes(normalizedMethod) &&
      policy.patterns.some((pattern) => pattern.test(normalizedPath)),
  );
}

export function createRateLimitMiddleware(options = resolveRateLimitOptions()) {
  const windows = new Map<string, WindowEntry>();
  const now = options.now ?? Date.now;

  return (req: Request, res: Response, next: NextFunction) => {
    if (!options.enabled) return next();

    const policy = getRateLimitPolicyForRequest(req.method, req.path || req.url);
    if (!policy) return next();

    const limit = options.limits[policy.bucket];
    const currentTime = now();
    const key = `${policy.id}:${clientKey(req)}`;
    const existing = windows.get(key);
    const entry = existing && existing.resetAt > currentTime
      ? existing
      : { count: 0, resetAt: currentTime + options.windowMs };

    entry.count += 1;
    windows.set(key, entry);

    const remaining = Math.max(limit - entry.count, 0);
    const retryAfterSeconds = Math.max(Math.ceil((entry.resetAt - currentTime) / 1000), 1);

    res.setHeader('X-RateLimit-Policy', policy.id);
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(entry.resetAt));

    if (entry.count > limit) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        error: 'Too many requests',
        message: 'Please wait before retrying this request.',
        rateLimit: {
          policy: policy.id,
          retryAfterSeconds,
        },
      });
    }

    return next();
  };
}

function normalizePath(path: string) {
  return path.split('?')[0].replace(/\/+$/, '') || '/';
}

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientKey(req: Request) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
