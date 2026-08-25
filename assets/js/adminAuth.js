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
    installAtomicMemberRegistration();
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

function installAtomicMemberRegistration() {
  // Override the legacy browser-side multi-step transaction with one
  // SECURITY DEFINER RPC so failed registrations cannot leave partial records.
  window.handleCreateMember = async function handleCreateMemberAtomic(e) {
    e?.preventDefault();

    const fullName = document.getElementById('new-member-name')?.value.trim() || '';
    const cleanPhone = (document.getElementById('new-member-phone')?.value || '').replace(/\D/g, '').slice(-10);
    const ageRaw = document.getElementById('new-member-age')?.value.trim() || '';
    const age = ageRaw ? parseInt(ageRaw, 10) : null;
    const address = document.getElementById('new-member-address')?.value.trim() || '';
    const selectedPlanButton = document.querySelector('.plan-choice-btn.bg-gold[id^="plan-opt-"]');
    const selectedPlanMonths = parseInt(selectedPlanButton?.id?.replace('plan-opt-', ''), 10) || 1;
    const collectedAmount = parseFloat(document.getElementById('feeAmountInput')?.value) || 0;
    const isReferred = document.getElementById('ref-type-referred')?.checked;
    const cleanRefPhone = isReferred
      ? (document.getElementById('new-member-referrer')?.value || '').replace(/\D/g, '').slice(-10)
      : '';
    const photoSrc = document.getElementById('photo-preview-img')?.src || '';
    const photoUrl = photoSrc.startsWith('data:image/') ? photoSrc : null;
    const gymSlug = (new URLSearchParams(window.location.search).get('gym') || '').trim().toLowerCase();
    const btn = document.getElementById('btn-submit-member');

    const toast = (message, type) => window.showToast?.(message, type);
    if (!fullName) return toast('Please enter athlete full name', 'error');
    if (!/^\d{10}$/.test(cleanPhone)) return toast('Please enter a valid 10-digit mobile number', 'error');
    if (!gymSlug) return toast('Gym tenant is missing from this admin link', 'error');

    if (btn) {
      btn.innerText = 'Registering Athlete to Cloud...';
      btn.disabled = true;
    }

    try {
      const { data, error } = await supabase.rpc('register_member_with_referral', {
        p_gym_slug: gymSlug,
        p_name: fullName,
        p_phone: cleanPhone,
        p_age: Number.isFinite(age) ? age : null,
        p_address: address || null,
        p_photo_url: photoUrl,
        p_plan_months: selectedPlanMonths,
        p_fees_paid: collectedAmount,
        p_referrer_phone: cleanRefPhone || null
      });

      if (error) throw new Error(error.message || 'Member registration failed.');
      if (!data?.success) throw new Error(data?.error || 'Member registration failed.');

      const rewardNote = cleanRefPhone && data.referrer_credited
        ? ' +7-day referral reward credited.'
        : '';
      window.playAudioChirp?.(880, 0.15);
      toast(`Athlete ${fullName} registered successfully.${rewardNote}`, 'success');
      window.closeAddMemberDrawer?.();
      await window.fetchAllData?.();
    } catch (err) {
      console.error('[ATOMIC MEMBER REGISTRATION]', err);
      toast(`Registration failed: ${err.message || err}`, 'error');
    } finally {
      if (btn) {
        btn.innerText = 'Confirm & Save Athlete to Cloud ⚡';
        btn.disabled = false;
      }
    }
  };
}
