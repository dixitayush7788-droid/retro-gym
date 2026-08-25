import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient.js';

const SUPABASE_URL = window.NEXUS_CONFIG?.SUPABASE_URL || 'https://zfvkvrhuovvbfbrutpph.supabase.co';
const SUPABASE_ANON_KEY = window.NEXUS_CONFIG?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmdmt2cmh1b3Z2YmZicnV0cHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzIyODQsImV4cCI6MjEwMjcwODI4NH0.M-WK1bgZDLXcuMTldMSwptx5XRpRnLAi-BxMFEoph4U';

let cachedSuperAdminContext = null;
let bootstrapPromise = null;

/**
 * Helper to enforce a strict timeout on async Supabase operations.
 * Prevents UI deadlock / hanging spinners.
 */
export function withTimeout(promise, timeoutMs = 8000, operationName = 'Operation') {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[TIMEOUT] ${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

/**
 * Creates an isolated Supabase client without persisting sessions to localStorage.
 * Ensures creating new gym owners via auth.signUp does not overwrite the Super Admin's session.
 */
export function createIsolatedAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

/**
 * Automatically generates a unique gym slug from business name and owner phone.
 * Appends last 4 digits of phone if available (e.g. manish-fitness-6456).
 */
export function generateGymSlug(name = '', phone = '') {
  const cleanName = (name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const cleanPhone = (phone || '').replace(/\D/g, '');
  const last4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : (cleanPhone.length > 0 ? cleanPhone : '');

  if (!cleanName) {
    return last4 ? `gym-${last4}` : '';
  }

  if (last4) {
    return `${cleanName}-${last4}`;
  }

  return cleanName;
}

/**
 * Generates a default email address for a gym owner.
 */
export function generateDefaultEmail(slug = '', phone = '') {
  const cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (cleanSlug) {
    return `owner@${cleanSlug}.nexusgym.io`;
  }
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone) {
    return `owner.${cleanPhone.slice(-4)}@nexusgym.io`;
  }
  return 'owner@gym.nexusgym.io';
}

/**
 * Generates a secure, memorable initial password.
 */
export function generateInitialPassword(phone = '') {
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const last4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : '2026';
  return `Nexus@${last4}!`;
}

/**
 * Full Automated 1-Click Gym Onboarding Engine:
 * 1. Calls isolated client auth.signUp({ email, password }) without switching Super Admin's active session
 * 2. Extracts created user.id from auth response
 * 3. Inserts new gym into public.gyms table with admin_pin, owner_phone, owner_email, owner_upi_id, pricing, feature gates, and gets gym.id
 * 4. Inserts into public.user_roles (user_id, gym_id, role) linking user.id and gym.id with role: 'GYM_OWNER'
 * 5. Returns all credentials for WhatsApp summary modal
 */
export async function onboardGymNode({
  gymName,
  slug,
  phone,
  email,
  adminPin = '1234',
  password,
  upi,
  saasFee = 2499,
  validityDays = 365,
  p1 = 1200,
  p3 = 3200,
  p6 = 5800,
  p12 = 10500,
  features = { workouts: true, nutrition: true, qr_attendance: true, notices: true }
}) {
  if (!gymName || !slug || !phone || !email || !upi) {
    throw new Error('All required onboarding fields (Gym Name, Slug, Phone, Email, UPI) must be filled.');
  }

  // 1. Verify Active Authenticated Super Admin Session
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (sessionError || !session || !session.user) {
    console.error('[ONBOARDING] No active session found during onboarding:', sessionError);
    throw new Error('Authentication Required: Your Super Admin session is missing or expired. Please sign in again.');
  }

  // 2. Authoritative SUPER_ADMIN context verification
  let isSuperAdmin = checkIsSuperAdmin(session.user, cachedSuperAdminContext);
  
  try {
    const { data: rpcContext, error: contextErr } = await supabase.rpc('rpc_get_current_user_context');
    if (!contextErr && rpcContext) {
      isSuperAdmin = isSuperAdmin || checkIsSuperAdmin(session.user, rpcContext);
    }
  } catch (ctxErr) {
    console.warn('[ONBOARDING] User context RPC check note:', ctxErr);
  }

  if (!isSuperAdmin) {
    console.error('[ONBOARDING] User is authenticated but lacks SUPER_ADMIN context:', session.user.id);
    throw new Error('Access Denied: Current user does not hold the SUPER_ADMIN role required to onboard new gym nodes.');
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const finalPassword = password || generateInitialPassword(phone);
  const finalPin = String(adminPin || '1234').padStart(4, '0').slice(-4);
  const pricingPayload = {
    plan_1m_price: Number(p1),
    plan_3m_price: Number(p3),
    plan_6m_price: Number(p6),
    plan_12m_price: Number(p12)
  };

  // 3. Authoritative Atomic RPC: rpc_create_gym_with_owner using the canonical authenticated client
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_create_gym_with_owner', {
    p_gym_name: gymName,
    p_slug: cleanSlug,
    p_owner_phone: phone,
    p_owner_email: email,
    p_owner_password: finalPassword,
    p_admin_pin: finalPin,
    p_owner_upi_id: upi,
    p_saas_fee: Number(saasFee),
    p_validity_days: Number(validityDays),
    p_pricing: pricingPayload,
    p_feature_gates: features
  });

  if (rpcErr) {
    console.error('[ONBOARDING] Atomic RPC execution error:', rpcErr);

    // Differentiate specific error conditions
    if (rpcErr.code === '42501' || rpcErr.message?.includes('permission denied') || rpcErr.message?.includes('Access Denied')) {
      throw new Error(`Database Authorization Error (42501): The database rejected this call (${rpcErr.message || 'Permission denied'}). Ensure you are signed in with a SUPER_ADMIN account with active session.`);
    }
    if (rpcErr.code === '23505' || rpcErr.message?.includes('already registered') || rpcErr.message?.includes('duplicate key') || rpcErr.message?.includes('unique constraint')) {
      throw new Error(`Duplicate Entry Error: Gym handle "@${cleanSlug}" or email "${email}" is already registered. Please choose a different handle or email.`);
    }
    if (rpcErr.code === '22P02' || rpcErr.message?.includes('invalid input syntax')) {
      throw new Error(`Invalid Parameter Format: Please ensure all numeric and text fields are properly formatted (${rpcErr.message}).`);
    }
    throw new Error(`Onboarding failed: ${rpcErr.message || 'Database error occurred during provisioning'}`);
  }

  if (!rpcRes) {
    throw new Error('Onboarding failed: No response returned from rpc_create_gym_with_owner.');
  }

  const createdGym = rpcRes.gym || rpcRes;
  const gymId = createdGym.id || rpcRes.gym_id || cleanSlug;
  const authUserId = rpcRes.user_id || rpcRes.auth_user_id || (rpcRes.user && rpcRes.user.id) || null;

  return {
    success: true,
    gym: createdGym,
    gymId,
    authUserId,
    email,
    password: finalPassword,
    adminPin: finalPin,
    slug: cleanSlug,
    gymName,
    phone,
    authNotice: null
  };
}

/**
 * Helper to determine if a given user/context object holds Super Admin authorization.
 */
export function checkIsSuperAdmin(user, context) {
  if (!user && !context) return false;

  // 1. Context level checks
  if (context) {
    if (context.is_super_admin === true || context.is_admin === true) return true;
    if (context.role && String(context.role).toUpperCase() === 'SUPER_ADMIN') return true;
    
    // Check roles array (array of strings or array of objects)
    if (Array.isArray(context.roles)) {
      const hasRole = context.roles.some(r => {
        if (typeof r === 'string') return r.toUpperCase() === 'SUPER_ADMIN';
        if (typeof r === 'object' && r !== null) {
          const roleStr = r.role || r.role_name || r.name;
          return roleStr && String(roleStr).toUpperCase() === 'SUPER_ADMIN';
        }
        return false;
      });
      if (hasRole) return true;
    }
  }

  // 2. Auth user level checks (metadata, email, app_metadata)
  if (user) {
    const appMeta = user.app_metadata || {};
    const userMeta = user.user_metadata || {};

    if (appMeta.is_super_admin === true || userMeta.is_super_admin === true) return true;
    if (appMeta.role && String(appMeta.role).toUpperCase() === 'SUPER_ADMIN') return true;
    if (userMeta.role && String(userMeta.role).toUpperCase() === 'SUPER_ADMIN') return true;
    if (Array.isArray(appMeta.roles) && appMeta.roles.some(r => String(r).toUpperCase() === 'SUPER_ADMIN')) return true;
    if (Array.isArray(userMeta.roles) && userMeta.roles.some(r => String(r).toUpperCase() === 'SUPER_ADMIN')) return true;
  }

  return false;
}

/**
 * Initializes and verifies the Super Admin authorization context with deterministic single-flight execution and hard timeouts.
 * Super Admin page BYPASSES tenant-level authorization checks entirely.
 * It ONLY checks if the authenticated user has is_super_admin: true or role === 'SUPER_ADMIN'.
 * Returns context to render Master Fleet Dashboard directly, or explicit error states.
 */
export async function initSuperAdmin() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    console.debug('[SUPER_ADMIN_BOOT] start');
    try {
      console.debug('[SUPER_ADMIN_BOOT] checking session...');
      const sessionResult = await withTimeout(
        supabase.auth.getSession(),
        7000,
        'supabase.auth.getSession()'
      );
      
      const session = sessionResult?.data?.session;
      const sessionError = sessionResult?.error;

      if (sessionError) {
        console.error('[SUPER_ADMIN_BOOT] session error:', sessionError);
        return {
          error: 'SESSION_ERROR',
          message: sessionError.message || 'Session verification error'
        };
      }

      if (!session || !session.user || !session.access_token) {
        console.warn('[SUPER_ADMIN_BOOT] No active session found. Redirecting to login.');
        return {
          error: 'NO_SESSION'
        };
      }

      const user = session.user;
      console.debug('[SUPER_ADMIN_BOOT] session confirmed for user:', user.email, 'id:', user.id);

      let context = null;
      console.debug('[SUPER_ADMIN_BOOT] checking role context via rpc_get_current_user_context...');
      try {
        const { data: rpcContext, error: rpcErr } = await withTimeout(
          supabase.rpc('rpc_get_current_user_context'),
          6000,
          'rpc_get_current_user_context'
        );
        if (!rpcErr && rpcContext) {
          context = rpcContext;
          console.debug('[SUPER_ADMIN_CONTEXT]', rpcContext);
        } else if (rpcErr) {
          console.warn('[SUPER_ADMIN_BOOT] RPC context returned error:', rpcErr);
        }
      } catch (rpcErr) {
        console.warn('[SUPER_ADMIN_BOOT] RPC context lookup note (timed out or failed):', rpcErr?.message || rpcErr);
      }

      // Evaluate Super Admin status
      let isSuperAdmin = checkIsSuperAdmin(user, context);

      // Fallback database lookup if needed
      if (!isSuperAdmin) {
        console.debug('[SUPER_ADMIN_BOOT] checking DB user_roles fallback...');
        try {
          const { data: superAdminRows } = await withTimeout(
            dbLookupSuperAdmin(user.id, user.email),
            4000,
            'dbLookupSuperAdmin'
          );
          if (superAdminRows && superAdminRows.length > 0) {
            isSuperAdmin = true;
          }
        } catch (dbErr) {
          console.warn('[SUPER_ADMIN_BOOT] DB fallback check note:', dbErr?.message || dbErr);
        }
      }

      // Additional user_roles query check if still not verified
      if (!isSuperAdmin) {
        try {
          const { data: roleRows } = await withTimeout(
            supabase
              .from('user_roles')
              .select('*')
              .eq('user_id', user.id)
              .ilike('role', '%SUPER_ADMIN%')
              .limit(1),
            4000,
            'user_roles ilike check'
          );

          if (roleRows && roleRows.length > 0) {
            isSuperAdmin = true;
          }
        } catch (roleErr) {
          console.warn('[SUPER_ADMIN_BOOT] user_roles table note:', roleErr?.message || roleErr);
        }
      }

      if (!isSuperAdmin) {
        console.warn('[SUPER_ADMIN_BOOT] User is authenticated but does not hold SUPER_ADMIN role:', user.email);
        return {
          error: 'ACCESS_DENIED',
          user,
          email: user.email
        };
      }

      console.debug('[SUPER_ADMIN_BOOT] SUPER_ADMIN verified for:', user.email);

      cachedSuperAdminContext = {
        authenticated: true,
        is_super_admin: true,
        user,
        email: user.email,
        session,
        ...(context || {})
      };

      setupSuperAdminAuthListener();
      return cachedSuperAdminContext;
    } catch (error) {
      console.error('[SUPER_ADMIN_BOOT] ERROR:', error);
      return {
        error: error.message?.includes('TIMEOUT') ? 'TIMEOUT' : 'BOOT_ERROR',
        message: error.message || 'Authentication initialization error'
      };
    } finally {
      // allow subsequent re-verification if explicit retry called
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

async function dbLookupSuperAdmin(userId, userEmail) {
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', userId)
      .eq('role', 'SUPER_ADMIN')
      .limit(1);
    if (!error && data) return { data };
  } catch (e) {}
  return { data: null };
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
