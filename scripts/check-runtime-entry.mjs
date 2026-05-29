import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

process.env.NODE_ENV ||= 'test';
process.env.SUPABASE_URL ||= 'https://campus-one-test.supabase.co';
process.env.SUPABASE_ANON_KEY ||= 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'test-service-role-key';
process.env.JWT_ACCESS_TOKEN_SECRET ||= 'runtime-check-secret-with-enough-length';

require('../dist/apps/gateway/src/app.module.js');
console.log('Runtime entry module resolved.');
