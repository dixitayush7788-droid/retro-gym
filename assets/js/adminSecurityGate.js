import { supabase } from './supabaseClient.js';

(() => {
  'use strict';

  if (typeof window === 'undefined') return;
  if (window.__nexusCanonicalAdminSecurityGateInstalled) return;
  window.__nexusCanonicalAdminSecurityGateInstalled = true;

  const getSlug = () => (new URLSearchParams(window.location.search).get('gym') || '').trim().toLowerCase();
  const isSessionAuthorized = (slug) => {
    if (!slug) return false;
    return sessionStorage.getItem(`retrogym_admin_auth_${slug}`) === 'true' || sessionStorage.getItem('retrogym_admin_auth') === 'true';
  };

  async function getPinState(slug) {
    if (!slug) return { configured: false, gymId: null };
    const client = window.__NEXUS_CANONICAL_SUPABASE_CLIENT__ || window.supabaseClient || window.db || supabase;
    if (!client) return { configured: false, gymId: null };

    const { data: gym, error: gymError } = await client
      .from('gyms')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (gymError || !gym?.id) throw gymError || new Error('Gym tenant could not be resolved.');

    const { data, error } = await client.rpc('rpc_get_admin_pin_state', { p_gym_id: gym.id });
    if (error) throw error;
    return { configured: data?.configured === true, gymId: gym.id };
  }

  async function applyGateState() {
    const slug = getSlug();
    const modal = document.getElementById('admin-lock-modal');
    if (!slug || typeof window.setAdminPinMode !== 'function') return;

    try {
      const { configured } = await getPinState(slug);
      if (configured) {
        window.setAdminPinMode('unlock');
        if (isSessionAuthorized(slug)) modal?.classList.add('hidden');
        else modal?.classList.remove('hidden');
      } else {
        window.setAdminPinMode('setup-enter');
        modal?.classList.remove('hidden');
      }
    } catch (error) {
      console.warn('[NEXUS SECURITY GATE] Unable to resolve PIN state:', error);
      // Do not silently grant access when the security state cannot be resolved.
      modal?.classList.remove('hidden');
    }
  }

  // Replace the legacy session check with the canonical server-backed state check.
  // The old implementation inferred configuration from admin_pin_hash, but the
  // tenant RPC deliberately strips that secret and returns only pin_configured.
  window.checkAdminSession = function nexusCanonicalAdminSessionCheck() {
    void applyGateState();
  };

  // Locking is still a real console lock. It must never fall back to PIN setup just
  // because the browser does not have access to the server-side hash.
  window.lockAdminConsole = function nexusCanonicalAdminLock() {
    const slug = getSlug();
    sessionStorage.removeItem(`retrogym_admin_auth_${slug}`);
    sessionStorage.removeItem('retrogym_admin_auth');
    sessionStorage.removeItem('retrogym_admin_pin');
    window.clearPinKey?.();
    const modal = document.getElementById('admin-lock-modal');
    modal?.classList.remove('hidden');
    void getPinState(slug).then(({ configured }) => {
      window.setAdminPinMode?.(configured ? 'unlock' : 'setup-enter');
    }).catch(() => {
      window.setAdminPinMode?.('unlock');
    });
    window.showToast?.('Admin Console Locked', 'info');
  };

  window.__nexusRefreshAdminSecurityGate = applyGateState;
})();
