(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);

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
      const feeInput = $('feeAmountInput');
      const before = feeInput ? Number(feeInput.value) : NaN;
      const hasExplicitAmount = Number.isFinite(before) && before > 0;
      const result = original.call(this, months, customFee);
      // Selecting a duration must never overwrite an amount the owner already entered.
      if (feeInput) {
        feeInput.value = hasExplicitAmount ? String(before) : '';
        feeInput.placeholder = 'Enter actual amount collected';
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
      const selectedPlan = document.querySelector('.plan-choice-btn[aria-pressed="true"]');
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

  function init() {
    wrapMemberPlanSelection();
    wrapMemberDrawer();
    wrapMemberCreateValidation();
    clearOnboardingDefaults();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
