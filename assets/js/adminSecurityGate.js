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

  let pinState = { configured: null, gymId: null, slug: null };
  let originalSetAdminPinMode = null;

  async function getPinState(slug, force = false) {
    if (!slug) return { configured: false, gymId: null };
    if (!force && pinState.slug === slug && typeof pinState.configured === 'boolean') return pinState;

    const client = window.__NEXUS_CANONICAL_SUPABASE_CLIENT__ || window.supabaseClient || window.db || supabase;
    if (!client) throw new Error('Supabase client unavailable.');

    const { data: gym, error: gymError } = await client
      .from('gyms')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (gymError || !gym?.id) throw gymError || new Error('Gym tenant could not be resolved.');

    const { data, error } = await client.rpc('rpc_get_admin_pin_state', { p_gym_id: gym.id });
    if (error) throw error;

    const configured = data?.configured === true || data?.pin_configured === true;
    pinState = { configured, gymId: gym.id, slug };
    return pinState;
  }

  function installPinModeGuard() {
    if (window.__nexusAdminPinModeGuardInstalled || typeof window.setAdminPinMode !== 'function') return;
    originalSetAdminPinMode = window.setAdminPinMode;
    window.setAdminPinMode = function nexusCanonicalSetAdminPinMode(mode, ...args) {
      // A configured tenant can NEVER be switched into PIN setup mode by legacy
      // bootstrap code. Setup is only valid for a tenant whose server state says
      // no PIN exists yet.
      if (mode === 'setup-enter' && pinState.configured === true) {
        return originalSetAdminPinMode.call(this, 'unlock', ...args);
      }
      return originalSetAdminPinMode.call(this, mode, ...args);
    };
    window.__nexusAdminPinModeGuardInstalled = true;
  }

  async function applyGateState(force = false) {
    const slug = getSlug();
    const modal = document.getElementById('admin-lock-modal');
    if (!slug) return;

    installPinModeGuard();

    try {
      const { configured } = await getPinState(slug, force);
      if (configured) {
        window.setAdminPinMode?.('unlock');
        // Authentication through the real owner login is authoritative for console
        // access. The PIN modal is only the local console lock, not onboarding auth.
        if (isSessionAuthorized(slug)) modal?.classList.add('hidden');
        else modal?.classList.remove('hidden');
      } else {
        window.setAdminPinMode?.('setup-enter');
        modal?.classList.remove('hidden');
      }
    } catch (error) {
      console.error('[NEXUS SECURITY GATE] Unable to resolve server PIN state:', error);
      // Fail closed. Never turn an unknown security state into PIN setup.
      modal?.classList.remove('hidden');
      if (originalSetAdminPinMode) originalSetAdminPinMode.call(window, 'unlock');
    }
  }

  window.checkAdminSession = function nexusCanonicalAdminSessionCheck() {
    installPinModeGuard();
    void applyGateState(false);
  };

  window.lockAdminConsole = function nexusCanonicalAdminLock() {
    const slug = getSlug();
    sessionStorage.removeItem(`retrogym_admin_auth_${slug}`);
    sessionStorage.removeItem('retrogym_admin_auth');
    sessionStorage.removeItem('retrogym_admin_pin');
    window.clearPinKey?.();
    const modal = document.getElementById('admin-lock-modal');
    modal?.classList.remove('hidden');
    void getPinState(slug, true).then(({ configured }) => {
      window.setAdminPinMode?.(configured ? 'unlock' : 'setup-enter');
    }).catch(() => {
      // Unknown state stays locked and is never interpreted as "set a new PIN".
      originalSetAdminPinMode?.call(window, 'unlock');
    });
    window.showToast?.('Admin Console Locked', 'info');
  };

  window.__nexusRefreshAdminSecurityGate = () => applyGateState(true);
})();
