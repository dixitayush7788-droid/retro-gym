import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Canonical production Supabase configuration.
const SUPABASE_URL = 'https://zfvkvrhuovvbfbrutpph.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_bFbeqpwaWmp0aioDVSkLAg_J7X4lzWk';

function isAdminSurface() {
  if (typeof window === 'undefined') return false;
  const path = String(window.location.pathname || '').toLowerCase();
  return /(?:^|\/)(?:admin|admin-login|super-admin|reset-password)\.html$/.test(path);
}

function initializeCanonicalClient() {
  if (typeof window !== 'undefined' && window.__NEXUS_CANONICAL_SUPABASE_CLIENT__) {
    return window.__NEXUS_CANONICAL_SUPABASE_CLIENT__;
  }

  const clientConfig = {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      ...(isAdminSurface() ? { storageKey: 'nexus-admin-auth' } : {})
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
