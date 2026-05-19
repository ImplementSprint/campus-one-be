/**
 * Enrollment Module Manifest
 *
 * Following the Architecture Plan §3.1 Module Manifest pattern.
 * The platform service reads all manifests at boot to build its registry.
 */
export const EnrollmentManifest = {
  id: 'enrollment',
  version: '1.0.0',
  displayName: 'Enrollment',
  description:
    'Manage subject offerings, student enrollment submission, enrollment status tracking, and enrollment history.',
  routes: ['/api/enrollment'],
  requiredServices: ['platform'],
  dbSchema: 'enrollment',
  featureFlags: [
    'enrollment.get_offerings',   // Fetch available subject offerings filtered by program and year level
    'enrollment.submit',          // Submit a student enrollment with selected class assignments
    'enrollment.get_status',      // Get current enrollment status for a student
    'enrollment.get_history',     // Get full enrollment history for a student
  ],
  healthEndpoint: '/api/enrollment/offerings',
  port: process.env.ENROLLMENT_PORT ?? '4001',
} as const;
