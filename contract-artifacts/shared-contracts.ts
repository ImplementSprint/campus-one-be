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

export type AuthCurrentUser = {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
  activeInstitutionId?: string | null;
};

export type AuthMeResponse = {
  user: AuthCurrentUser;
};

export type SchoolOwnerInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type SchoolOnboardingStatus = 'pending_review' | 'approved' | 'rejected' | 'suspended';

export type SchoolRegistrationAuditAction =
  | 'platform.school.registered'
  | 'platform.school.approved'
  | 'platform.school.rejected'
  | 'platform.school.suspended'
  | 'platform.school.reactivated'
  | 'platform.school.owner_invitation_accepted'
  | 'platform.school.owner_account_created';

export type SchoolSlugAvailabilityReason = 'reserved' | 'invalid' | 'existing';

export type SchoolSlugAvailabilityResponse = {
  slug: string;
  available: boolean;
  reason?: SchoolSlugAvailabilityReason;
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
  ownerInvitationStatus?: SchoolOwnerInvitationStatus;
  onboardingStatus?: SchoolOnboardingStatus;
};

export type SchoolOwnerActivationRequest = {
  token?: string;
  tokenHash?: string;
  password: string;
};

export type SchoolOwnerActivationResponse = {
  message: string;
  school: PublicSchool;
  next: 'tenant_portal_login';
  portalUrl: string;
  ownerInvitationStatus: 'accepted';
  onboardingStatus: SchoolOnboardingStatus;
};

export type SchoolReviewAuditEvent = {
  action: SchoolRegistrationAuditAction;
  actorEmail?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
};

export type SchoolReviewRecord = {
  school: PublicSchool;
  representative: string;
  contactEmail: string;
  contactNumber: string;
  schoolType: string;
  ownerInvitationStatus?: SchoolOwnerInvitationStatus;
  onboardingStatus: SchoolOnboardingStatus;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectionReason?: string | null;
  auditTrail: SchoolReviewAuditEvent[];
};

export type SchoolReviewListResponse = {
  schools: SchoolReviewRecord[];
};

export type SchoolApproveRequest = {
  approverId: string;
  approverEmail?: string;
};

export type SchoolReviewActionRequest = {
  actorEmail?: string;
  reason?: string;
};

export type SchoolAdminUserRole =
  | 'school_owner'
  | 'school_admin'
  | 'registrar'
  | 'professor'
  | 'student'
  | 'alumni_admin';

export type SchoolAdminUserStatus = 'pending' | 'active' | 'inactive';

export type SchoolAdminAcademicResource =
  | 'departments'
  | 'programs'
  | 'subjects'
  | 'curricula'
  | 'sections'
  | 'rooms'
  | 'class-assignments'
  | 'terms';

export type SchoolAdminProfile = {
  id: string;
  name?: string;
  logoUrl?: string | null;
  theme?: Record<string, unknown> | null;
  academicCalendar?: Record<string, unknown> | null;
  gradingScale?: unknown[] | null;
  enrollmentPeriod?: Record<string, unknown> | null;
  admissionsPeriod?: Record<string, unknown> | null;
};

export type SchoolAdminUser = {
  id: string;
  email: string;
  role: SchoolAdminUserRole;
  status: SchoolAdminUserStatus;
  displayName?: string | null;
};

export type SchoolAdminInvitation = {
  id: string;
  email: string;
  role: SchoolAdminUserRole;
  status: SchoolOwnerInvitationStatus;
  displayName?: string | null;
  expiresAt?: string | null;
};

