import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client using service-role credentials.
 * Uses env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        '[Alumni] SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env',
      );
    }

    supabaseInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseInstance;
}
