import { supabase } from './supabaseClient.js';
import { requireAuth, handleSignOut, getCurrentContext } from './authGuard.js';

/**
 * Initializes and verifies the Super Admin authorization context.
 * Enforces role === 'SUPER_ADMIN' or is_super_admin: true.
 * Redirects to admin-login.html?redirect=super-admin.html if unauthorized.
 */
export async function initSuperAdmin() {
  try {
    const context = await requireAuth(['SUPER_ADMIN'], null, 'super-admin.html');
    if (!context) {
      return null;
    }

    const isSuperAdmin = context.is_super_admin === true ||
      context.role === 'SUPER_ADMIN' ||
      (Array.isArray(context.roles) && context.roles.some(r => r.role === 'SUPER_ADMIN'));

    if (!isSuperAdmin) {
      console.warn('[SUPER ADMIN] Access denied: User lacks SUPER_ADMIN privileges.');
      window.location.href = './admin-login.html?redirect=super-admin.html';
      return null;
    }

    return context;
  } catch (error) {
    console.error('[SUPER ADMIN AUTH] Verification error:', error.message);
    window.location.href = './admin-login.html?redirect=super-admin.html';
    return null;
  }
}

export { handleSignOut, getCurrentContext };
