import { throws } from 'node:assert/strict';

async function run() {
  const originalEnv = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const modulePath = require.resolve('./supabase');
  delete require.cache[modulePath];

  try {
    const { supabase } = require('./supabase') as typeof import('./supabase');
    supabase.schema('public');
    throws(() => supabase.from('profiles'), /SUPABASE_URL/);
  } finally {
    if (originalEnv.SUPABASE_URL === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalEnv.SUPABASE_URL;

    if (originalEnv.SUPABASE_ANON_KEY === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = originalEnv.SUPABASE_ANON_KEY;

    if (originalEnv.SUPABASE_SERVICE_ROLE_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalEnv.SUPABASE_SERVICE_ROLE_KEY;

    delete require.cache[modulePath];
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
