export type RuntimeConfigEnv = Record<string, string | undefined>;

export type RuntimeConfig = {
  nodeEnv: string;
  port: number;
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey: string;
  appBaseDomain?: string;
  schoolPortalBaseDomain?: string;
  publicLmsUrl?: string;
  allowedOrigins: string[] | true;
};

const REQUIRED_ENV_KEYS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'] as const;

function splitCsv(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function requireEnv(env: RuntimeConfigEnv, key: (typeof REQUIRED_ENV_KEYS)[number]): string {
  const value = env[key]?.trim();
  if (!value || value.includes('placeholder') || value.startsWith('replace-with-')) {
    throw new Error(`[runtime-config] Missing required environment variable: ${key}`);
  }
  return value;
}

export function getAllowedOrigins(env: RuntimeConfigEnv): string[] | true {
  const explicit = splitCsv(env.ALLOWED_ORIGINS);
  if (explicit.length > 0) return explicit;

  const legacy = [
    ...splitCsv(env.WEB_LMS_ORIGIN),
    ...splitCsv(env.WEB_SCHOOL_ORIGIN),
    ...splitCsv(env.MOBILE_DEV_ORIGIN),
    ...splitCsv(env.FRONTEND_ORIGIN),
  ];

  if (legacy.length > 0) return Array.from(new Set(legacy));

  return env.NODE_ENV === 'production' ? [] : true;
}

export function validateRuntimeConfig(env: RuntimeConfigEnv = process.env): RuntimeConfig {
  const rawPort = env.PORT?.trim() || '4000';
  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`[runtime-config] PORT must be a valid TCP port, received: ${rawPort}`);
  }

  return {
    nodeEnv: env.NODE_ENV?.trim() || 'development',
    port,
    supabaseUrl: requireEnv(env, 'SUPABASE_URL'),
    supabaseAnonKey: requireEnv(env, 'SUPABASE_ANON_KEY'),
    supabaseServiceRoleKey: requireEnv(env, 'SUPABASE_SERVICE_ROLE_KEY'),
    appBaseDomain: env.APP_BASE_DOMAIN?.trim() || undefined,
    schoolPortalBaseDomain: env.SCHOOL_PORTAL_BASE_DOMAIN?.trim() || undefined,
    publicLmsUrl: env.PUBLIC_LMS_URL?.trim() || undefined,
    allowedOrigins: getAllowedOrigins(env),
  };
}
