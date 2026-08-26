import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Canonical production Supabase configuration.
// Use the project's active publishable key instead of any stale key embedded in
// individual HTML pages. This prevents an old page-level API key from causing
// "Invalid API key" authentication failures after a key rotation/deployment.
const SUPABASE_URL = 'https://zfvkvrhuovvbfbrutpph.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_bFbeqpwaWmp0aioDVSkLAg_J7X4lzWk';

function initializeCanonicalClient() {
  if (typeof window !== 'undefined' && window.__NEXUS_CANONICAL_SUPABASE_CLIENT__) {
    return window.__NEXUS_CANONICAL_SUPABASE_CLIENT__;
  }

  const clientConfig = {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    }
  };

  let clientInstance = null;
  if (typeof window !== 'undefined' && window.supabase?.createClient) {
    clientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, clientConfig);
  } else {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, clientConfig);
  }

  if (typeof window !== 'undefined' && clientInstance) {
    window.__NEXUS_CANONICAL_SUPABASE_CLIENT__ = clientInstance;
    window.supabaseClient = clientInstance;
    window.db = clientInstance;
  }

  return clientInstance;
}

export const supabase = initializeCanonicalClient();
export default supabase;
