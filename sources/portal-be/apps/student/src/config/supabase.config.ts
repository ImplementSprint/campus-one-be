import { createClient } from '@supabase/supabase-js';

type SchemaSupabaseClient = ReturnType<ReturnType<typeof createClient>['schema']>;

const supabaseInstances = new Map<string, SchemaSupabaseClient>();

/**
 * Returns a singleton Supabase client using service-role credentials.
 * Uses env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */
export function getSupabaseClient(schema = 'student'): SchemaSupabaseClient {
  const existing = supabaseInstances.get(schema);
  if (existing) {
    return existing;
  }

  {
    const url = process.env.SUPABASE_URL;
    // Use service role key if available, fall back to anon key
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error(
        '[Student] SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env',
      );
    }

    const supabaseInstance = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }).schema(schema) as SchemaSupabaseClient;

    supabaseInstances.set(schema, supabaseInstance);
    return supabaseInstance;
  }
}
