import { createClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';

const ipv4Agent = new Agent({ connect: { family: 4 } });
const ipv4Fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  undiciFetch(input as string, { ...(init as any), dispatcher: ipv4Agent }) as unknown as Promise<Response>;

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: ipv4Fetch },
});
