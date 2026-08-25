import { supabase } from './supabaseClient.js';

function cleanPhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function getGymSlug() {
  return new URLSearchParams(window.location.search).get('gym') || '';
}

function saveMemberSession(data) {
  if (!data?.session_token) return;
  const session = {
    id: data.member_id,
    gym_id: data.gym_id || window.__nexusPendingMemberAuth?.gym_id || null,
    gym_slug: getGymSlug(),
    full_name: data.full_name,
    phone: data.phone,
    normalized_phone: data.phone,
    referral_code: data.referral_code,
    is_active: data.is_active,
    valid_until: data.valid_until,
    days_remaining: data.days_remaining,
    plan_name: data.plan_name,
    membership_status: data.membership_status,
    referral_count: data.referral_count || 0,
    referral_free_days: data.referral_free_days || 0,
    referral_money_saved: data.referral_money_saved || 0,
    referrals: Array.isArray(data.referrals) ? data.referrals : [],
    session_token: data.session_token,
    session_expires_at: data.session_expires_at || null,
    saved_at: Date.now()
  };
  localStorage.setItem('rg_member_session', JSON.stringify(session));
  return session;
}

function saveRefreshedMember(data, existing) {
  return saveMemberSession({
    ...existing,
    ...data,
    session_token: existing?.session_token,
    gym_id: existing?.gym_id,
    phone: data.phone || existing?.phone,
    member_id: data.member_id || existing?.id
  });
}

export async function getMemberAuthState(gymSlug, phoneNumber) {
  const { data, error } = await supabase.rpc('rpc_member_auth_start', {
    p_gym_slug: gymSlug,
    p_phone: cleanPhone(phoneNumber)
  });
  if (error) throw error;
  if (!data?.success) return null;
  return data;
}

