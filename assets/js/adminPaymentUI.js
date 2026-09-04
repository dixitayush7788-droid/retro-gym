import { supabase } from './supabaseClient.js';

(() => {
  'use strict';
  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const getSlug = () => new URLSearchParams(window.location.search).get('gym')?.toLowerCase().trim() || '';

  function ensureModal() {
    if (document.getElementById('nexus-payment-modal')) return;
    const el = document.createElement('div');
    el.id = 'nexus-payment-modal';
    el.className = 'fixed inset-0 z-[100] hidden bg-black/85 backdrop-blur-md items-end sm:items-center justify-center p-0 sm:p-4';
    el.innerHTML = `
      <div class="w-full max-w-md bg-[#0d0d12] border border-emerald-400/40 rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-white/10 pb-3"><div><h3 id="nexus-payment-title" class="font-bold text-white text-lg">RECORD MEMBER PAYMENT</h3><p id="nexus-payment-member" class="text-[11px] font-mono text-zinc-400 mt-1">Member</p></div><button id="nexus-payment-close" type="button" class="w-8 h-8 rounded-xl bg-white/5 text-zinc-300">✕</button></div>
        <div class="grid grid-cols-2 gap-2"><div class="rounded-2xl bg-black/30 border border-white/10 p-3"><div class="text-[9px] font-mono text-zinc-500 uppercase">Membership</div><div id="nexus-payment-validity" class="text-sm font-bold text-goldLight mt-1">--</div></div><div class="rounded-2xl bg-black/30 border border-white/10 p-3"><div class="text-[9px] font-mono text-zinc-500 uppercase">Suggested</div><div id="nexus-payment-suggested" class="text-sm font-bold text-zinc-200 mt-1">Custom</div></div></div>
        <div><label class="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Actual Amount Collected (₹) *</label><input id="nexus-payment-amount" type="number" min="1" max="100000000" step="1" inputmode="decimal" class="w-full bg-black/40 border border-emerald-400/30 focus:border-emerald-400 rounded-2xl p-3.5 text-xl font-bold text-emerald-300 outline-none" placeholder="Enter actual amount" /><p class="text-[10px] text-zinc-500 mt-1">This amount is stored for this member's payment cycle. Plan price is only a suggestion.</p></div>
        <div class="grid grid-cols-2 gap-2"><div><label class="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Payment Method</label><select id="nexus-payment-method" class="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm text-white outline-none"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option><option value="other">Other</option></select></div><div><label class="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Transaction Ref</label><input id="nexus-payment-ref" type="text" maxlength="120" class="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm text-white outline-none" placeholder="Optional" /></div></div>
        <div><label class="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1">Notes</label><input id="nexus-payment-notes" type="text" maxlength="500" class="w-full bg-black/40 border border-white/10 rounded-2xl p-3 text-sm text-white outline-none" placeholder="Discount, partial payment, etc." /></div>
        <div class="flex gap-2 pt-1"><button id="nexus-payment-save" type="button" class="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-black font-bold">SAVE PAYMENT</button><button id="nexus-payment-cancel" type="button" class="px-5 py-3.5 rounded-2xl bg-white/5 border border-white/10 text-zinc-300">Cancel</button></div>
      </div>`;
    document.body.appendChild(el);
    const close = () => { el.classList.add('hidden'); el.classList.remove('flex'); };
    document.getElementById('nexus-payment-close').onclick = close;
    document.getElementById('nexus-payment-cancel').onclick = close;
    document.getElementById('nexus-payment-save').onclick = savePayment;
  }

  let state = null;

  async function resolveMember(phone) {
    const slug = getSlug();
    if (!slug) throw new Error('Gym tenant is missing from the URL.');
    const { data: gym, error: gymError } = await supabase.from('gyms').select('id,name,plan_1m_price,plan_3m_price,plan_6m_price,plan_12m_price').eq('slug', slug).maybeSingle();
    if (gymError) throw gymError;
    if (!gym) throw new Error('Gym tenant not found.');
    const { data: member, error: memberError } = await supabase.from('members').select('id,full_name,phone,normalized_phone,gym_id').eq('gym_id', gym.id).eq('normalized_phone', phone).maybeSingle();
    if (memberError) throw memberError;
    if (!member) throw new Error('Athlete record not found.');
    const { data: memberships, error: membershipError } = await supabase.from('member_memberships').select('id,start_date,end_date,status,plan_id,plans(name,price,duration_days)').eq('gym_id', gym.id).eq('member_id', member.id).order('end_date', { ascending: false }).limit(1);
    if (membershipError) throw membershipError;
    if (!memberships?.[0]) throw new Error('No membership record found for this athlete.');
    return { gym, member, membership: memberships[0] };
  }

  async function savePayment() {
    if (!state) return;
    const amount = Number(document.getElementById('nexus-payment-amount').value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) { window.showToast?.('Enter a valid payment amount.', 'error'); return; }
    const btn = document.getElementById('nexus-payment-save'); btn.disabled = true; btn.textContent = 'SAVING…';
    try {
      const { gym, member, membership } = state;
      const { data, error } = await supabase.rpc('rpc_nexus_record_payment', { p_gym_id: gym.id, p_member_id: member.id, p_membership_id: membership.id, p_amount: amount, p_payment_method: document.getElementById('nexus-payment-method').value, p_payment_status: 'completed', p_transaction_ref: document.getElementById('nexus-payment-ref').value.trim() || null, p_notes: document.getElementById('nexus-payment-notes').value.trim() || null });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || 'Payment was rejected.');
      const modal = document.getElementById('nexus-payment-modal'); modal.classList.add('hidden'); modal.classList.remove('flex');
      window.showToast?.(`${money(amount)} payment saved for ${member.full_name}.`, 'success');
      if (typeof window.fetchAllData === 'function') await window.fetchAllData();
      if (typeof window.openAthleteDossier === 'function') await window.openAthleteDossier(member.normalized_phone || phone, false);
    } catch (err) { console.error('[NEXUS PAYMENT]', err); window.showToast?.(`Payment failed: ${err.message || err}`, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'SAVE PAYMENT'; }
  }

  async function openPayment(phone, suggested = 0, renewal = false) {
    ensureModal();
    try {
      const resolved = await resolveMember(phone); state = resolved;
      const { gym, member, membership } = resolved;
      const planSuggested = Number(suggested || membership.plans?.price || 0);
      document.getElementById('nexus-payment-title').textContent = renewal ? 'RECORD RENEWAL PAYMENT' : 'RECORD MEMBER PAYMENT';
      document.getElementById('nexus-payment-member').textContent = `${member.full_name} • +91 ${member.normalized_phone || phone}`;
      document.getElementById('nexus-payment-validity').textContent = membership.end_date ? new Date(`${membership.end_date}T00:00:00`).toLocaleDateString('en-GB') : '--';
      document.getElementById('nexus-payment-suggested').textContent = planSuggested ? money(planSuggested) : 'Custom';
      document.getElementById('nexus-payment-amount').value = planSuggested ? String(planSuggested) : '';
      document.getElementById('nexus-payment-ref').value = ''; document.getElementById('nexus-payment-notes').value = '';
      const modal = document.getElementById('nexus-payment-modal'); modal.classList.remove('hidden'); modal.classList.add('flex');
      setTimeout(() => document.getElementById('nexus-payment-amount')?.focus(), 40);
    } catch (err) { window.showToast?.(`Payment setup failed: ${err.message || err}`, 'error'); }
  }

  function install() {
    ensureModal();
    const modal = document.getElementById('athlete-dossier-modal');
    const quickGrid = modal?.querySelector('button[onclick="executeDossierQuickPunch()"]')?.parentElement;
    if (quickGrid && !document.getElementById('nexus-record-payment-btn')) {
      const btn = document.createElement('button'); btn.id = 'nexus-record-payment-btn'; btn.type = 'button';
      btn.className = 'py-2.5 rounded-2xl bg-emeraldCustom/20 hover:bg-emeraldCustom text-emeraldCustom hover:text-black border border-emeraldCustom/40 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer';
      btn.textContent = '💳 Payment';
      btn.onclick = async () => { const phone = document.getElementById('dossier-phone')?.textContent?.replace(/\D/g, '').slice(-10); if (phone) await openPayment(phone); };
      quickGrid.appendChild(btn);
    }
    const original = window.directExtend;
    if (typeof original === 'function' && !window.__nexusDirectExtendPaymentWrapped) {
      window.__nexusDirectExtendPaymentWrapped = true; window.__nexusOriginalDirectExtend = original;
      window.directExtend = async function(phone, months) {
        const resolved = await resolveMember(phone);
        const suggested = Number(resolved.membership.plans?.price || (months === 1 ? resolved.gym.plan_1m_price : months === 3 ? resolved.gym.plan_3m_price : months === 6 ? resolved.gym.plan_6m_price : resolved.gym.plan_12m_price) || 0);
        await openPayment(phone, suggested, true);
      };
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true }); else install();
})();
