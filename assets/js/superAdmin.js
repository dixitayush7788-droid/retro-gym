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

export { handleSignOut, getCurrentContext };
