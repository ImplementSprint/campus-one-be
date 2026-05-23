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

export const ROLE_PERMISSIONS: Record<CanonicalRole, Permission[]> = {
  super_admin: ['platform.schools.read', 'platform.schools.write', 'audit.read'],
  school_owner: [
    'tenant.bootstrap.read',
    'tenant.settings.read',
    'tenant.settings.write',
    'users.read',
    'users.write',
    'roles.write',
    'academics.read',
    'academics.write',
    'admissions.read',
    'students.read',
    'enrollment.read',
    'grades.read',
    'payments.read',
    'alumni.read',
    'notifications.self.read',
    'audit.read',
  ],
  school_admin: [
    'tenant.bootstrap.read',
    'tenant.settings.read',
    'tenant.settings.write',
    'users.read',
    'users.write',
    'academics.read',
    'academics.write',
    'students.read',
    'enrollment.read',
    'payments.read',
    'notifications.self.read',
    'audit.read',
  ],
  registrar: [
    'tenant.bootstrap.read',
    'academics.read',
    'academics.write',
    'students.read',
    'students.write',
    'enrollment.read',
    'enrollment.write',
    'grades.read',
    'grades.write',
    'notifications.self.read',
    'audit.read',
  ],
  admissions_admin: [
    'tenant.bootstrap.read',
    'admissions.read',
    'admissions.write',
    'students.write',
    'files.read',
    'notifications.self.read',
    'audit.read',
  ],
  student_admin: ['tenant.bootstrap.read', 'students.read', 'students.write', 'users.read', 'notifications.self.read', 'audit.read'],
  professor: ['tenant.bootstrap.read', 'professor.classes.read', 'professor.announcements.write', 'grades.read', 'grades.write', 'notifications.self.read'],
  student: ['tenant.bootstrap.read', 'academics.read', 'enrollment.self.write', 'grades.self.read', 'payments.self.read', 'notifications.self.read', 'files.self.write'],
  applicant: ['tenant.bootstrap.read', 'admissions.self.write', 'notifications.self.read', 'files.self.write'],
  alumni: ['tenant.bootstrap.read', 'alumni.self.write', 'payments.self.read', 'notifications.self.read', 'files.self.write'],
  alumni_admin: ['tenant.bootstrap.read', 'alumni.read', 'alumni.write', 'payments.read', 'files.read', 'notifications.self.read', 'audit.read'],
};

export function normalizeRole(role: string | null | undefined): CanonicalRole | null {
  const normalized = role?.trim().toLowerCase();
  switch (normalized) {
    case 'super_admin':
      return 'super_admin';
    case 'school_owner':
      return 'school_owner';
    case 'school_admin':
    case 'admin':
      return 'school_admin';
    case 'registrar':
      return 'registrar';
    case 'admissions_admin':
    case 'applicant_admin':
      return 'admissions_admin';
    case 'student_admin':
      return 'student_admin';
    case 'professor':
      return 'professor';
    case 'student':
      return 'student';
    case 'applicant':
      return 'applicant';
    case 'alumni':
      return 'alumni';
    case 'alumni_admin':
      return 'alumni_admin';
    default:
      return null;
  }
}

export function getPermissionsForRole(role: CanonicalRole): Permission[] {
  return ROLE_PERMISSIONS[role];
}
