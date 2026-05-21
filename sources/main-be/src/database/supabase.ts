import { createClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const ipv4Agent = new Agent({ connect: { family: 4 } });
const ipv4Fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  undiciFetch(input as string, { ...(init as any), dispatcher: ipv4Agent }) as unknown as Promise<Response>;

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Regular client — used for user-facing auth operations (signInWithPassword)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: ipv4Fetch },
});

// Admin client — bypasses RLS; used for createUser and super_admins table writes
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: ipv4Fetch },
});
