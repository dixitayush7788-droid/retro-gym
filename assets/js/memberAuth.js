import { supabase } from './supabaseClient.js';
import './memberLiveSync.js';

function cleanPhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

function getGymSlug() {
  const urlParam = new URLSearchParams(window.location.search).get('gym');
  if (urlParam) return urlParam.toLowerCase().trim();
  if (window.currentGymSlug) return window.currentGymSlug.toLowerCase().trim();
  try {
    const saved = JSON.parse(localStorage.getItem('rg_member_session') || 'null');
    if (saved && (saved.gym_slug || saved.gym_id)) {
      return String(saved.gym_slug || saved.gym_id).toLowerCase().trim();
    }
  } catch (_) {}
  return (localStorage.getItem('rg_last_gym_slug') || 'akash-fitness').toLowerCase().trim();
}

function saveMemberSession(data) {
  if (!data?.session_token) return;
  const session = {
    id: data.member_id || data.id,
    gym_id: data.gym_id || window.__nexusPendingMemberAuth?.gym_id || null,
    gym_slug: data.gym_slug || getGymSlug(),
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
  window.__nexusMemberSession = session;
  window.currentAthlete = session;
  window.__nexusStartMemberLiveSync?.();
  return session;
}

function saveRefreshedMember(data, existing) {
  return saveMemberSession({ ...existing, ...data, session_token: existing?.session_token, gym_id: existing?.gym_id, gym_slug: existing?.gym_slug || getGymSlug(), phone: data.phone || existing?.phone, member_id: data.member_id || existing?.id });
}

export async function getMemberAuthState(gymSlug, phoneNumber) {
  const { data, error } = await supabase.rpc('rpc_member_auth_start', { p_gym_slug: gymSlug, p_phone: cleanPhone(phoneNumber) });
  if (error) throw error;
  if (!data?.success) return null;
  return data;
}

export async function setMemberPin(gymSlug, phoneNumber, pin) {
  const { data, error } = await supabase.rpc('rpc_member_set_pin', { p_gym_slug: gymSlug, p_phone: cleanPhone(phoneNumber), p_pin: String(pin) });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Unable to set PIN');
  return data;
}

export async function verifyMemberPin(gymSlug, phoneNumber, pin) {
  const { data, error } = await supabase.rpc('rpc_member_verify_pin', { p_gym_slug: gymSlug, p_phone: cleanPhone(phoneNumber), p_pin: String(pin) });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Authentication failed');
  return data;
}

export async function refreshMemberSession(gymSlug, sessionToken) {
  const { data, error } = await supabase.rpc('rpc_member_refresh_session', { p_gym_slug: gymSlug, p_session_token: String(sessionToken || '') });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Session expired');
  return data;
}

export async function logoutMemberSession(sessionToken) {
  try { await supabase.rpc('rpc_member_logout', { p_session_token: String(sessionToken || '') }); } catch (_) {}
  localStorage.removeItem('rg_member_session');
  window.__nexusMemberSession = null;
  window.currentAthlete = null;
  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.classList.remove('hidden');
    authModal.style.display = 'flex';
  }
  window.dispatchEvent(new CustomEvent('nexus:member-logout'));
  window.__nexusRefreshMemberUI?.();
}

export async function getPublicHudPass(gymSlug, phoneNumber) {
  return getMemberAuthState(gymSlug, phoneNumber);
}

export async function claimMemberPass(gymId, phoneNumber) {
  const { data, error } = await supabase.rpc('rpc_claim_member_pass', { p_gym_id: Number(gymId), p_phone: cleanPhone(phoneNumber) });
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
  if (count >= 6) { targetFriends = 10; tierName = 'GOLD AMBASSADOR 👑'; }
  else if (count >= 3) { targetFriends = 6; tierName = 'SILVER POWER RECRUITER 🥈'; }
  else if (count >= 1) { targetFriends = 3; tierName = 'BRONZE SQUAD LEADER 🥉'; }
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
  if (!session) return null;
  const memberData = { id: session.id, gym_id: session.gym_id, gym_slug: session.gym_slug, full_name: session.full_name, phone: session.phone, normalized_phone: session.normalized_phone, referral_code: session.referral_code, is_active: session.is_active, valid_until: session.valid_until, days_remaining: session.days_remaining, plan_name: session.plan_name, membership_status: session.membership_status, referral_count: session.referral_count, referral_free_days: session.referral_free_days, referral_money_saved: session.referral_money_saved, referrals: session.referrals };
  window.currentAthlete = memberData;
  if (typeof window.renderAthletePass === 'function') window.renderAthletePass(memberData);
  localStorage.setItem('rg_member_session', JSON.stringify(session));
  applyReferralUI(session);
  window.__nexusMemberSession = session;
  window.dispatchEvent(new CustomEvent('nexus:member-auth', { detail: session }));
  window.__nexusRefreshMemberUI?.();
  return session;
}

