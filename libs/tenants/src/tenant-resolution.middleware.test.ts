import { deepEqual } from 'node:assert/strict';
import { resolveTenantContext } from './tenant-resolution.middleware';

const mobileContext = resolveTenantContext({
  host: 'api.campusone.com',
  schoolSlugHeader: 'san-beda',
  institutionIdHeader: 'institution-123',
});

deepEqual(mobileContext, {
  institutionId: 'institution-123',
  schoolSlug: 'san-beda',
  isPlatformRoute: false,
  source: 'mobile-header',
});

const subdomainContext = resolveTenantContext({
  host: 'demo.itsandbox.site',
});

deepEqual(subdomainContext, {
  institutionId: undefined,
  schoolSlug: 'demo',
  isPlatformRoute: false,
  source: 'subdomain',
});

const reservedHostContext = resolveTenantContext({
  host: 'api.campusone.com',
  path: '/api/health',
});

deepEqual(reservedHostContext, {
  institutionId: undefined,
  schoolSlug: undefined,
  isPlatformRoute: true,
  source: 'platform',
});

const appHostContext = resolveTenantContext({
  host: 'app.itsandbox.site',
  path: '/api/auth/me',
});

deepEqual(appHostContext, {
  institutionId: undefined,
  schoolSlug: undefined,
  isPlatformRoute: true,
  source: 'platform',
});

const localHostContext = resolveTenantContext({
  host: 'localhost:4000',
  path: '/api/health',
});

deepEqual(localHostContext, {
  institutionId: undefined,
  schoolSlug: undefined,
  isPlatformRoute: true,
  source: 'platform',
});

const podIpHealthContext = resolveTenantContext({
  host: '10.104.0.170:4000',
  path: '/api/health',
});

deepEqual(podIpHealthContext, {
  institutionId: undefined,
  schoolSlug: undefined,
  isPlatformRoute: true,
  source: 'platform',
});

const normalizedMobileContext = resolveTenantContext({
  schoolSlugHeader: ' San-Beda ',
});

deepEqual(normalizedMobileContext, {
  institutionId: undefined,
  schoolSlug: 'san-beda',
  isPlatformRoute: false,
  source: 'mobile-header',
});

const reservedHostTenantPathContext = resolveTenantContext({
  host: 'api.itsandbox.site',
  path: '/api/enrollment/offerings',
});

deepEqual(reservedHostTenantPathContext, {
  institutionId: undefined,
  schoolSlug: undefined,
  isPlatformRoute: false,
  source: 'unknown',
});
