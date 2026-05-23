import { deepEqual, equal } from 'node:assert/strict';
import { getPermissionsForRole, normalizeRole } from './permissions';

equal(normalizeRole('super_admin'), 'super_admin');
equal(normalizeRole('SUPER_ADMIN'), 'super_admin');
equal(normalizeRole('admin'), 'school_admin');
equal(normalizeRole('applicant_admin'), 'admissions_admin');
equal(normalizeRole('unknown'), null);
equal(normalizeRole(undefined), null);

deepEqual(getPermissionsForRole('student'), [
  'tenant.bootstrap.read',
  'academics.read',
  'enrollment.self.write',
  'grades.self.read',
  'payments.self.read',
  'notifications.self.read',
  'files.self.write',
]);

equal(getPermissionsForRole('super_admin').includes('platform.schools.write'), true);
