import { supabase } from './supabaseClient.js';

let cachedSuperAdminContext = null;

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
      .from('super_admins')
      .select('*')
      .or(`user_id.eq.${userId},email.eq.${userEmail || ''}`)
      .limit(1);
    if (!error && data) return { data };
  } catch (e) {}
  return { data: null };
}

function setupSuperAdminAuthListener() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      cachedSuperAdminContext = null;
      sessionStorage.removeItem('nexus_master_auth');
      window.location.href = './admin-login.html?redirect=super-admin.html';
    }
  });
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
