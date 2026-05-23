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

export type CanonicalRole =
  | 'super_admin'
  | 'school_owner'
  | 'school_admin'
  | 'registrar'
  | 'admissions_admin'
  | 'student_admin'
  | 'professor'
  | 'student'
  | 'applicant'
  | 'alumni'
  | 'alumni_admin';

export type Permission =
  | 'platform.schools.read'
  | 'platform.schools.write'
  | 'tenant.bootstrap.read'
  | 'tenant.settings.read'
  | 'tenant.settings.write'
  | 'users.read'
  | 'users.write'
  | 'roles.write'
  | 'academics.read'
  | 'academics.write'
  | 'admissions.self.write'
  | 'admissions.read'
  | 'admissions.write'
  | 'students.read'
  | 'students.write'
  | 'enrollment.self.write'
  | 'enrollment.read'
  | 'enrollment.write'
  | 'grades.self.read'
  | 'grades.read'
  | 'grades.write'
  | 'professor.classes.read'
  | 'professor.announcements.write'
  | 'payments.self.read'
  | 'payments.read'
  | 'payments.write'
  | 'alumni.self.write'
  | 'alumni.read'
  | 'alumni.write'
  | 'notifications.self.read'
  | 'notifications.write'
  | 'files.self.write'
  | 'files.read'
  | 'audit.read'
  | 'audit.write';

export type TenantMembershipContract = {
  status: 'not_applicable' | 'verified';
  reason?: string;
};

export type CurrentUserContract = {
  id: string;
  email: string;
  role: CanonicalRole;
  permissions: Permission[];
  activeInstitution?: {
    id: string;
    schoolSlug: string;
    status: string;
    name?: string;
  };
  tenantMembership: TenantMembershipContract;
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
  onboarding: {
    currentStep: string;
    progress: number;
  };
  ownerInvitation: {
    id: string;
    email: string;
    status: string;
    expiresAt: string;
  };
  next?: string;
};

export type PlatformSchoolStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'suspended';

export type PlatformSchoolReviewRecord = {
  id: string;
  name: string;
  representative: string;
  email: string;
  contactNumber: string;
  schoolType: string;
  targetSubdomain: string;
  status: PlatformSchoolStatus | string;
  setupProgress: number;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  suspendedAt?: string | null;
  suspendedBy?: string | null;
  reactivatedAt?: string | null;
  reactivatedBy?: string | null;
  ownerActivationStatus: string;
  createdAt: string;
  updatedAt: string;
};

export type PlatformSchoolListResponse = {
  schools: PlatformSchoolReviewRecord[];
};

export type PlatformSchoolReviewActionResponse = {
  message: string;
  school: PlatformSchoolReviewRecord;
};
