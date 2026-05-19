/**
 * Student Module Manifest
 *
 * Following the Architecture Plan §3.1 Module Manifest pattern.
 * The platform service reads all manifests at boot to build its registry.
 */
export const StudentManifest = {
  id: 'student',
  version: '1.0.0',
  displayName: 'Student',
  description:
    'Manage student accounts, enrollment status, activation/deactivation, and academic profile data.',
  routes: ['/api/v1/student'],
  requiredServices: ['platform'],
  dbSchema: 'academics',
  featureFlags: [
    'student.directory',          // Search and view all active student profiles
    'student.enrollment_status',  // View and update enrollment status (active/inactive)
    'student.activate',           // Activate a student account
    'student.deactivate',         // Deactivate a student account
  ],
  healthEndpoint: '/api/v1/student/health',
  port: process.env.STUDENT_PORT ?? '4004',
} as const;
