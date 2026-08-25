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
    sessionStorage.setItem('retrogym_admin_auth', 'true');
    if (targetGymSlug) sessionStorage.setItem(`retrogym_admin_auth_${targetGymSlug}`, 'true');
    document.getElementById('admin-lock-modal')?.classList.add('hidden');
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
    alert('Terminal unlocked successfully.');
  });
}

function installAtomicMemberRegistration() {
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
    const cleanRefPhone = isReferred ? (document.getElementById('new-member-referrer')?.value || '').replace(/\D/g, '').slice(-10) : '';
    const photoSrc = document.getElementById('photo-preview-img')?.src || '';
    const photoUrl = photoSrc.startsWith('data:image/') ? photoSrc : null;
    const gymSlug = (new URLSearchParams(window.location.search).get('gym') || '').trim().toLowerCase();
    const btn = document.getElementById('btn-submit-member');
    const toast = (message, type) => window.showToast?.(message, type);
    if (!fullName) return toast('Please enter athlete full name', 'error');
    if (!/^\d{10}$/.test(cleanPhone)) return toast('Please enter a valid 10-digit mobile number', 'error');
    if (!gymSlug) return toast('Gym tenant is missing from this admin link', 'error');
    if (btn) { btn.innerText = 'Registering Athlete to Cloud...'; btn.disabled = true; }
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
      const rewardNote = cleanRefPhone && data.referrer_credited ? ' +7-day referral reward credited.' : '';
      window.playAudioChirp?.(880, 0.15);
      toast(`Athlete ${fullName} registered successfully.${rewardNote}`, 'success');
      window.closeAddMemberDrawer?.();
      await window.fetchAllData?.();
    } catch (err) {
      console.error('[ATOMIC MEMBER REGISTRATION]', err);
      toast(`Registration failed: ${err.message || err}`, 'error');
    } finally {
      if (btn) { btn.innerText = 'Confirm & Save Athlete to Cloud ⚡'; btn.disabled = false; }
    }
  };
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function fetchAllMembersForExport(gymId) {
  const rows = [];
  const pageSize = 100;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.rpc('rpc_nexus_member_search', { p_gym_id: Number(gymId), p_query: '', p_limit: pageSize, p_offset: offset });
    if (error) throw error;
    if (!data?.members?.length) break;
    rows.push(...data.members);
    if (rows.length >= Number(data.total || 0) || data.members.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function exportMembersCSVRobust() {
  const slug = (new URLSearchParams(window.location.search).get('gym') || '').trim().toLowerCase();
  if (!slug) throw new Error('Gym station is missing from this admin URL.');
  const { data: gym, error: gymError } = await supabase.from('gyms').select('id,gym_name,name,slug').eq('slug', slug).maybeSingle();
  if (gymError) throw gymError;
  if (!gym?.id) throw new Error('Gym station could not be resolved.');
  const members = await fetchAllMembersForExport(gym.id);
  if (!members.length) throw new Error('No athlete records found to export for this gym station.');
  const lines = [['Full Name','Phone','Gym Tenant','Valid Until','Plan','Referral Code','Referral Count','Status'].map(csvEscape).join(',')];
  for (const m of members) {
    const membership = m.membership || {};
    lines.push([m.full_name,m.phone,gym.slug,membership.end_date || '',membership.plan_name || '',m.referral_code || '','',m.is_active ? 'ACTIVE' : 'INACTIVE'].map(csvEscape).join(','));
  }
  const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const fileName = `${slug}_athlete_roster_${new Date().toISOString().slice(0,10)}.csv`;
  if (navigator.share && typeof File !== 'undefined') {
    try {
      const file = new File([blob], fileName, { type: 'text/csv' });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({ title: `${gym.gym_name || gym.name || slug} Athlete Roster`, files: [file] });
        return;
      }
    } catch (shareError) {
      if (shareError?.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 1500);
  if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    setTimeout(() => {
      const fallbackUrl = URL.createObjectURL(blob);
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(fallbackUrl), 30000);
    }, 250);
  }
}

function installRobustCsvExport() {
  if (typeof window === 'undefined') return;
  window.exportMembersCSV = async function() {
    try {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /Export CSV/i.test(b.textContent || ''));
      if (btn) { btn.disabled = true; btn.dataset.oldText = btn.innerText; btn.innerText = 'EXPORTING…'; }
      await exportMembersCSVRobust();
      window.showToast?.('Athlete roster exported successfully 📥', 'success');
    } catch (error) {
      console.error('[CSV EXPORT]', error);
      window.showToast?.(error?.message || 'CSV export failed.', 'error');
    } finally {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /EXPORTING|Export CSV/i.test(b.textContent || ''));
      if (btn) { btn.disabled = false; btn.innerText = btn.dataset.oldText || '📥 Export CSV'; }
    }
  };
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') installRobustCsvExport();
  else window.addEventListener('load', installRobustCsvExport, { once: true });
}
