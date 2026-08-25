import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = (typeof window !== 'undefined' && window.NEXUS_CONFIG?.SUPABASE_URL) || 'https://zfvkvrhuovvbfbrutpph.supabase.co';
const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.NEXUS_CONFIG?.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmdmt2cmh1b3Z2YmZicnV0cHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzIyODQsImV4cCI6MjEwMjcwODI4NH0.M-WK1bgZDLXcuMTldMSwptx5XRpRnLAi-BxMFEoph4U';

function initializeCanonicalClient() {
  if (typeof window !== 'undefined' && window.__NEXUS_CANONICAL_SUPABASE_CLIENT__) {
    return window.__NEXUS_CANONICAL_SUPABASE_CLIENT__;
  }

  const isAdminSurface = typeof window !== 'undefined' && /(?:^|\/)admin(?:-login|\.html)|(?:^|\/)super-admin\.html$/i.test(window.location.pathname);
  const authStorage = typeof window !== 'undefined'
    ? (isAdminSurface ? window.sessionStorage : window.localStorage)
    : undefined;

  const clientConfig = {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: authStorage
    }
  };

  let clientInstance = null;
  if (typeof window !== 'undefined' && window.supabase?.createClient) {
    clientInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientConfig);
  } else {
    clientInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, clientConfig);
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
