/**
 * Application Module Manifest
 *
 * Following the Architecture Plan §3.1 Module Manifest pattern.
 * The platform service reads all manifests at boot to build its registry.
 */
export const ApplicationManifest = {
  id: 'application',
  version: '1.0.0',
  displayName: 'Application',
  description:
    'Handles applicant application processing, admission workflows, and application status management.',
  routes: ['/api/application'],
  requiredServices: ['platform'],
  dbSchema: 'application',
  featureFlags: [
    'application.health_check',   // Service health verification endpoint
    'application.list',           // List all submitted applications
  ],
  healthEndpoint: '/api/application/health',
  port: process.env.APPLICATION_PORT ?? '4002',
} as const;
