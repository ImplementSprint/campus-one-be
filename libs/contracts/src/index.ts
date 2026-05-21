export type ApiHealth = {
  status: 'ok';
  service: string;
};

export type SelectedSchool = {
  schoolId: string;
  schoolSlug: string;
  displayName: string;
  apiBaseUrl: string;
};

export type PublicSchool = {
  schoolId: string;
  schoolSlug: string;
  displayName: string;
  schoolType?: string | null;
  status?: string | null;
};

export type TenantHeaders = {
  'X-School-Slug'?: string;
  'X-Institution-Id'?: string;
};

export type TenantResolutionSource = 'mobile-header' | 'subdomain' | 'session' | 'platform' | 'unknown';

export type TenantContextContract = {
  institutionId?: string;
  schoolSlug?: string;
  source: TenantResolutionSource;
};
