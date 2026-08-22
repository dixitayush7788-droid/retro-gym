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

    const { data: context, error: contextError } = await supabase.rpc('rpc_get_current_user_context');
    
    if (contextError || !context || !context.authenticated) {
      console.error('[AUTH GUARD] Context resolution failed:', contextError);
      await supabase.auth.signOut();
      redirectToLogin(requestedGymSlug, redirectTarget);
      return null;
    }

    cachedUserContext = context;

    // Super Admin has global cross-tenant platform authorization
    const isSuperAdmin = context.is_super_admin === true ||
      context.role === 'SUPER_ADMIN' ||
      (Array.isArray(context.roles) && context.roles.some(r => r.role === 'SUPER_ADMIN'));

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
