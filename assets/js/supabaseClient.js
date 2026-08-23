import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = (typeof window !== 'undefined' && window.NEXUS_CONFIG?.SUPABASE_URL) || 'https://zfvkvrhuovvbfbrutpph.supabase.co';
const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.NEXUS_CONFIG?.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmdmt2cmh1b3Z2YmZicnV0cHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzIyODQsImV4cCI6MjEwMjcwODI4NH0.M-WK1bgZDLXcuMTldMSwptx5XRpRnLAi-BxMFEoph4U';

export const supabase = (typeof window !== 'undefined' && window.supabase?.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage
      }
    })
  : createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    });

if (typeof window !== 'undefined') {
  window.supabaseClient = supabase;
}

