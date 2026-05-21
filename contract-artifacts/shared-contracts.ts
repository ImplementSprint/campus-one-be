// Generated from campus-one-backend/libs/contracts/src/index.ts.
// Do not edit by hand; run `npm run contracts:generate` in campus-one-backend.

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

export type SchoolRegistrationRequest = {
  name: string;
  representative: string;
  email: string;
  contactNumber: string;
  schoolType: string;
  targetSubdomain: string;
};

export type SchoolRegistrationResponse = {
  message: string;
  school: PublicSchool;
  next?: string;
};
