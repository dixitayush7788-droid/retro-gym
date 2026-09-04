import { supabase } from './supabaseClient.js';

(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const getSlug = () => (new URLSearchParams(window.location.search).get('gym') || '').trim().toLowerCase();

  function clearOnboardingDefaults() {
    const fee = $('feeAmountInput');
    if (fee) {
      fee.value = '';
      fee.removeAttribute('value');
      fee.placeholder = 'Enter actual amount collected';
    }

    document.querySelectorAll('.plan-choice-btn').forEach((btn) => {
      btn.className = 'plan-choice-btn p-2.5 rounded-2xl bg-surfaceCard text-zinc-300 text-center border border-white/10 cursor-pointer hover:border-gold/50';
      btn.setAttribute('aria-pressed', 'false');
    });

    const expiry = $('new-expiry-preview');
    if (expiry) expiry.textContent = 'Select membership duration';
  }

  function wrapMemberPlanSelection() {
    if (window.__nexusPlanSelectionWrapped) return;
    if (typeof window.selectNewPlan !== 'function') return;
    const original = window.selectNewPlan;
    window.selectNewPlan = function(months, customFee = null) {
      const result = original.call(this, months, customFee);
      const fee = $('feeAmountInput');
      if (fee) fee.value = '';
      return result;
    };
    window.__nexusPlanSelectionWrapped = true;
  }

  function wrapMemberDrawer() {
    if (window.__nexusMemberDrawerWrapped) return;
    if (typeof window.openAddMemberDrawer !== 'function') return;
    const original = window.openAddMemberDrawer;
    window.openAddMemberDrawer = function(...args) {
      const result = original.apply(this, args);
      requestAnimationFrame(clearOnboardingDefaults);
      return result;
    };
    window.__nexusMemberDrawerWrapped = true;
  }

  function buildAthleteLink(slug) {
    const base = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '/')}`;
    return `${base}index.html?gym=${encodeURIComponent(slug)}`;
  }

  function openWelcomeWhatsApp(phone, fullName, slug, validUntil) {
    const cleanPhone = String(phone || '').replace(/\D/g, '').slice(-10);
    if (!/^\d{10}$/.test(cleanPhone)) return;

    const athleteLink = buildAthleteLink(slug);
    const message = [
      `Welcome to ${String(window.currentGymConfig?.gym_name || 'our gym')}! 🏋️‍♂️🔥`,
      '',
      `Hi ${fullName}, your membership has been successfully activated.`,
      `Valid until: ${validUntil || 'Active'}`,
      '',
      '🎯 Your Athlete Dashboard:',
      athleteLink,
      '',
      'Open the link and login with your registered mobile number. You can then set your 4-digit Athlete PIN and access your personal dashboard.',
      '',
      'Welcome to the family! 💪'
    ].join('\n');

    const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(message)}`;
    const opened = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (!opened) window.location.href = waUrl;
  }

  function wrapMemberCreate() {
    if (window.__nexusMemberCreateWrapped) return;
    if (typeof window.handleCreateMember !== 'function') return;
    const original = window.handleCreateMember;

    window.handleCreateMember = async function(event) {
      const feeInput = $('feeAmountInput');
      const fee = Number(feeInput?.value);
      const selectedPlan = document.querySelector('.plan-choice-btn.bg-gold, .plan-choice-btn[aria-pressed="true"]');
      if (!selectedPlan) {
        window.showToast?.('Please select a membership duration.', 'error');
        return;
      }
      if (!Number.isFinite(fee) || fee <= 0) {
        window.showToast?.('Please enter the actual amount collected.', 'error');
        feeInput?.focus();
        return;
      }

      const name = $('new-member-name')?.value?.trim() || '';
      const phone = $('new-member-phone')?.value || '';
      const slug = getSlug();
      const submitButton = $('btn-submit-member');
      const previousText = submitButton?.innerText;

      await original.call(this, event);

      // The canonical handler closes the drawer on success. A failed validation/API call keeps it open.
      const drawer = $('add-member-drawer');
      const succeeded = drawer?.classList.contains('hidden');
      if (succeeded && name && slug) {
        let validUntil = '';
        try {
          const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
          const { data: gym } = await supabase.from('gyms').select('id,name').eq('slug', slug).maybeSingle();
          if (gym?.id) {
            const { data: member } = await supabase.from('members').select('id').eq('gym_id', gym.id).eq('normalized_phone', cleanPhone).maybeSingle();
            if (member?.id) {
              const { data: membership } = await supabase.from('member_memberships').select('end_date').eq('gym_id', gym.id).eq('member_id', member.id).order('end_date', { ascending: false }).limit(1).maybeSingle();
              validUntil = membership?.end_date ? new Date(`${membership.end_date}T00:00:00`).toLocaleDateString('en-GB') : '';
            }
          }
        } catch (_) {}
        openWelcomeWhatsApp(phone, name, slug, validUntil);
      }

      if (submitButton && previousText && !submitButton.disabled) submitButton.innerText = previousText;
    };
    window.__nexusMemberCreateWrapped = true;
  }

  async function fixAdminPinGate() {
    const slug = getSlug();
    if (!slug || typeof window.setAdminPinMode !== 'function') return;

    try {
      const { data: gym, error } = await supabase.from('gyms').select('id').eq('slug', slug).maybeSingle();
      if (error || !gym?.id) return;

      const { data, error: pinError } = await supabase.rpc('rpc_get_admin_pin_state', { p_gym_id: gym.id });
      if (pinError) return;

      const configured = data === true || data?.configured === true || data?.has_pin === true || data?.pin_configured === true || data?.success === true && (data?.configured !== false);
      if (configured) {
        window.setAdminPinMode('unlock');
        const title = $('admin-pin-modal-title');
        const subtitle = $('admin-pin-modal-subtitle');
        const label = $('admin-pin-modal-label');
        if (title) title.textContent = 'SECURITY COMMAND';
        if (subtitle) subtitle.textContent = 'Cyber Master Security Terminal';
        if (label) label.textContent = 'Enter Admin Security PIN';
      }
    } catch (e) {
      console.warn('[NEXUS PIN STATE]', e);
    }
  }

  function addMobileSafeArea() {
    const root = document.querySelector('body > div.min-h-screen');
    if (root) root.style.paddingBottom = '190px';
  }

  function init() {
    wrapMemberPlanSelection();
    wrapMemberDrawer();
    wrapMemberCreate();
    addMobileSafeArea();
    clearOnboardingDefaults();
    fixAdminPinGate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else setTimeout(init, 0);
})();
