import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { TenantContext } from './tenant-context';

type TenantResolutionInput = {
  host?: string;
  schoolSlugHeader?: string;
  institutionIdHeader?: string;
};

function parseSchoolSlugFromHost(host?: string): string | undefined {
  if (!host) return undefined;
  const hostname = host.split(':')[0]?.toLowerCase();
  if (!hostname) return undefined;
  const reserved = new Set(['localhost', '127', 'api', 'app', 'www', 'campusone']);
  const firstLabel = hostname.split('.')[0];
  return firstLabel && !reserved.has(firstLabel) ? firstLabel : undefined;
}

export function resolveTenantContext(input: TenantResolutionInput): TenantContext {
  const institutionId = input.institutionIdHeader || undefined;
  const schoolSlug = input.schoolSlugHeader || parseSchoolSlugFromHost(input.host);

  return {
    institutionId,
    schoolSlug,
    source: input.schoolSlugHeader || institutionId ? 'mobile-header' : schoolSlug ? 'subdomain' : 'unknown',
  };
}

@Injectable()
export class TenantResolutionMiddleware implements NestMiddleware {
  use(req: Request & { tenantContext?: TenantContext }, _res: Response, next: NextFunction) {
    req.tenantContext = resolveTenantContext({
      host: req.header('host'),
      schoolSlugHeader: req.header('x-school-slug') ?? undefined,
      institutionIdHeader: req.header('x-institution-id') ?? undefined,
    });

    next();
  }
}