export type SchoolAdminRecord = {
  id: string;
  institutionId: string;
  resourceType: SchoolAdminAcademicResource;
  data: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type SchoolAdminImportResponse = {
  imported: number;
  records: SchoolAdminRecord[];
};

export type StudentDashboardResponse = {
  name: string;
  enrolledCourses: number;
  enrolledUnits: number;
  cartSubjects: number;
  cartUnits: number;
};

export type StudentEnrolledCourse = {
  id: string;
  status?: string | null;
  enrolledAt?: string | null;
  classAssignmentId?: string | null;
  subjectCode?: string | null;
  subjectName?: string | null;
  units: number;
  section?: string | null;
  schedule?: string | null;
  room?: string | null;
};

export type StudentClassScheduleItem = {
  id: string;
  enrollmentId: string;
  subjectCode?: string | null;
  subjectName?: string | null;
  section?: string | null;
  schedule?: string | null;
  room?: string | null;
};

export type StudentCurriculumProgressResponse = {
  studentId: string;
  program?: string | null;
  requiredUnits: number;
  completedUnits: number;
  remainingUnits: number;
  completionPercent: number;
};

export type StudentHoldsDeficienciesResponse = {
  holds: Array<{
    id: string;
    type?: string | null;
    reason?: string | null;
    status?: string | null;
    createdAt?: string | null;
  }>;
  deficiencies: Array<{
    id: string;
    subjectCode?: string | null;
    subjectTitle?: string | null;
    finalGrade?: number | null;
    remarks?: string | null;
  }>;
};

export type StudentAnnouncement = {
  id: string;
  title: string;
  body?: string | null;
  audience?: string | null;
  createdAt?: string | null;
};

export type EnrollmentWorkflowStatus =
  | 'pending_registrar_review'
  | 'pending_adviser_review'
  | 'approved'
  | 'confirmed';

export type EnrollmentWorkflowResponse = {
  success: boolean;
  status: EnrollmentWorkflowStatus;
  request?: Record<string, unknown>;
  enrollments?: unknown[];
  count?: number;
  confirmedAt?: string;
};

export type EnrollmentAddDropRequest = {
  studentId: string;
  addClassAssignmentIds?: string[];
  dropEnrollmentIds?: string[];
  reason?: string;
};

export type EnrollmentIrregularApprovalRequest = {
  studentId: string;
  classAssignmentIds: string[];
  reason: string;
};

export type EnrollmentRegistrarApprovalRequest = {
  requestId: string;
  registrarId: string;
  notes?: string;
};

export type EnrollmentConfirmationRequest = {
  studentId: string;
  enrollmentIds: string[];
};

export type StudentGradeSummaryStatus = 'no_grades' | 'good_standing' | 'has_deficiencies';

export type StudentGradeSummaryResponse = {
  studentName: string;
  program: string;
  term?: string;
  totalUnits: number;
  gradedUnits: number;
  passedUnits: number;
  failedUnits: number;
  gwa: string;
  status: StudentGradeSummaryStatus;
};

export type StudentBillingPaymentStatus = 'unpaid' | 'partial' | 'paid';

export type StudentBillingAssessment = {
  id: string;
  amount: number;
  status?: string | null;
  dueDate?: string | null;
  description?: string | null;
};

export type StudentBillingPayment = {
  id: string;
  amount: number;
  status?: string | null;
  paidAt?: string | null;
  referenceNumber?: string | null;
};

export type StudentBillingBalanceResponse = {
  studentId: string;
  currency: 'PHP';
  totalAssessed: number;
  totalPaid: number;
  balanceDue: number;
  paymentStatus: StudentBillingPaymentStatus;
  paymentMode: 'manual';
  assessments: StudentBillingAssessment[];
  recentPayments: StudentBillingPayment[];
};

export type ManualStudentPaymentRequest = {
  amount: number;
  referenceNumber: string;
  paidAt?: string;
  notes?: string;
};

export type ManualStudentPaymentResponse = {
  id: string;
  studentId: string;
  amount: number;
  status: 'pending_reconciliation' | 'posted' | 'paid' | string;
  paidAt?: string | null;
  referenceNumber?: string | null;
};

export type StudentPaymentReceiptResponse = ManualStudentPaymentResponse & {
  receiptNumber?: string | null;
  currency: 'PHP';
};

export type BillingReconciliationQueueResponse = {
  mode: 'manual';
  payments: ManualStudentPaymentResponse[];
};
