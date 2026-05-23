export type TenantContext = {
  institutionId?: string;
  schoolSlug?: string;
  resolvedInstitution?: {
    id: string;
    schoolSlug: string;
    status: string;
    name?: string;
  };
  isPlatformRoute: boolean;
  source: 'mobile-header' | 'subdomain' | 'session' | 'platform' | 'unknown';
};

export const TENANT_CONTEXT_KEY = 'tenantContext';
