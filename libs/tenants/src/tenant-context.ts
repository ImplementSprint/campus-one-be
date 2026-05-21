export type TenantContext = {
  institutionId?: string;
  schoolSlug?: string;
  source: 'mobile-header' | 'subdomain' | 'session' | 'platform' | 'unknown';
};

export const TENANT_CONTEXT_KEY = 'tenantContext';
