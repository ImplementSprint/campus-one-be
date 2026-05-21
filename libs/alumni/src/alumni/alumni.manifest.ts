/**
 * Alumni Module Manifest
 *
 * Following the Architecture Plan Â§3.1 Module Manifest pattern.
 * The platform service reads all manifests at boot to build its registry.
 */
export const AlumniManifest = {
  id: 'alumni',
  version: '1.0.0',
  displayName: 'Alumni',
  description:
    'Manage alumni registrations, official document requests, and graduation event tracking.',
  routes: ['/api/v1/alumni', '/api/v1/alumni/records'],
  requiredServices: ['platform', 'notifications'],
  dbSchema: 'alumni',
  featureFlags: [
    'alumni.legacy_registration',   // Allows registration without a prior student record
    'alumni.record_requests',       // Document request hub (TOR, Diploma, etc.)
    'alumni.kafka_graduation_sync', // Listens to graduation.verified.v1 Kafka topic
  ],
  healthEndpoint: '/api/v1/alumni/health',
  port: process.env.ALUMNI_PORT ?? '3002',
} as const;


