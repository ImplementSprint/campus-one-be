import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { validateRuntimeConfig } from '../../config/src/runtime-config';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ipv4Agent = new Agent({ connect: { family: 4 } });
const ipv4Fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  undiciFetch(input as string, { ...(init as any), dispatcher: ipv4Agent }) as unknown as Promise<Response>;

let cachedSupabase: SupabaseClient | undefined;
let cachedSupabaseAdmin: SupabaseClient | undefined;

function createSupabaseClient(): SupabaseClient {
  const runtimeConfig = validateRuntimeConfig();

  return createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
    global: { fetch: ipv4Fetch },
  });
}

function createSupabaseAdminClient(): SupabaseClient {
  const runtimeConfig = validateRuntimeConfig();

  return createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: ipv4Fetch },
  });
}

function lazyClient(getClient: () => SupabaseClient): SupabaseClient {
  const overrides = new Map<PropertyKey, unknown>();

  return new Proxy({} as SupabaseClient, {
    get(_target, property) {
      if (overrides.has(property)) return overrides.get(property);
      if (property === 'then') return undefined;

      if (property === 'schema') {
        return (schema: string) => lazyClient(() => getClient().schema(schema) as unknown as SupabaseClient);
      }

      const client = getClient();
      const value = client[property as keyof SupabaseClient];
      return typeof value === 'function' ? value.bind(client) : value;
    },
    set(_target, property, value) {
      overrides.set(property, value);
      return true;
    },
  });
}

export const supabase = lazyClient(() => {
  cachedSupabase ??= createSupabaseClient();
  return cachedSupabase;
});

export const supabaseAdmin = lazyClient(() => {
  cachedSupabaseAdmin ??= createSupabaseAdminClient();
  return cachedSupabaseAdmin;
});
