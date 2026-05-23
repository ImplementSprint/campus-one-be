import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const REQUEST_ID_HEADER = 'x-request-id';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }
}

function readHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function normalizeCorrelationId(value: string | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.length > 128 ? trimmed.slice(0, 128) : trimmed;
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingCorrelationId = normalizeCorrelationId(readHeader(req.headers[CORRELATION_ID_HEADER]));
  const incomingRequestId = normalizeCorrelationId(readHeader(req.headers[REQUEST_ID_HEADER]));
  const correlationId = incomingCorrelationId ?? incomingRequestId ?? randomUUID();

  req.correlationId = correlationId;
  res.setHeader('X-Correlation-Id', correlationId);
  next();
}
