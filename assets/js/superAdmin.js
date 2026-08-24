import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient.js';

const SUPABASE_URL = window.NEXUS_CONFIG?.SUPABASE_URL || 'https://zfvkvrhuovvbfbrutpph.supabase.co';
const SUPABASE_ANON_KEY = window.NEXUS_CONFIG?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmdmt2cmh1b3Z2YmZicnV0cHBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxMzIyODQsImV4cCI6MjEwMjcwODI4NH0.M-WK1bgZDLXcuMTldMSwptx5XRpRnLAi-BxMFEoph4U';

let cachedSuperAdminContext = null;

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

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const finalPassword = password || generateInitialPassword(phone);
  const finalPin = String(adminPin || '1234').padStart(4, '0').slice(-4);
  const pricingPayload = {
    plan_1m_price: Number(p1),
    plan_3m_price: Number(p3),
    plan_6m_price: Number(p6),
    plan_12m_price: Number(p12)
  };

  let authUserId = null;
  let createdGym = null;
  let gymId = cleanSlug;
  let authNotice = null;

  // 1. Authoritative Atomic RPC: rpc_create_gym_with_owner
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
    throw new Error(`Onboarding failed: ${rpcErr.message}`);
  }

  if (!rpcRes) {
    throw new Error('Onboarding failed: No response returned from rpc_create_gym_with_owner.');
  }

  createdGym = rpcRes.gym || rpcRes;
  gymId = createdGym.id || rpcRes.gym_id || cleanSlug;
  authUserId = rpcRes.user_id || rpcRes.auth_user_id || (rpcRes.user && rpcRes.user.id) || null;

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
 * Initializes and verifies the Super Admin authorization context.
 * Super Admin page BYPASSES tenant-level authorization checks entirely.
 * It ONLY checks if the authenticated user has is_super_admin: true or role === 'SUPER_ADMIN'.
 * Does NOT query for tenant 'General' or require a specific gym_id.
 * If user is SUPER_ADMIN, renders Master Fleet Dashboard directly without showing 403 modal.
 */
export async function initSuperAdmin() {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session || !session.user) {
      console.warn('[SUPER ADMIN] No active session found, redirecting to login.');
      window.location.href = './admin-login.html?redirect=super-admin.html';
      return null;
    }

    const user = session.user;
    let context = null;

    // Attempt RPC context check if available
    try {
      const { data: rpcContext } = await supabase.rpc('rpc_get_current_user_context');
      if (rpcContext) {
        context = rpcContext;
      }
    } catch (rpcErr) {
      console.warn('[SUPER ADMIN] RPC context check skipped/failed:', rpcErr);
    }

    // Evaluate Super Admin status
    let isSuperAdmin = checkIsSuperAdmin(user, context);

    // Fallback database lookup if needed
    if (!isSuperAdmin) {
      try {
        const { data: superAdminRows } = await dbLookupSuperAdmin(user.id, user.email);
        if (superAdminRows && superAdminRows.length > 0) {
          isSuperAdmin = true;
        }
      } catch (dbErr) {
        console.warn('[SUPER ADMIN] DB fallback check note:', dbErr);
      }
    }

    // If still not explicitly super admin, but user has valid authenticated session,
    // verify if user role in user_roles or profiles is SUPER_ADMIN
    if (!isSuperAdmin) {
      try {
        const { data: roleRows } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', user.id)
          .ilike('role', '%SUPER_ADMIN%')
          .limit(1);

        if (roleRows && roleRows.length > 0) {
          isSuperAdmin = true;
        }
      } catch (roleErr) {
        console.warn('[SUPER ADMIN] user_roles table note:', roleErr);
      }
    }

    if (!isSuperAdmin) {
      console.warn('[SUPER ADMIN] User is authenticated but does not hold SUPER_ADMIN role.');
      window.location.href = './admin-login.html?redirect=super-admin.html';
      return null;
    }

    cachedSuperAdminContext = {
      authenticated: true,
      is_super_admin: true,
      user,
      ...(context || {})
    };

    // Mark master authorization session for Super Admin console
    sessionStorage.setItem('nexus_master_auth', 'true');

    setupSuperAdminAuthListener();
    return cachedSuperAdminContext;
  } catch (error) {
    console.error('[SUPER ADMIN AUTH] Verification error:', error.message);
    window.location.href = './admin-login.html?redirect=super-admin.html';
    return null;
  }
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
  window.location.href = './admin-login.html';
}

export function getCurrentContext() {
  return cachedSuperAdminContext;
}
