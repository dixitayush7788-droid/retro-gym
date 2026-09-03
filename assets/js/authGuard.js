import { supabase } from './supabaseClient.js';

let cachedUserContext = null;

const ROLE_MAP = {
  owner: 'GYM_OWNER', gym_owner: 'GYM_OWNER', gymowner: 'GYM_OWNER',
  manager: 'MANAGER', staff: 'STAFF',
  super_admin: 'SUPER_ADMIN', superadmin: 'SUPER_ADMIN'
};

function normalizeRole(role) {
  const raw = String(role || '').trim();
  if (!raw) return '';
  return ROLE_MAP[raw.toLowerCase()] || raw.toUpperCase();
}

function normalizeRoles(roles = []) {
  return (Array.isArray(roles) ? roles : []).map(r => {
    if (typeof r === 'string') return normalizeRole(r);
    if (!r || typeof r !== 'object') return r;
    return { ...r, role: normalizeRole(r.role || r.role_name || r.name) };
  });
}

function isRoleAllowed(role, allowedRoles) {
  const normalizedRole = normalizeRole(role);
  return allowedRoles.some(r => normalizeRole(r) === normalizedRole);
}

function isSuperAdminContext(context, user) {
  return Boolean(
    context?.is_super_admin === true ||
    normalizeRole(context?.role) === 'SUPER_ADMIN' ||
    normalizeRoles(context?.roles).some(r => normalizeRole(typeof r === 'string' ? r : r?.role) === 'SUPER_ADMIN') ||
    normalizeRole(user?.app_metadata?.role) === 'SUPER_ADMIN' ||
    user?.app_metadata?.is_super_admin === true
  );
}

function derivePrimaryTenant(context, requestedGymSlug = null) {
  const requested = String(requestedGymSlug || '').trim().toLowerCase();
  const roles = normalizeRoles(context?.roles).filter(r => r && typeof r === 'object');
  if (requested) {
    const matching = roles.find(r => String(r.gym_slug || '').toLowerCase() === requested);
    if (matching) return matching.gym_slug;
  }
  const tenantRole = roles.find(r => r.gym_slug && normalizeRole(r.role) !== 'SUPER_ADMIN');
  return context?.gym_slug || tenantRole?.gym_slug || null;
}

export async function requireAuth(allowedRoles = [], requestedGymSlug = null, redirectTarget = null) {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      redirectToLogin(requestedGymSlug, redirectTarget);
      return null;
    }

    let context = null;
    try {
      const { data: rpcContext } = await supabase.rpc('rpc_get_current_user_context');
      if (rpcContext && rpcContext.authenticated) context = rpcContext;
    } catch (rpcErr) {
      console.warn('[AUTH GUARD] RPC context resolution note:', rpcErr);
    }

    if (!context && session.user) {
      const user = session.user;
      let userRoles = [];
      try {
        const { data: dbRoles } = await supabase.from('user_roles').select('*').eq('user_id', user.id);
        if (dbRoles) userRoles = dbRoles;
      } catch (dbErr) {
        console.warn('[AUTH GUARD] user_roles lookup note:', dbErr);
      }

      const gymIds = userRoles.map(r => r.gym_id).filter(Boolean);
      const gymsMap = {};
      if (gymIds.length > 0) {
        try {
          const { data: gymRecords } = await supabase.from('gyms').select('id, slug, name').in('id', gymIds);
          if (gymRecords) gymRecords.forEach(g => { gymsMap[g.id] = g; });
        } catch (gErr) {}
      }

      userRoles = userRoles.map(r => {
        const g = gymsMap[r.gym_id];
        return { ...r, role: normalizeRole(r.role), gym_slug: g ? g.slug : r.gym_slug, gym_name: g?.name };
      });

      const appRole = normalizeRole(user.app_metadata?.role);
      const appSlug = user.app_metadata?.gym_slug || null;
      if (appRole && !userRoles.some(r => normalizeRole(r.role) === appRole && (!appSlug || r.gym_slug === appSlug))) {
        userRoles.push({ role: appRole, gym_slug: appSlug, gym_id: null });
      }

      context = {
        authenticated: true, user_id: user.id, email: user.email, roles: userRoles,
        role: userRoles[0]?.role || appRole || 'MEMBER',
        gym_id: userRoles[0]?.gym_id || null,
        gym_slug: appSlug || userRoles.find(r => r.gym_slug)?.gym_slug || requestedGymSlug || null,
        is_super_admin: userRoles.some(r => normalizeRole(r.role) === 'SUPER_ADMIN') ||
          user.app_metadata?.is_super_admin === true
      };
    }

    if (!context || !context.authenticated) {
      await supabase.auth.signOut();
      redirectToLogin(requestedGymSlug, redirectTarget);
      return null;
    }

    context.roles = normalizeRoles(context.roles);
    context.role = normalizeRole(context.role || context.roles?.[0]?.role);
    context.gym_slug = derivePrimaryTenant(context, requestedGymSlug);
    if (!context.gym_id && context.gym_slug) {
      const tenantRole = context.roles.find(r => r?.gym_slug === context.gym_slug);
      if (tenantRole) context.gym_id = tenantRole.gym_id || null;
    }
    cachedUserContext = context;

    const isSuperAdmin = isSuperAdminContext(context, session.user);
    if (isSuperAdmin) {
      setupAuthStateListener(redirectTarget);
      return context;
    }

    if (allowedRoles.length > 0) {
      const requested = String(requestedGymSlug || '').trim().toLowerCase();
      const isAuthorized = requested
        ? context.roles.some(r => String(r?.gym_slug || '').toLowerCase() === requested && isRoleAllowed(r?.role, allowedRoles))
        : context.roles.some(r => isRoleAllowed(r?.role, allowedRoles));

      if (!isAuthorized) {
        renderForbiddenState(requestedGymSlug || context.gym_slug || null);
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

export function getCurrentContext() { return cachedUserContext; }

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

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderForbiddenState(gymSlug) {
  const safeSlug = escapeHtml(gymSlug) || 'your assigned gym';
  document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0f172a;color:#f8fafc;font-family:sans-serif;">
      <div style="text-align:center;padding:2rem;background:#1e293b;border-radius:8px;border:1px solid #ef4444;max-width:480px;">
        <h1 style="color:#ef4444;margin-bottom:1rem;">403 - Unauthorized</h1>
        <p style="margin-bottom:1.5rem;color:#94a3b8;">You are not authorized to access tenant: <strong>${safeSlug}</strong></p>
        <button id="nexusSignOutBtn" style="background:#ef4444;color:white;border:none;padding:0.75rem 1.5rem;border-radius:4px;cursor:pointer;font-weight:bold;">Sign Out & Switch Account</button>
      </div>
    </div>`;
  document.getElementById('nexusSignOutBtn')?.addEventListener('click', handleSignOut);
}

let authSubscription = null;
function setupAuthStateListener(redirectTarget = null) {
  if (authSubscription) return;
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) {
      cachedUserContext = null;
      redirectToLogin(null, redirectTarget);
    }
  });
  authSubscription = data?.subscription;
}
