import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { TenantContext } from './tenant-context';
import { TenantResolutionService } from './tenant-resolution.service';

type TenantResolutionInput = {
  host?: string;
  path?: string;
  schoolSlugHeader?: string;
  institutionIdHeader?: string;
};

export const RESERVED_TENANT_SLUGS = new Set([
  'api',
  'app',
  'www',
  'admin',
  'status',
  'portal',
  'campus',
  'localhost',
  '127',
  'campusone',
]);

export function normalizeSchoolSlug(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized || undefined;
}

function parseSchoolSlugFromHost(host?: string): string | undefined {
  if (!host) return undefined;
  const hostname = host.split(':')[0]?.toLowerCase();
  if (!hostname) return undefined;
  const firstLabel = hostname.split('.')[0];
  return firstLabel && !RESERVED_TENANT_SLUGS.has(firstLabel) ? firstLabel : undefined;
}

function isPlatformHost(host?: string): boolean {
  if (!host) return false;
  const hostname = host.split(':')[0]?.toLowerCase();
  const firstLabel = hostname?.split('.')[0];
  return !!firstLabel && RESERVED_TENANT_SLUGS.has(firstLabel);
}

function isApprovedPlatformPath(path?: string): boolean {
  if (!path) return false;
  const normalizedPath = path.startsWith('/api/') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;
  return [
    '/api/health',
    '/api/auth',
    '/api/schools',
    '/api/platform',
  ].some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`));
}

export function resolveTenantContext(input: TenantResolutionInput): TenantContext {
  const institutionId = input.institutionIdHeader?.trim() || undefined;
  const schoolSlug = normalizeSchoolSlug(input.schoolSlugHeader) || parseSchoolSlugFromHost(input.host);
  const isPlatformRoute = !schoolSlug && isPlatformHost(input.host) && isApprovedPlatformPath(input.path);

  return {
    institutionId,
    schoolSlug,
    isPlatformRoute,
    source: input.schoolSlugHeader || institutionId
      ? 'mobile-header'
      : schoolSlug
        ? 'subdomain'
        : isPlatformRoute
          ? 'platform'
          : 'unknown',
  };
}

@Injectable()
export class TenantResolutionMiddleware implements NestMiddleware {
  constructor(private readonly tenantResolutionService: TenantResolutionService) {}

  async use(req: Request & { tenantContext?: TenantContext }, _res: Response, next: NextFunction) {
    const baseContext = resolveTenantContext({
      host: req.header('host'),
      path: req.originalUrl ?? req.url,
      schoolSlugHeader: req.header('x-school-slug') ?? undefined,
      institutionIdHeader: req.header('x-institution-id') ?? undefined,
    });

    try {
      req.tenantContext = await this.tenantResolutionService.resolveTenantContext(baseContext);
      next();
    } catch (error) {
      next(error);
    }
  }
}
