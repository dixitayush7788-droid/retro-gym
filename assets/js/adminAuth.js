import { supabase } from './supabaseClient.js';
import { requireAuth, handleSignOut } from './authGuard.js';

export async function initAdminConsole() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetGymSlug = urlParams.get('gym') || 'rahul-fitness';

  try {
    const userContext = await requireAuth(
      ['GYM_OWNER', 'MANAGER'],
      targetGymSlug
    );

    if (!userContext) return;
    bindDeskLockHandler(userContext, targetGymSlug);
  } catch (error) {
    console.warn('[ADMIN AUTH] Halt console execution:', error.message);
  }
}

function bindDeskLockHandler(userContext, gymSlug) {
  const gymData = userContext.roles.find(r => r.gym_slug === gymSlug);
  const gymId = gymData?.gym_id;

  const quickPinBtn = document.getElementById('deskQuickPinBtn');
  if (!quickPinBtn) return;

  quickPinBtn.addEventListener('click', async () => {
    const enteredPin = prompt('Enter 4-Digit Terminal Quick-PIN:');
    if (!enteredPin || !gymId) return;

    const { data, error } = await supabase.rpc('rpc_staff_quick_pin_unlock', {
      p_gym_id: gymId,
      p_pin: enteredPin
    });

    if (error || !data?.success) {
      alert(data?.error || 'PIN verification failed.');
    } else {
      sessionStorage.setItem(`nexus_terminal_unlock_${gymId}`, 'true');
      alert('Terminal unlocked successfully.');
    }
  });
}
