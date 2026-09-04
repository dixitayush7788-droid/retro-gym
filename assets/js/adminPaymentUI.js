import { supabase } from './supabaseClient.js';

(() => {
  'use strict';

  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const esc = (s) => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));

  function ensureModal() {
    if (document.getElementById('nexus-payment-modal')) return;
    const el = document.createElement('div');
    el.id = 'nexus-payment-modal';
    el.className = 'fixed inset-0 z-[100] hidden bg-black/85 backdrop-blur-md items-end sm:items-center justify-center p-0 sm:p-4';
    el.innerHTML = `
      <div class="w-full max-w-md bg-[#0d0d12] border border-emerald-400/40 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-white/10 pb-3">
          <div>
            <h3 id="nexus-payment-title" class="font-bold text-white text-lg">RECORD MEMBER PAYMENT</h3>
            <p id="nexus-payment-member" class="text-[11px] font-mono text-zinc-400 mt-1">Member</p>
          </div>
          <button id="nexus-payment-close" type="button" class="w-8 h-8 rounded-xl bg-white/5 text-zinc-300">✕</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div class="rounded-2xl bg-black/30 border border-white/10 p-3">
            <div class="text-[9px] font-mono text-zinc-500 uppercase">Membership</div>
            <div id="nexus-payment-validity" class="text-sm font-bold text-goldLight mt-1">--</div>
          </div>
          <div class="rounded-2xl bg-black/30 border border-white/10 p-3">
            <div class="text-[9px] font-mono text-zinc-500 uppercase">Suggested</div>
            <div id="nexus-payment-suggested" class="text-sm font-bold text-zinc-200 mt-1">--</div>
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Actual Amount Collected (₹) *</label>
          <input id="nexus-payment-amount" type="number" min="1" max="100000000" step="1" inputmode="decimal" class="w-full bg-black/40 border border-emerald-400/30 focus:border-emerald-400 rounded-2xl p-3.5 text-xl font-bold text-emerald-300 outline-none" placeholder="Enter actual amount" />
          <p class="text-[10px] text-zinc-500 mt-1">This amount is stored for this member's payment cycle. It is not forced to the plan price.</p>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Payment Method</label>
            <select id="nexus-payment-method" class="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm text-white outline-none">
              <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option><option value="other">Other</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Transaction Ref</label>
            <input id="nexus-payment-ref" type="text" maxlength="120" class="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm text-white outline-none" placeholder="Optional" />
          </div>
        </div>
        <div>
          <label class="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Notes</label>
          <input id="nexus-payment-notes" type="text" maxlength="500" class="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm text-white outline-none" placeholder="Discount, partial payment, etc." />
        </div>
        <div class="flex gap-2 pt-1">
          <button id="nexus-payment-save" type="button" class="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-bold">SAVE PAYMENT</button>
          <button id="nexus-payment-cancel" type="button" class="px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-zinc-300">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(el);
    const close = () => el.classList.add('hidden');
    document.getElementById('nexus-payment-close').onclick = close;
    document.getElementById('nexus-payment-cancel').onclick = close;
  }

  let state = null;

  async function savePayment() {
    if (!state) return;
    const amount = Number(document.getElementById('nexus-payment-amount').value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) {
      window.showToast?.('Enter a valid payment amount.', 'error');
      return;
    }
    const method = document.getElementById('nexus-payment-method').value;
    const ref = document.getElementById('nexus-payment-ref').value.trim();
    const notes = document.getElementById('nexus-payment-notes').value.trim();
    const gymId = Number(window.currentGymConfig?.id || state.member?.gymId || 0);
    const memberId = state.member?.id || state.member?.raw?.id;
    const membershipId = state.member?.membershipId;
    if (!gymId || !memberId || !membershipId) {
      window.showToast?.('Member membership record is missing. Sync the roster and try again.', 'error');
      return;
    }

    const btn = document.getElementById('nexus-payment-save');
    btn.disabled = true;
    btn.textContent = 'SAVING…';
    try {
      const { data, error } = await supabase.rpc('rpc_nexus_record_payment', {
        p_gym_id: gymId,
        p_member_id: memberId,
        p_membership_id: membershipId,
        p_amount: amount,
        p_payment_method: method,
        p_payment_status: 'completed',
        p_transaction_ref: ref || null,
        p_notes: notes || null
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Payment was rejected.');
      document.getElementById('nexus-payment-modal').classList.add('hidden');
      window.showToast?.(`${money(amount)} payment saved for ${state.member.fullName}.`, 'success');
      if (typeof window.fetchAllData === 'function') await window.fetchAllData();
      if (state.member?.phone && typeof window.openAthleteDossier === 'function') window.openAthleteDossier(state.member.phone, false);
    } catch (err) {
      console.error('[NEXUS PAYMENT]', err);
      window.showToast?.(`Payment failed: ${err.message || err}`, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'SAVE PAYMENT';
    }
  }

  function openPayment(member, suggested = 0, mode = 'payment') {
    ensureModal();
    state = { member };
    const modal = document.getElementById('nexus-payment-modal');
    document.getElementById('nexus-payment-title').textContent = mode === 'renewal' ? 'RECORD RENEWAL PAYMENT' : 'RECORD MEMBER PAYMENT';
    document.getElementById('nexus-payment-member').textContent = `${member.fullName} • +91 ${member.phone}`;
    document.getElementById('nexus-payment-validity').textContent = member.validUntil ? new Date(member.validUntil).toLocaleDateString('en-GB') : '--';
    document.getElementById('nexus-payment-suggested').textContent = suggested ? money(suggested) : 'Custom';
    document.getElementById('nexus-payment-amount').value = suggested > 0 ? String(suggested) : '';
    document.getElementById('nexus-payment-ref').value = '';
    document.getElementById('nexus-payment-notes').value = '';
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => document.getElementById('nexus-payment-amount')?.focus(), 40);
  }

  function install() {
    ensureModal();
    document.getElementById('nexus-payment-save').onclick = savePayment;

    const originalExtend = window.directExtend;
    if (typeof originalExtend === 'function' && !window.__nexusPaymentExtendWrapped) {
      window.__nexusOriginalDirectExtend = originalExtend;
      window.directExtend = function(phone, months) {
        const members = window.allMembers || [];
        const member = members.find(m => m.phone === phone);
        if (!member) return originalExtend(phone, months);
        const cfg = window.currentGymConfig || {};
        const suggested = months === 1 ? Number(cfg.plan_1m_price || 0) : months === 3 ? Number(cfg.plan_3m_price || 0) : months === 6 ? Number(cfg.plan_6m_price || 0) : Number(cfg.plan_12m_price || 0);
        openPayment(member, suggested, 'renewal');
      };
      window.__nexusPaymentExtendWrapped = true;
    }

    if (typeof window.openAthleteDossier === 'function' && !window.__nexusPaymentDossierWrapped) {
      const originalDossier = window.openAthleteDossier;
      window.openAthleteDossier = async function(phone, animate = true) {
        await originalDossier(phone, animate);
        const member = (window.allMembers || []).find(m => m.phone === phone);
        if (!member) return;
        const grid = document.querySelector('#athlete-dossier-modal .grid.grid-cols-2.sm\\:grid-cols-4.gap-2');
        if (!grid || document.getElementById('nexus-record-payment-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'nexus-record-payment-btn';
        btn.type = 'button';
        btn.className = 'py-2.5 rounded-2xl bg-emeraldCustom/20 hover:bg-emeraldCustom text-emeraldCustom hover:text-black border border-emeraldCustom/40 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer';
        btn.textContent = '💳 Payment';
        btn.onclick = () => openPayment(member, 0, 'payment');
        grid.appendChild(btn);
      };
      window.__nexusPaymentDossierWrapped = true;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
