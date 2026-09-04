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
    if (window.__nexusPlanSelectionWrapped || typeof window.selectNewPlan !== 'function') return;
    const original = window.selectNewPlan;
    window.selectNewPlan = function(months, customFee = null) {
      const result = original.call(this, months, customFee);
      const fee = $('feeAmountInput');
      if (fee) {
        fee.value = '';
        fee.placeholder = 'Enter actual amount collected';
      }
      document.querySelectorAll('.plan-choice-btn').forEach((btn) => btn.setAttribute('aria-pressed', 'false'));
      const active = $(`plan-opt-${months}`);
      if (active) active.setAttribute('aria-pressed', 'true');
      return result;
    };
    window.__nexusPlanSelectionWrapped = true;
  }

  function wrapMemberDrawer() {
    if (window.__nexusMemberDrawerWrapped || typeof window.openAddMemberDrawer !== 'function') return;
    const original = window.openAddMemberDrawer;
    window.openAddMemberDrawer = function(...args) {
      const result = original.apply(this, args);
      requestAnimationFrame(clearOnboardingDefaults);
      return result;
    };
    window.__nexusMemberDrawerWrapped = true;
  }

  function wrapMemberCreateValidation() {
    if (window.__nexusMemberCreateValidationWrapped || typeof window.handleCreateMember !== 'function') return;
    const original = window.handleCreateMember;
    window.handleCreateMember = async function(e) {
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
      return original.call(this, e);
    };
    window.__nexusMemberCreateValidationWrapped = true;
  }

  async function fixAdminPinGate() {
    const slug = getSlug();
    if (!slug || typeof window.setAdminPinMode !== 'function') return;
    try {
      const { data: gym, error } = await supabase.from('gyms').select('id').eq('slug', slug).maybeSingle();
      if (error || !gym?.id) return;
      const { data, error: pinError } = await supabase.rpc('rpc_get_admin_pin_state', { p_gym_id: gym.id });
      if (pinError) return;
      const configured = data === true || data?.configured === true || data?.has_pin === true || data?.pin_configured === true || (data?.success === true && data?.configured !== false);
      if (configured) window.setAdminPinMode('unlock');
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
    wrapMemberCreateValidation();
    addMobileSafeArea();
    clearOnboardingDefaults();
    fixAdminPinGate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else setTimeout(init, 0);
})();
