import { supabase } from './supabaseClient.js';
import { requireAuth } from './authGuard.js';

export async function initAdminConsole() {
  const urlParams = new URLSearchParams(window.location.search);
  let targetGymSlug = (urlParams.get('gym') || '').trim().toLowerCase();

  try {
    const userContext = await requireAuth(['GYM_OWNER', 'MANAGER', 'SUPER_ADMIN'], targetGymSlug || null);
    if (!userContext) return;

    if (!targetGymSlug && userContext.gym_slug) {
      targetGymSlug = String(userContext.gym_slug).trim().toLowerCase();
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.set('gym', targetGymSlug);
      window.history.replaceState({}, '', newUrl.toString());
    }

    // Supabase Auth is the primary console gate. Quick-PIN remains available
    // for sensitive desk operations instead of blocking an authenticated owner.
    sessionStorage.setItem('retrogym_admin_auth', 'true');
    if (targetGymSlug) sessionStorage.setItem(`retrogym_admin_auth_${targetGymSlug}`, 'true');
    const lockModal = document.getElementById('admin-lock-modal');
    if (lockModal) lockModal.classList.add('hidden');

    bindDeskLockHandler(userContext, targetGymSlug);
    if (typeof window.fetchAllData === 'function') window.fetchAllData(false);
  } catch (error) {
    console.warn('[ADMIN AUTH] Halt console execution:', error.message);
  }
}

function bindDeskLockHandler(userContext, gymSlug) {
  const gymData = Array.isArray(userContext.roles)
    ? userContext.roles.find(r => String(r?.gym_slug || '').toLowerCase() === String(gymSlug || '').toLowerCase())
    : null;
  const gymId = gymData?.gym_id || userContext.gym_id;
  const quickPinBtn = document.getElementById('deskQuickPinBtn');
  if (!quickPinBtn || quickPinBtn.dataset.nexusBound === 'true') return;
  quickPinBtn.dataset.nexusBound = 'true';

  quickPinBtn.addEventListener('click', async () => {
    const enteredPin = prompt('Enter 4-Digit Terminal Quick-PIN:');
    if (!/^\d{4}$/.test(String(enteredPin || '')) || !gymId) {
      alert('Enter a valid 4-digit Quick-PIN.');
      return;
    }

    const { data, error } = await supabase.rpc('rpc_staff_quick_pin_unlock', {
      p_gym_id: typeof gymId === 'number' ? gymId : parseInt(gymId, 10),
      p_pin: String(enteredPin)
    });

    if (error || !data?.success) {
      alert(data?.error || error?.message || 'PIN verification failed.');
      return;
    }

    sessionStorage.setItem(`nexus_terminal_unlock_${gymId}`, 'true');
    sessionStorage.setItem('retrogym_admin_pin', String(enteredPin));
    alert('Terminal unlocked successfully.');
  });
}
