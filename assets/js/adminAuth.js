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

    // Never persist the terminal PIN itself. The unlock state is sufficient for this tab.
    sessionStorage.setItem(`nexus_terminal_unlock_${gymId}`, 'true');
    alert('Terminal unlocked successfully.');
  });
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
    const { data, error } = await supabase.rpc('rpc_nexus_member_search', {
      p_gym_id: Number(gymId),
      p_query: '',
      p_limit: pageSize,
      p_offset: offset
    });
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

  const { data: gym, error: gymError } = await supabase
    .from('gyms')
    .select('id,gym_name,name,slug')
    .eq('slug', slug)
    .maybeSingle();
  if (gymError) throw gymError;
  if (!gym?.id) throw new Error('Gym station could not be resolved.');

  const members = await fetchAllMembersForExport(gym.id);
  if (!members.length) throw new Error('No athlete records found to export for this gym station.');

  const lines = [
    ['Full Name','Phone','Gym Tenant','Valid Until','Plan','Referral Code','Referral Count','Status'].map(csvEscape).join(',')
  ];

  for (const m of members) {
    const membership = m.membership || {};
    lines.push([
      m.full_name,
      m.phone,
      gym.slug,
      membership.end_date || '',
      membership.plan_name || '',
      m.referral_code || '',
      '',
      m.is_active ? 'ACTIVE' : 'INACTIVE'
    ].map(csvEscape).join(','));
  }

  const csv = '\uFEFF' + lines.join('\r\n') + '\r\n';
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const fileName = `${slug}_athlete_roster_${new Date().toISOString().slice(0,10)}.csv`;

  // iOS Safari handles a real File through the Share sheet more reliably than
  // programmatic blob downloads. Use it when available, otherwise use download.
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
  setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1500);

  // If Safari ignores the download attribute, leave the user a readable CSV tab.
  setTimeout(() => {
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      const fallbackUrl = URL.createObjectURL(blob);
      window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(fallbackUrl), 30000);
    }
  }, 250);
}

function installRobustCsvExport() {
  if (typeof window === 'undefined') return;
  window.exportMembersCSV = async function () {
    try {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /Export CSV/i.test(b.textContent || ''));
      if (btn) { btn.disabled = true; btn.dataset.oldText = btn.innerText; btn.innerText = 'EXPORTING…'; }
      await exportMembersCSVRobust();
      if (typeof window.showToast === 'function') window.showToast('Athlete roster exported successfully 📥', 'success');
    } catch (error) {
      console.error('[CSV EXPORT]', error);
      if (typeof window.showToast === 'function') window.showToast(error?.message || 'CSV export failed.', 'error');
      else alert(error?.message || 'CSV export failed.');
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
