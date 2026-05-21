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
  source: 'mobile-header',
});

const subdomainContext = resolveTenantContext({
  host: 'mapua.campusone.com',
});

deepEqual(subdomainContext, {
  institutionId: undefined,
  schoolSlug: 'mapua',
  source: 'subdomain',
});

const reservedHostContext = resolveTenantContext({
  host: 'api.campusone.com',
});

deepEqual(reservedHostContext, {
  institutionId: undefined,
  schoolSlug: undefined,
  source: 'unknown',
});
