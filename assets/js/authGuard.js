import { supabase } from './supabaseClient.js';

let cachedUserContext = null;

/**
 * Validates active Supabase session and enforces tenant-scoped RBAC via RPC.
 */
export async function requireAuth(allowedRoles = [], requestedGymSlug = null, redirectTarget = null) {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      redirectToLogin(requestedGymSlug, redirectTarget);
      return null;
    }

    let context = null;
    try {
      const { data: rpcContext, error: contextError } = await supabase.rpc('rpc_get_current_user_context');
      if (rpcContext && rpcContext.authenticated) {
        context = rpcContext;
      }
    } catch (rpcErr) {
      console.warn('[AUTH GUARD] RPC context resolution note:', rpcErr);
    }

    // Fallback: Build context directly from session, metadata, and user_roles table
    if (!context && session.user) {
      const user = session.user;
      let userRoles = [];
      try {
        const { data: dbRoles } = await supabase
          .from('user_roles')
          .select('*')
          .or(`user_id.eq.${user.id},email.eq.${user.email}`);
        if (dbRoles) userRoles = dbRoles;
      } catch (dbErr) {
        console.warn('[AUTH GUARD] user_roles lookup note:', dbErr);
      }

      const metaRole = user.user_metadata?.role || user.app_metadata?.role || 'GYM_OWNER';
      const metaSlug = user.user_metadata?.gym_slug || user.app_metadata?.gym_slug;
      
      if (metaRole && !userRoles.some(r => r.role === metaRole && r.gym_slug === metaSlug)) {
        userRoles.push({ role: metaRole, gym_slug: metaSlug, gym_id: metaSlug });
      }

      context = {
        authenticated: true,
        user_id: user.id,
        email: user.email,
        roles: userRoles,
        role: userRoles[0]?.role || metaRole,
        gym_slug: metaSlug || userRoles[0]?.gym_slug || requestedGymSlug,
        is_super_admin: user.user_metadata?.is_super_admin === true || user.app_metadata?.is_super_admin === true
      };
    }

    if (!context || !context.authenticated) {
      console.error('[AUTH GUARD] Context resolution failed.');
      await supabase.auth.signOut();
      redirectToLogin(requestedGymSlug, redirectTarget);
      return null;
    }

    cachedUserContext = context;

    // Super Admin has global cross-tenant platform authorization
    const user = session?.user;
    const isSuperAdmin = context.is_super_admin === true ||
      context.is_admin === true ||
      (context.role && String(context.role).toUpperCase() === 'SUPER_ADMIN') ||
      (user?.app_metadata?.role && String(user.app_metadata.role).toUpperCase() === 'SUPER_ADMIN') ||
      (user?.user_metadata?.role && String(user.user_metadata.role).toUpperCase() === 'SUPER_ADMIN') ||
      (user?.app_metadata?.is_super_admin === true) ||
      (user?.user_metadata?.is_super_admin === true) ||
      (Array.isArray(context.roles) && context.roles.some(r => {
        if (typeof r === 'string') return r.toUpperCase() === 'SUPER_ADMIN';
        if (typeof r === 'object' && r !== null) {
          const roleStr = r.role || r.role_name || r.name;
          return roleStr && String(roleStr).toUpperCase() === 'SUPER_ADMIN';
        }
        return false;
      }));

    if (isSuperAdmin) {
      setupAuthStateListener(redirectTarget);
      return context;
    }

    // Tenant and Role Verification
    if (allowedRoles.length > 0) {
      let isAuthorized = false;

      if (requestedGymSlug) {
        isAuthorized = Array.isArray(context.roles) && context.roles.some(
          r => r.gym_slug === requestedGymSlug && allowedRoles.includes(r.role)
        );
      } else {
        isAuthorized = Array.isArray(context.roles) && context.roles.some(r => allowedRoles.includes(r.role));
      }

      if (!isAuthorized) {
        renderForbiddenState(requestedGymSlug);
        throw new Error('403 Forbidden: Access denied for target tenant.');
      }
    }

    setupAuthStateListener(redirectTarget);
    return context;
  } catch (err) {
    console.error('[AUTH GUARD] Authorization error:', err.message);
    throw err;
  }
}

export function getCurrentContext() {
  return cachedUserContext;
}

export async function handleSignOut() {
  cachedUserContext = null;
  localStorage.removeItem('nexus_desk_unlocked');
  sessionStorage.removeItem('nexus_master_auth');
  await supabase.auth.signOut();
  window.location.href = './admin-login.html';
}

function redirectToLogin(gymSlug = null, redirectTarget = null) {
  const params = new URLSearchParams();
  if (gymSlug) params.set('gym', gymSlug);
  if (redirectTarget) params.set('redirect', redirectTarget);
  const query = params.toString() ? `?${params.toString()}` : '';
  window.location.href = `./admin-login.html${query}`;
}

function renderForbiddenState(gymSlug) {
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#f8fafc;font-family:sans-serif;">
      <div style="text-align:center;padding:2rem;background:#1e293b;border-radius:8px;border:1px solid #ef4444;max-width:480px;">
        <h1 style="color:#ef4444;margin-bottom:1rem;">403 - Unauthorized</h1>
        <p style="margin-bottom:1.5rem;color:#94a3b8;">You are not authorized to access tenant: <strong>${gymSlug || 'General'}</strong></p>
        <button id="nexusSignOutBtn" style="background:#ef4444;color:white;border:none;padding:0.75rem 1.5rem;border-radius:4px;cursor:pointer;font-weight:bold;">Sign Out & Switch Account</button>
      </div>
    </div>
  `;
  document.getElementById('nexusSignOutBtn')?.addEventListener('click', handleSignOut);
}

function setupAuthStateListener(redirectTarget = null) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session) {
      cachedUserContext = null;
      redirectToLogin(null, redirectTarget);
    }
  });
}
