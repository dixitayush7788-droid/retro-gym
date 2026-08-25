import { supabase } from './supabaseClient.js';

function cleanPhone(phone) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
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

export async function getPublicHudPass(gymSlug, phoneNumber) {
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

// Replace the legacy client-side roster/PIN flow with server-side RPC auth.
function installPortalAuthOverrides() {
  if (typeof window === 'undefined') return;

  window.handlePhoneSubmit = async function () {
    const input = document.getElementById('auth-phone-input');
    const btn = document.getElementById('btn-phone-submit');
    const phone = cleanPhone(input?.value);
    const gymSlug = new URLSearchParams(window.location.search).get('gym') || '';

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
    const gymSlug = new URLSearchParams(window.location.search).get('gym') || '';
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
        id: result.member_id,
        gym_id: pending.gym_id,
        gym_slug: gymSlug,
        full_name: result.full_name,
        phone: result.phone,
        normalized_phone: result.phone,
        referral_code: result.referral_code,
        is_active: result.is_active,
        valid_until: result.valid_until,
        days_remaining: result.days_remaining,
        plan_name: result.plan_name,
        membership_status: result.membership_status
      };

      if (typeof window.renderAthletePass === 'function') {
        window.renderAthletePass(memberData);
      } else {
        localStorage.setItem('rg_member_session', JSON.stringify(memberData));
      }
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