async function syncSavedMemberSession(silent = true) {
  const gymSlug = getGymSlug();
  if (!gymSlug) return null;
  let existing;
  try { existing = JSON.parse(localStorage.getItem('rg_member_session') || 'null'); } catch (_) { existing = null; }
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
  if (typeof window.renderAthletePass === 'function' && !window.__nexusRenderWrapped) {
    const originalRender = window.renderAthletePass;
    window.renderAthletePass = function(data) {
      originalRender(data);
      try {
        const secure = window.__nexusMemberSession || JSON.parse(localStorage.getItem('rg_member_session') || 'null');
        if (secure?.session_token) localStorage.setItem('rg_member_session', JSON.stringify(secure));
      } catch (_) {}
    };
    window.__nexusRenderWrapped = true;
  }
  window.loadReferralSquad = async function() {
    const session = await syncSavedMemberSession(true);
    if (session) applyReferralUI(session);
  };
  const refresh = () => { syncSavedMemberSession(true); };
  window.addEventListener('focus', refresh);
  window.addEventListener('online', refresh);
  window.addEventListener('pageshow', refresh);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
  setInterval(refresh, 30000);
  setTimeout(() => syncSavedMemberSession(true), 250);
  setTimeout(() => syncSavedMemberSession(true), 1500);
}

window.addEventListener('nexus:member-live-update', (event) => {
  try {
    const existing = JSON.parse(localStorage.getItem('rg_member_session') || 'null');
    if (existing?.session_token && event.detail?.member_id) {
      applyMemberSessionToPortal(event.detail, existing);
    }
  } catch (_) {}
});

function installPortalAuthOverrides() {
  if (typeof window === 'undefined') return;
  window.handlePhoneSubmit = async function() {
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
  window.submitPinAuth = async function() {
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
      const session = saveMemberSession({ member_id: result.member_id, gym_id: pending.gym_id, gym_slug: gymSlug, full_name: result.full_name, phone: result.phone, referral_code: result.referral_code, is_active: result.is_active, valid_until: result.valid_until, days_remaining: result.days_remaining, plan_name: result.plan_name, membership_status: result.membership_status, session_token: result.session_token, session_expires_at: result.session_expires_at });
      const fresh = await refreshMemberSession(gymSlug, result.session_token);
      applyMemberSessionToPortal(fresh, session);
      window.__nexusPendingMemberAuth = null;
      const authModal = document.getElementById('auth-modal');
      if (authModal) {
        authModal.classList.add('hidden');
        authModal.style.display = 'none';
      }
      window.dispatchEvent(new CustomEvent('nexus:member-login', { detail: session }));
      window.__nexusRefreshMemberUI?.();
      if (typeof window.playCyberChime === 'function') window.playCyberChime('success');
      if (typeof window.showToast === 'function') window.showToast(`Authenticated: Welcome, ${result.full_name}! ⚡`, 'success');
      if (typeof window.fetchFreshAthleteData === 'function') window.fetchFreshAthleteData(result.phone);
      if (typeof window.fetchAthleteAttendanceHistory === 'function') window.fetchAthleteAttendanceHistory();
      if (typeof window.checkTodayAttendancePunchState === 'function') window.checkTodayAttendancePunchState();
      if (typeof window.fetchReferralSquad === 'function') window.fetchReferralSquad();
    } catch (err) {
      if (typeof window.playCyberChime === 'function') window.playCyberChime('alert');
      if (typeof window.showToast === 'function') window.showToast(err?.message || 'Authentication failed.', 'error');
      if (typeof window.clearAuthKey === 'function') window.clearAuthKey();
    }
  };
}

function installSecureMemberPunchOverride() {
  if (typeof window === 'undefined') return;
  window.executeVerifiedAttendancePunch = async function() {
    const athlete = window.__nexusMemberSession || (() => {
      try { return JSON.parse(localStorage.getItem('rg_member_session') || 'null'); } catch (_) { return null; }
    })();
    const gymSlug = getGymSlug();
    const memberId = athlete?.member_id || athlete?.id;
    const sessionToken = athlete?.session_token;
    if (!memberId || !sessionToken || !gymSlug) {
      if (typeof window.showToast === 'function') window.showToast('Secure member session missing. Please log in again.', 'error');
      return;
    }
    try {
      const { data, error } = await supabase.rpc('rpc_member_check_in', {
        p_gym_slug: gymSlug,
        p_member_id: memberId,
        p_session_token: sessionToken,
        p_qr_token: `AUTH_DESK_QR_${gymSlug}_2026`
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Attendance punch rejected');
      const merged = { ...athlete, id: memberId, member_id: memberId, gym_slug: gymSlug, session_token: sessionToken, streak_count: Number(data.streak_count || 0), saved_at: Date.now() };
      localStorage.setItem('rg_member_session', JSON.stringify(merged));
      window.__nexusMemberSession = merged;
      if (typeof window.markPunchButtonVerified === 'function') window.markPunchButtonVerified(data.check_in);
      if (typeof window.renderAthletePassHUD === 'function') window.renderAthletePassHUD();
      if (typeof window.fetchAthleteAttendanceHistory === 'function') window.fetchAthleteAttendanceHistory();
      if (typeof window.playCyberChime === 'function') window.playCyberChime('success');
      if (typeof window.showToast === 'function') window.showToast(data.status === 'ALREADY_CHECKED_IN' ? '✓ Attendance already verified today!' : '✓ Desk QR Attendance Verified! 🔥', 'success');
    } catch (err) {
      if (typeof window.playCyberChime === 'function') window.playCyberChime('alert');
      if (typeof window.showToast === 'function') window.showToast('Attendance sync error: ' + (err?.message || err), 'error');
    }
  };
}

installLivePortalSync();
installPortalAuthOverrides();
installSecureMemberPunchOverride();
