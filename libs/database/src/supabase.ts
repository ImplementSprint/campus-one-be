import { createClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { validateRuntimeConfig } from '../../config/src/runtime-config';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ipv4Agent = new Agent({ connect: { family: 4 } });
const ipv4Fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  undiciFetch(input as string, { ...(init as any), dispatcher: ipv4Agent }) as unknown as Promise<Response>;

const runtimeConfig = validateRuntimeConfig();

export const supabase = createClient(runtimeConfig.supabaseUrl, runtimeConfig.supabaseAnonKey, {
  global: { fetch: ipv4Fetch },
});

export const supabaseAdmin = createClient(
  runtimeConfig.supabaseUrl,
  runtimeConfig.supabaseServiceRoleKey,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: ipv4Fetch },
  },
);
