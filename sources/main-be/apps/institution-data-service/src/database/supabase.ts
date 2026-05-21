import { createClient } from '@supabase/supabase-js';
import { Agent, fetch as undiciFetch } from 'undici';

const ipv4Agent = new Agent({ connect: { family: 4 } });
const ipv4Fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  undiciFetch(input as string, { ...(init as any), dispatcher: ipv4Agent }) as unknown as Promise<Response>;

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: ipv4Fetch },
  },
);
