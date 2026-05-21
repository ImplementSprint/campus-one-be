import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { TenantContext } from './tenant-context';

function parseSchoolSlugFromHost(host?: string): string | undefined {
  if (!host) return undefined;
  const hostname = host.split(':')[0]?.toLowerCase();
  if (!hostname) return undefined;
  const reserved = new Set(['localhost', '127', 'api', 'app', 'www', 'campusone']);
  const firstLabel = hostname.split('.')[0];
  return firstLabel && !reserved.has(firstLabel) ? firstLabel : undefined;
}

@Injectable()
export class TenantResolutionMiddleware implements NestMiddleware {
  use(req: Request & { tenantContext?: TenantContext }, _res: Response, next: NextFunction) {
    const institutionId = req.header('x-institution-id') ?? undefined;
    const schoolSlug = req.header('x-school-slug') ?? parseSchoolSlugFromHost(req.header('host'));

    req.tenantContext = {
      institutionId,
      schoolSlug,
      source: req.header('x-school-slug') || institutionId ? 'mobile-header' : schoolSlug ? 'subdomain' : 'unknown',
    };

    next();
  }
}
