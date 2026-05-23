import { deepEqual, equal, throws } from 'node:assert/strict';
import { getAllowedOrigins, validateRuntimeConfig } from './runtime-config';

const baseEnv = {
  NODE_ENV: 'test',
  PORT: '4100',
  SUPABASE_URL: 'https://campus-one.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};

const config = validateRuntimeConfig({
  ...baseEnv,
  ALLOWED_ORIGINS: 'http://localhost:3000, http://localhost:3001',
  APP_BASE_DOMAIN: 'itsandbox.site',
  SCHOOL_PORTAL_BASE_DOMAIN: 'itsandbox.site',
  PUBLIC_LMS_URL: 'https://itsandbox.site',
});

equal(config.port, 4100);
equal(config.supabaseUrl, baseEnv.SUPABASE_URL);
equal(config.supabaseAnonKey, baseEnv.SUPABASE_ANON_KEY);
equal(config.supabaseServiceRoleKey, baseEnv.SUPABASE_SERVICE_ROLE_KEY);
deepEqual(config.allowedOrigins, ['http://localhost:3000', 'http://localhost:3001']);
equal(config.appBaseDomain, 'itsandbox.site');

throws(
  () => validateRuntimeConfig({ ...baseEnv, SUPABASE_SERVICE_ROLE_KEY: 'replace-with-service-role-key' }),
  /SUPABASE_SERVICE_ROLE_KEY/,
);

throws(() => validateRuntimeConfig({ ...baseEnv, PORT: 'not-a-port' }), /PORT/);

deepEqual(
  getAllowedOrigins({
    WEB_LMS_ORIGIN: 'http://localhost:3000',
    WEB_SCHOOL_ORIGIN: 'http://localhost:3001',
    FRONTEND_ORIGIN: 'http://localhost:3000',
  }),
  ['http://localhost:3000', 'http://localhost:3001'],
);

equal(getAllowedOrigins({ NODE_ENV: 'development' }), true);
deepEqual(getAllowedOrigins({ NODE_ENV: 'production' }), []);
