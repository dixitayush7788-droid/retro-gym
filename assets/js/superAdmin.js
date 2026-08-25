import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { supabase } from './supabaseClient.js';

const SUPABASE_URL = (typeof window !== 'undefined' && window.NEXUS_CONFIG?.SUPABASE_URL) || 'https://zfvkvrhuovvbfbrutpph.supabase.co';
const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.NEXUS_CONFIG?.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmdmt2cmh1b3Z2YmZicnV0cHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzIyODQsImV4cCI6MjEwMjcwODI4NH0.M-WK1bgZDLXcuMTldMSwptx5XRpRnLAi-BxMFEoph4U';

let cachedSuperAdminContext = null;
let bootstrapPromise = null;

export function withTimeout(promise, timeoutMs = 7000, operationName = 'Operation') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`[TIMEOUT] ${operationName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function createIsolatedAuthClient() {
  const opts = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  };

  if (typeof window !== 'undefined' && window.supabase?.createClient) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
}

export function generateGymSlug(name = '', phone = '') {
  const cleanName = (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const cleanPhone = (phone || '').replace(/\D/g, '');
  const last4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : (cleanPhone.length > 0 ? cleanPhone : '');

  if (!cleanName) return last4 ? `gym-${last4}` : '';
  if (last4) return `${cleanName}-${last4}`;
  return cleanName;
}

export function generateDefaultEmail(slug = '', phone = '') {
  const cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (cleanSlug) return `owner@${cleanSlug}.nexusgym.io`;
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone) return `owner.${cleanPhone.slice(-4)}@nexusgym.io`;
  return 'owner@gym.nexusgym.io';
}

export function generateInitialPassword(phone = '') {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const last4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : '2026';
  return `Nexus@${last4}!`;
}

export async function onboardGymNode({
  gymName, slug, phone, email, adminPin = '1234', password, upi,
  saasFee = 2499, validityDays = 365,
  p1 = 1200, p3 = 3200, p6 = 5800, p12 = 10500,
  features = { workouts: true, nutrition: true, qr_attendance: true, notices: true }
}) {
  if (!gymName || !slug || !phone || !email || !upi) {
    throw new Error('All required onboarding fields (Gym Name, Slug, Phone, Email, UPI) must be filled.');
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (sessionError || !session || !session.user) {
    throw new Error('Authentication Required: Your Super Admin session is missing or expired. Please sign in again.');
  }

  let isSuperAdmin = checkIsSuperAdmin(session.user, cachedSuperAdminContext);
  try {
    const { data: rpcContext, error: contextErr } = await supabase.rpc('rpc_get_current_user_context');
    if (!contextErr && rpcContext) isSuperAdmin = isSuperAdmin || checkIsSuperAdmin(session.user, rpcContext);
  } catch (ctxErr) {
    console.warn('[ONBOARDING] User context RPC check note:', ctxErr);
  }

  if (!isSuperAdmin) {
    throw new Error('Access Denied: Current user does not hold the SUPER_ADMIN role required to onboard new gym nodes.');
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const finalPassword = password || generateInitialPassword(phone);
  const finalPin = String(adminPin || '1234').padStart(4, '0').slice(-4);
  const pricingPayload = {
    plan_1m_price: Number(p1), plan_3m_price: Number(p3),
    plan_6m_price: Number(p6), plan_12m_price: Number(p12)
  };

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_create_gym_with_owner', {
    p_gym_name: gymName, p_slug: cleanSlug, p_owner_phone: phone,
    p_owner_email: email, p_owner_password: finalPassword, p_admin_pin: finalPin,
    p_owner_upi_id: upi, p_saas_fee: Number(saasFee),
    p_validity_days: Number(validityDays), p_pricing: pricingPayload,
    p_feature_gates: features
  });

  if (rpcErr) {
    console.error('[ONBOARDING] Atomic RPC execution error:', rpcErr);
    if (rpcErr.code === '42501' || rpcErr.message?.includes('permission denied') || rpcErr.message?.includes('Access Denied')) {
      throw new Error(`Database Authorization Error (42501): ${rpcErr.message || 'Permission denied'}`);
    }
    if (rpcErr.code === '23505' || rpcErr.message?.includes('already registered') || rpcErr.message?.includes('duplicate key') || rpcErr.message?.includes('unique constraint')) {
      throw new Error(`Duplicate Entry Error: Gym handle "@${cleanSlug}" or email "${email}" is already registered.`);
    }
    if (rpcErr.code === '22P02' || rpcErr.message?.includes('invalid input syntax')) {
      throw new Error(`Invalid Parameter Format: ${rpcErr.message}`);
    }
    throw new Error(`Onboarding failed: ${rpcErr.message || 'Database error occurred during provisioning'}`);
  }

  if (!rpcRes) throw new Error('Onboarding failed: No response returned from rpc_create_gym_with_owner.');

  const createdGym = rpcRes.gym || rpcRes;
  const gymId = createdGym.id || rpcRes.gym_id || cleanSlug;
  const authUserId = rpcRes.user_id || rpcRes.auth_user_id || (rpcRes.user && rpcRes.user.id) || null;

  return {
    success: true, gym: createdGym, gymId, authUserId, email,
    password: finalPassword, adminPin: finalPin, slug: cleanSlug,
    gymName, phone, authNotice: null
  };
}

export function checkIsSuperAdmin(user, context) {
  if (!user && !context) return false;

  // Authorization is database-context driven. Never trust user-editable metadata.
  if (context) {
    if (context.is_super_admin === true) return true;
    if (context.role && String(context.role).toUpperCase() === 'SUPER_ADMIN') return true;
    if (Array.isArray(context.roles)) {
      return context.roles.some(r => {
        if (typeof r === 'string') return r.toUpperCase() === 'SUPER_ADMIN';
        if (typeof r === 'object' && r !== null) {
          const roleStr = r.role || r.role_name || r.name;
          return roleStr && String(roleStr).toUpperCase() === 'SUPER_ADMIN';
        }
        return false;
      });
    }
  }
  return false;
}

export async function initSuperAdmin() {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    console.debug('[BOOT_START] Starting Super Admin bootstrap process');
    try {
      if (!supabase || !supabase.auth) {
        return { error: 'BOOT_ERROR', message: 'Supabase client could not be initialized.' };
      }

      const sessionResult = await withTimeout(supabase.auth.getSession(), 6000, 'supabase.auth.getSession()');
      const session = sessionResult?.data?.session;
      const sessionError = sessionResult?.error;

      if (sessionError) {
        return { error: 'SESSION_ERROR', message: sessionError.message || 'Session verification error' };
      }
      if (!session || !session.user || !session.access_token) return { error: 'NO_SESSION' };

      const user = session.user;
      let context = null;

      try {
        const { data: rpcContext, error: rpcErr } = await withTimeout(
          supabase.rpc('rpc_get_current_user_context'), 5000, 'rpc_get_current_user_context'
        );
        if (rpcErr) {
          return { error: 'SESSION_ERROR', message: `Unable to verify Super Admin role: ${rpcErr.message || 'role context RPC failed'}` };
        }
        context = rpcContext;
      } catch (rpcErr) {
        return {
          error: rpcErr?.message?.includes('TIMEOUT') ? 'TIMEOUT' : 'SESSION_ERROR',
          message: rpcErr?.message || 'Unable to verify Super Admin role.'
        };
      }

      if (!checkIsSuperAdmin(user, context)) {
        return { error: 'ACCESS_DENIED', user, email: user.email };
      }

      cachedSuperAdminContext = {
        authenticated: true, is_super_admin: true, user,
        email: user.email, session, ...(context || {})
      };

      setupSuperAdminAuthListener();
      return cachedSuperAdminContext;
    } catch (error) {
      console.error('[BOOT_FAILED] Bootstrap exception:', error);
      return {
        error: error.message?.includes('TIMEOUT') ? 'TIMEOUT' : 'BOOT_ERROR',
        message: error.message || 'Authentication initialization error'
      };
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

let superAdminAuthSubscription = null;
function setupSuperAdminAuthListener() {
  if (superAdminAuthSubscription) return;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
      cachedSuperAdminContext = null;
      sessionStorage.removeItem('nexus_master_auth');
      window.location.href = './admin-login.html?redirect=super-admin.html';
    }
  });
  superAdminAuthSubscription = data?.subscription;
}

export async function handleSignOut() {
  cachedSuperAdminContext = null;
  sessionStorage.removeItem('nexus_master_auth');
  localStorage.removeItem('nexus_desk_unlocked');
  await supabase.auth.signOut();
  window.location.href = './admin-login.html?redirect=super-admin.html';
}

export function getCurrentContext() {
  return cachedSuperAdminContext;
}