export async function setMemberPin(gymSlug, phoneNumber, pin) {
  const { data, error } = await supabase.rpc('rpc_member_set_pin', {
    p_gym_slug: gymSlug,
    p_phone: cleanPhone(phoneNumber),
    p_pin: String(pin)
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Unable to set PIN');
  return data;
}

export async function verifyMemberPin(gymSlug, phoneNumber, pin) {
  const { data, error } = await supabase.rpc('rpc_member_verify_pin', {
    p_gym_slug: gymSlug,
    p_phone: cleanPhone(phoneNumber),
    p_pin: String(pin)
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Authentication failed');
  return data;
}

export async function refreshMemberSession(gymSlug, sessionToken) {
  const { data, error } = await supabase.rpc('rpc_member_refresh_session', {
    p_gym_slug: gymSlug,
    p_session_token: String(sessionToken || '')
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Session expired');
  return data;
}

export async function logoutMemberSession(sessionToken) {
  try {
    await supabase.rpc('rpc_member_logout', { p_session_token: String(sessionToken || '') });
  } catch (_) {}
  localStorage.removeItem('rg_member_session');
}

export async function getPublicHudPass(gymSlug, phoneNumber) {
  // Kept for compatibility with the existing portal boot code.
  // The new authenticated member session is the authoritative live data path.
  try {
    const { data, error } = await supabase.rpc('rpc_get_member_hud_pass', {
      p_gym_slug: gymSlug,
      p_phone: cleanPhone(phoneNumber)
    });
    if (!error && data?.success) return data;
  } catch (_) {}
  return null;
}

export async function claimMemberPass(gymId, phoneNumber) {
  const { data, error } = await supabase.rpc('rpc_claim_member_pass', {
    p_gym_id: Number(gymId),
    p_phone: cleanPhone(phoneNumber)
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Unable to claim member pass');
  return data;
}

function applyReferralUI(data) {
  const count = Number(data?.referral_count || 0);
  const referrals = Array.isArray(data?.referrals) ? data.referrals : [];
  const freeDays = Number(data?.referral_free_days || count * 7);
  const moneySaved = Number(data?.referral_money_saved || 0);

  const countEl = document.getElementById('reward-friends-count');
  const freeDaysEl = document.getElementById('reward-free-days');
  const moneySavedEl = document.getElementById('reward-money-saved');
  const milestoneBar = document.getElementById('reward-milestone-bar');
  const milestonePct = document.getElementById('reward-milestone-pct');
  const milestoneLabel = document.getElementById('reward-milestone-label');
  const tierBadge = document.getElementById('reward-tier-badge');
  const codeDisplay = document.getElementById('reward-referral-code-display');
  const container = document.getElementById('referral-squad-container');

  if (countEl) countEl.innerText = String(count);
  if (freeDaysEl) freeDaysEl.innerText = `+${freeDays} Days`;
  if (moneySavedEl) moneySavedEl.innerText = `₹${moneySaved.toLocaleString('en-IN')}`;
  if (codeDisplay && data?.referral_code) codeDisplay.innerText = data.referral_code;

  let targetFriends = 3;
  let tierName = 'LEVEL 1 RECRUITER';
  if (count >= 6) {
    targetFriends = 10;
    tierName = 'GOLD AMBASSADOR 👑';
  } else if (count >= 3) {
    targetFriends = 6;
    tierName = 'SILVER POWER RECRUITER 🥈';
  } else if (count >= 1) {
    targetFriends = 3;
    tierName = 'BRONZE SQUAD LEADER 🥉';
  }
  const progressPct = Math.min(100, Math.round((count / targetFriends) * 100));
  if (milestonePct) milestonePct.innerText = `${progressPct}%`;
  if (milestoneBar) milestoneBar.style.width = `${progressPct}%`;
  if (milestoneLabel) milestoneLabel.innerText = `Next Target: ${targetFriends} Friends (+${targetFriends * 7} Days)`;
  if (tierBadge) tierBadge.innerText = tierName;

  if (!container) return;
  if (referrals.length === 0) {
    container.innerHTML = `<div class="text-center py-8 text-zinc-500 space-y-2"><div class="text-3xl">👥</div><p class="text-xs">No referrals credited yet.</p><p class="text-[10px] text-zinc-600">Invite a friend and their registration will appear here automatically.</p></div>`;
    return;
  }

  container.innerHTML = referrals.map((r) => {
    const safeName = String(r.full_name || 'Referred Athlete').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const safePhone = String(r.phone || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
    const date = r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '—';
    return `<div class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-black/40 border border-white/10"><div><div class="font-bold text-white">${safeName}</div><div class="text-[10px] text-zinc-500">${safePhone} • Joined ${date}</div></div><div class="text-right"><div class="text-cyberVolt font-bold">+7 Days</div><div class="text-[9px] text-zinc-500 uppercase">Credited</div></div></div>`;
  }).join('');
}

function applyMemberSessionToPortal(data, existing) {
  const session = saveRefreshedMember(data, existing);
  const memberData = {
    id: session.id,
    gym_id: session.gym_id,
    gym_slug: session.gym_slug,
    full_name: session.full_name,
    phone: session.phone,
    normalized_phone: session.normalized_phone,
    referral_code: session.referral_code,
    is_active: session.is_active,
    valid_until: session.valid_until,
    days_remaining: session.days_remaining,
    plan_name: session.plan_name,
    membership_status: session.membership_status,
    referral_count: session.referral_count,
    referral_free_days: session.referral_free_days,
    referral_money_saved: session.referral_money_saved,
    referrals: session.referrals
  };

  if (typeof window.renderAthletePass === 'function') {
    window.renderAthletePass(memberData);
  }
  applyReferralUI(session);
  window.__nexusMemberSession = session;
  return session;
}

async function syncSavedMemberSession(silent = true) {
  const gymSlug = getGymSlug();
  if (!gymSlug) return null;
  let existing;
  try {
    existing = JSON.parse(localStorage.getItem('rg_member_session') || 'null');
  } catch (_) {
    existing = null;
  }
  if (!existing?.session_token) return null;
  try {
    const data = await refreshMemberSession(gymSlug, existing.session_token);
    return applyMemberSessionToPortal(data, existing);
  } catch (err) {
    localStorage.removeItem('rg_member_session');
    window.__nexusMemberSession = null;
    if (!silent && typeof window.showToast === 'function') window.showToast(err?.message || 'Member session expired.', 'error');
    document.getElementById('auth-modal')?.classList.remove('hidden');
    return null;
  }
}

function installLivePortalSync() {
  if (typeof window === 'undefined') return;

  // The old portal queried protected tables directly. Replace its referral loader
  // with the authenticated session RPC so referral stats work for anonymous web/PWA users.
  const wrapReferralLoader = () => {
    window.loadReferralSquad = async function () {
      const session = await syncSavedMemberSession(true);
      if (session) applyReferralUI(session);
    };
  };
  wrapReferralLoader();

  // Refresh after every foreground/resume event and periodically while open.
  const refresh = () => { syncSavedMemberSession(true); };
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refresh();
  });
  setInterval(refresh, 30000);

  // Give the old boot sequence a moment to finish, then make our secure session authoritative.
  setTimeout(() => syncSavedMemberSession(true), 250);
  setTimeout(() => syncSavedMemberSession(true), 1500);
}

function installPortalAuthOverrides() {
  if (typeof window === 'undefined') return;

  window.handlePhoneSubmit = async function () {
    const input = document.getElementById('auth-phone-input');
    const btn = document.getElementById('btn-phone-submit');
    const phone = cleanPhone(input?.value);
    const gymSlug = getGymSlug();

    if (phone.length !== 10) {
      if (typeof window.playCyberChime === 'function') window.playCyberChime('alert');
      if (typeof window.showToast === 'function') window.showToast('Enter a valid 10-digit mobile number.', 'error');
      return;
    }

    if (btn) { btn.disabled = true; btn.innerText = 'QUERYING ROSTER...'; }
    try {
      const member = await getMemberAuthState(gymSlug, phone);
      if (!member) throw new Error('Athlete not found on roster. Please register at front desk.');

      window.__nexusPendingMemberAuth = member;
      document.getElementById('auth-step-phone')?.classList.add('hidden');
      document.getElementById('auth-step-pin')?.classList.remove('hidden');

      const heading = document.getElementById('auth-pin-heading');
      const subheading = document.getElementById('auth-pin-subheading');
      const status = document.getElementById('pin-auth-status-text');
      if (member.has_pin) {
        if (heading) heading.innerText = 'ENTER 4-DIGIT SECURITY PIN';
        if (subheading) subheading.innerText = `Welcome back, ${member.full_name}!`;
        if (status) status.innerText = 'Passkey Required';
      } else {
        if (heading) heading.innerText = 'CREATE 4-DIGIT PASSKEY PIN';
        if (subheading) subheading.innerText = 'Set your personal security passkey PIN';
        if (status) status.innerText = 'New Pass Setup';
      }
      if (typeof window.clearAuthKey === 'function') window.clearAuthKey();
    } catch (err) {
      if (typeof window.playCyberChime === 'function') window.playCyberChime('alert');
      if (typeof window.showToast === 'function') window.showToast(err?.message || 'Unable to verify athlete.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = 'VERIFY ATHLETE IDENTITY ⚡'; }
    }
  };

  window.submitPinAuth = async function () {
    const pin = Array.from(document.querySelectorAll('.pin-box')).map(el => el.value).join('');
    const pending = window.__nexusPendingMemberAuth;
    const gymSlug = getGymSlug();
    if (pin.length !== 4) {
      if (typeof window.showToast === 'function') window.showToast('Please enter all 4 digits of your PIN.', 'alert');
      return;
    }
    if (!pending?.phone) {
      if (typeof window.showToast === 'function') window.showToast('Session expired. Please enter your mobile number again.', 'error');
      return;
    }

    try {
      let result;
      if (!pending.has_pin) {
        await setMemberPin(gymSlug, pending.phone, pin);
        result = await verifyMemberPin(gymSlug, pending.phone, pin);
        if (typeof window.showToast === 'function') window.showToast('4-Digit Security PIN Saved Successfully! 🔒', 'success');
      } else {
        result = await verifyMemberPin(gymSlug, pending.phone, pin);
      }

      const memberData = {
        member_id: result.member_id,
        gym_id: pending.gym_id,
        full_name: result.full_name,
        phone: result.phone,
        referral_code: result.referral_code,
        is_active: result.is_active,
        valid_until: result.valid_until,
        days_remaining: result.days_remaining,
        plan_name: result.plan_name,
        membership_status: result.membership_status,
        session_token: result.session_token,
        session_expires_at: result.session_expires_at
      };

      const session = saveMemberSession(memberData);
      session.id = result.member_id;
      session.gym_id = pending.gym_id;
      session.gym_slug = gymSlug;
      localStorage.setItem('rg_member_session', JSON.stringify(session));

      // Immediately hydrate with the authoritative live payload, including referral data.
      const fresh = await refreshMemberSession(gymSlug, result.session_token);
      applyMemberSessionToPortal(fresh, session);

      window.__nexusPendingMemberAuth = null;
      document.getElementById('auth-modal')?.classList.add('hidden');
      if (typeof window.playCyberChime === 'function') window.playCyberChime('success');
      if (typeof window.showToast === 'function') window.showToast(`Authenticated: Welcome, ${result.full_name}! ⚡`, 'success');
    } catch (err) {
      if (typeof window.playCyberChime === 'function') window.playCyberChime('alert');
      if (typeof window.showToast === 'function') window.showToast(err?.message || 'Authentication failed.', 'error');
      if (typeof window.clearAuthKey === 'function') window.clearAuthKey();
    }
  };
}

installPortalAuthOverrides();
if (typeof window !== 'undefined') {
  if (document.readyState === 'complete') installLivePortalSync();
  else window.addEventListener('load', installLivePortalSync, { once: true });
}
