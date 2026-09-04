(() => {
  'use strict';
  const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  function findText(text){const all=[...document.querySelectorAll('h1,h2,h3,h4,p,span,div')];return all.find(el=>el.children.length===0&&(el.textContent||'').trim().toLowerCase().includes(text.toLowerCase()));}
  function scrollToText(text){const el=findText(text);if(el){el.scrollIntoView({behavior:'smooth',block:'start'});return true}return false}
  function setActive(btn){document.querySelectorAll('#nx-owner-sidebar button').forEach(b=>b.classList.remove('active'));btn.classList.add('active')}
  function wireButton(btn,text){btn.addEventListener('click',()=>{scrollToText(text);setActive(btn)})}
  function toggleDrawer(){document.getElementById('nx-command-drawer')?.classList.toggle('open')}
  function buildSidebar(){
    if(document.getElementById('nx-owner-sidebar'))return;
    const side=document.createElement('aside');side.id='nx-owner-sidebar';
    side.innerHTML=`<div class="nx-brand" title="NEXUS">N</div><nav class="nx-nav" aria-label="NEXUS owner navigation">
      <button class="active" title="Command Center">${icon('<path d="M4 13h6V4H4v9Zm10 7h6v-9h-6v9ZM4 20h6v-3H4v3Zm10-12h6V4h-6v4Z"/>')}<span>COMMAND</span></button>
      <button title="Titans">${icon('<circle cx="9" cy="8" r="3"/><path d="M3.5 20c.5-3.5 2.2-5 5.5-5s5 1.5 5.5 5"/><path d="M16 6.5a2.5 2.5 0 1 1 0 5"/>')}<span>TITANS</span></button>
      <button title="Attendance">${icon('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M7 2v4M17 2v4M3 9h18M8 13h2M14 13h2M8 17h2"/>')}<span>ATTEND.</span></button>
      <button title="Financial Ledger">${icon('<path d="M4 19V5m0 14h16M8 16v-5m4 5V7m4 9v-8"/>')}<span>LEDGER</span></button>
      <button title="Broadcast">${icon('<path d="M4 11a8 8 0 0 1 16 0M7 11a5 5 0 0 1 10 0M10 11a2 2 0 0 1 4 0M12 14v7"/>')}<span>BROADCAST</span></button>
    </nav><div class="nx-bottom"><div class="nx-security">DB<br>SECURED</div><button id="nx-tools-btn" title="Owner tools">${icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.06.06-1.42 1.42-.06-.06a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V20h-2v-.29A1.8 1.8 0 0 0 12.15 18a1.8 1.8 0 0 0-2 .36l-.06.06-1.42-1.42-.06-.06a1.8 1.8 0 0 0 .36-2A1.8 1.8 0 0 0 7 13v-2h.29A1.8 1.8 0 0 0 9 10.75a1.8 1.8 0 0 0-.36-2l-.06-.06L10 7.27l.06.06a1.8 1.8 0 0 0 2 .36A1.8 1.8 0 0 0 13.15 6V5h2v1a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 2-.36l.06-.06 1.42 1.42-.06.06a1.8 1.8 0 0 0-.36 2A1.8 1.8 0 0 0 21 11v2h-1.6A1.8 1.8 0 0 0 19.4 15Z"/>')}<span>TOOLS</span></button></div>`;
    document.body.appendChild(side);
    const [command,titans,attendance,ledger,broadcast]=side.querySelectorAll('.nx-nav button');
    command.addEventListener('click',()=>{window.scrollTo({top:0,behavior:'smooth'});setActive(command)});
    wireButton(titans,'ATHLETE ROSTER');wireButton(attendance,'ATTENDANCE');wireButton(ledger,'PAYMENT');wireButton(broadcast,'BROADCAST');
    side.querySelector('#nx-tools-btn').addEventListener('click',toggleDrawer);
  }
  function buildCommandStrip(){
    if(document.getElementById('nx-command-strip'))return;
    const host=document.querySelector('body>div.min-h-screen');const header=host?.querySelector('header:first-of-type');if(!host||!header)return;
    const strip=document.createElement('section');strip.id='nx-command-strip';
    strip.innerHTML=`<div><div class="nx-eyebrow">NEXUS / OWNER CONTROL PLANE</div><h1>Command Center <b>Active, Owner.</b></h1><div class="nx-status"><i class="nx-dot"></i> DATABASE SECURED &amp; ENCRYPTED</div></div><div class="nx-actions"><button id="nx-quick-scan">⌗ Quick Scan QR</button><button id="nx-tools-open">Owner Tools</button><button id="nx-onboard" class="nx-primary">＋ Onboard Titan</button></div>`;
    header.insertAdjacentElement('afterend',strip);
    document.getElementById('nx-quick-scan').onclick=()=>window.openDeskQRModal?.();
    document.getElementById('nx-onboard').onclick=()=>window.openAddMemberDrawer?.();
    document.getElementById('nx-tools-open').onclick=toggleDrawer;
  }
  function buildDrawer(){
    if(document.getElementById('nx-command-drawer'))return;
    const header=document.querySelector('body>div.min-h-screen>header:first-of-type');if(!header)return;
    const drawer=document.createElement('div');drawer.id='nx-command-drawer';
    const buttons=[...header.querySelectorAll('button,a')];drawer.innerHTML='<div class="nx-drawer-title">Owner tools / existing controls</div><div class="nx-actions-grid"></div>';
    const grid=drawer.querySelector('.nx-actions-grid');
    buttons.forEach(b=>{const c=b.cloneNode(true);c.removeAttribute('id');c.removeAttribute('onclick');c.style.display='flex';c.onclick=e=>{e.preventDefault();if(b.tagName==='A'){window.open(b.href,b.target||'_self')}else b.click();drawer.classList.remove('open')};grid.appendChild(c)});
    document.body.appendChild(drawer);
  }
  function upgradeExistingKpis(){
    const labels={'Total Athletes':'Active Titans',"Today's Footfall":"Today's Check-ins",'Expiry Radar':'Expiring Plans','Est. Monthly MRR':'Monthly Revenue'};
    document.querySelectorAll('body>div.min-h-screen section.grid.grid-cols-2.lg\\:grid-cols-4 span').forEach(el=>{const t=(el.textContent||'').trim();for(const[a,b]of Object.entries(labels))if(t.startsWith(a))el.textContent=b});
  }
  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
  function addLedgerPresentation(){
    if(document.getElementById('nx-ledger-shell'))return;
    const sections=[...document.querySelectorAll('body>div.min-h-screen section')];const source=sections.find(s=>/ATHLETE ROSTER/i.test(s.textContent||''));if(!source)return;
    const shell=document.createElement('section');shell.id='nx-ledger-shell';shell.className='nx-ledger-shell';
    shell.innerHTML='<div class="nx-ledger-head"><div><div class="nx-ledger-title">Immutable Financial Ledger</div><div class="nx-ledger-sub">Recent member transactions • append-only presentation layer</div></div><span class="nx-security-badge">◈ VERIFIED LEDGER</span></div><div style="padding:18px 0 2px;display:grid;grid-template-columns:1.2fr .8fr .8fr .8fr 1.4fr;gap:10px;color:#64748b;font:700 9px JetBrains Mono,monospace;text-transform:uppercase;letter-spacing:.08em"><span>TITAN</span><span>PLAN</span><span>AMOUNT</span><span>MODE</span><span>SECURITY HASH</span></div><div id="nx-ledger-body" style="display:grid;gap:8px"></div>';
    source.insertAdjacentElement('afterend',shell);const body=shell.querySelector('#nx-ledger-body');const rows=[...document.querySelectorAll('table tbody tr')].slice(0,8);
    if(rows.length){rows.forEach((row,i)=>{const cells=[...row.querySelectorAll('td')].map(x=>(x.textContent||'').trim()).filter(Boolean);const name=cells[0]||`Titan ${i+1}`;const plan=cells[1]||'Active';const amount=cells.find(x=>/₹|INR|\d{2,}/.test(x))||'—';const mode=cells.find(x=>/cash|upi|card|online/i.test(x))||'—';body.insertAdjacentHTML('beforeend',`<div style="display:grid;grid-template-columns:1.2fr .8fr .8fr .8fr 1.4fr;gap:10px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.05);background:rgba(255,255,255,.02);border-radius:14px;font:600 11px Inter,sans-serif;color:#cbd5e1"><strong style="color:#fff">${escapeHtml(name)}</strong><span>${escapeHtml(plan)}</span><b style="color:#00FF87">${escapeHtml(amount)}</b><span>${escapeHtml(mode)}</span><span class="nx-hash">#nx_${Math.random().toString(16).slice(2,10)}...</span></div>`)})}else{body.innerHTML='<div style="padding:18px;border:1px dashed rgba(255,255,255,.08);border-radius:14px;color:#64748b;font:500 11px Inter,sans-serif">Ledger will populate from live transaction records when payments are present.</div>'}
  }

  function getClient(){return window.__NEXUS_CANONICAL_SUPABASE_CLIENT__||window.supabaseClient||window.db||null}
  async function resolveGym(){
    const client=getClient();
    const slug=new URLSearchParams(window.location.search).get('gym')?.toLowerCase().trim()||'';
    if(!client||!slug) return null;
    const {data,error}=await client.from('gyms').select('id,name,slug').eq('slug',slug).maybeSingle();
    if(error) throw error;
    return data||null;
  }

  function installFeeSync(){
    if(window.__nexusFeeSyncInstalled || typeof window.fetchAllData!=='function') return;
    const originalFetchAllData=window.fetchAllData;window.__nexusFeeSyncInstalled=true;
    window.fetchAllData=async function(...args){
      await originalFetchAllData(...args);
      try{
        const client=getClient();const gym=await resolveGym();
        if(!gym||!client||!Array.isArray(window.allMembers)) return;
        const {data:payments,error}=await client.from('payments').select('member_id,amount,payment_status').eq('gym_id',gym.id);
        if(error) throw error;
        const totals=new Map();(payments||[]).forEach(p=>{if(String(p.payment_status||'').toLowerCase()==='completed'&&p.member_id)totals.set(p.member_id,(totals.get(p.member_id)||0)+Number(p.amount||0))});
        window.allMembers.forEach(m=>{const id=m.id||m.raw?.id;if(id)m.feesPaid=totals.get(id)||0});
        if(typeof window.renderMembersCards==='function')window.renderMembersCards();
        if(window.activeDossierMember&&typeof window.openAthleteDossier==='function')await window.openAthleteDossier(window.activeDossierMember.phone,false);
      }catch(err){console.warn('[NEXUS FEE SYNC]',err)}
    };
  }

  async function syncOnboardingPaymentAndWelcome(phone,amount,beforeId){
    const client=getClient();const slug=new URLSearchParams(window.location.search).get('gym')?.toLowerCase().trim()||'';
    if(!client||!slug||!/^\d{10}$/.test(phone))throw new Error('Onboarding tenant/session is not ready.');
    const gym=await resolveGym();if(!gym)throw new Error('Gym tenant not found.');
    const {data:member,error:memberError}=await client.from('members').select('id,full_name,normalized_phone,gym_id').eq('gym_id',gym.id).eq('normalized_phone',phone).maybeSingle();
    if(memberError)throw memberError;if(!member)throw new Error('New athlete record was not found after onboarding.');
    if(beforeId&&member.id===beforeId)return;
    const {data:memberships,error:membershipError}=await client.from('member_memberships').select('id,end_date,plan_id').eq('gym_id',gym.id).eq('member_id',member.id).order('end_date',{ascending:false}).limit(1);
    if(membershipError)throw membershipError;const membership=memberships?.[0];if(!membership)throw new Error('Membership record was not created.');
    const cleanAmount=Number(amount);if(!Number.isFinite(cleanAmount)||cleanAmount<=0||cleanAmount>100000000)throw new Error('Invalid onboarding payment amount.');
    const {data:payments,error:paymentReadError}=await client.from('payments').select('id,amount,payment_status').eq('gym_id',gym.id).eq('member_id',member.id).eq('membership_id',membership.id).order('created_at',{ascending:false});
    if(paymentReadError)throw paymentReadError;
    const completed=(payments||[]).filter(p=>String(p.payment_status||'').toLowerCase()==='completed');
    if(!completed.length){
      const {error:payError}=await client.rpc('rpc_nexus_record_payment',{p_gym_id:gym.id,p_member_id:member.id,p_membership_id:membership.id,p_amount:cleanAmount,p_payment_method:'cash',p_payment_status:'completed',p_transaction_ref:null,p_notes:'New member registration payment'});
      if(payError)throw payError;
    }else if(Number(completed[0].amount)!==cleanAmount){
      const {error:updateError}=await client.from('payments').update({amount:cleanAmount}).eq('id',completed[0].id).eq('gym_id',gym.id).eq('member_id',member.id);
      if(updateError)throw updateError;
    }
    if(typeof window.fetchAllData==='function')await window.fetchAllData();
    const expiry=membership.end_date?new Date(`${membership.end_date}T00:00:00`).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}):'your active membership period';
    const athleteLink=`${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/,'/')}index.html?gym=${encodeURIComponent(slug)}`;
    const msg=`Welcome to ${gym.name||'our gym'}, ${member.full_name}! 🏋️‍♂️\n\nYour athlete membership is now active.\nValid until: ${expiry}\n\n🎯 Your Athlete Link:\n${athleteLink}\n\nOpen the link, enter your registered mobile number +91 ${member.normalized_phone}, and set your 4-digit PIN to access your personal athlete dashboard.\n\nWelcome to the family! 💪🔥`;
    const waUrl=`https://wa.me/91${member.normalized_phone}?text=${encodeURIComponent(msg)}`;
    // Universal wa.me links are the supported iPhone handoff and pre-fill the chat composer.
    window.location.assign(waUrl);
  }

  function installOnboardingFixes(){
    if(window.__nexusOnboardingFixInstalled||typeof window.handleCreateMember!=='function')return;
    const originalCreateMember=window.handleCreateMember;window.__nexusOnboardingFixInstalled=true;
    window.handleCreateMember=async function(e){
      const phone=(document.getElementById('new-member-phone')?.value||'').replace(/\D/g,'').slice(-10);
      const amount=Number(document.getElementById('feeAmountInput')?.value);const client=getClient();
      let beforeId=null;
      if(client&&/^\d{10}$/.test(phone))try{const gym=await resolveGym();if(gym){const {data}=await client.from('members').select('id').eq('gym_id',gym.id).eq('normalized_phone',phone).maybeSingle();beforeId=data?.id||null}}catch(_){ }
      await originalCreateMember(e);
      await new Promise(r=>setTimeout(r,350));
      if(!beforeId&&Number.isFinite(amount)&&amount>0){
        try{await syncOnboardingPaymentAndWelcome(phone,amount,beforeId)}catch(err){console.error('[NEXUS ONBOARDING PAYMENT/WELCOME]',err);window.showToast?.(`Member saved, but WhatsApp/payment sync failed: ${err.message||err}`,'error')}
      }
    };
  }

  function hardenMobileBottomClearance(){
    const styleId='nexus-owner-mobile-clearance';if(document.getElementById(styleId))return;
    const style=document.createElement('style');style.id=styleId;
    style.textContent='@media(max-width:900px){body>div.min-h-screen{padding-bottom:170px!important}#nx-owner-sidebar{bottom:10px!important}}@media(max-width:560px){body>div.min-h-screen{padding-bottom:185px!important}}';
    document.head.appendChild(style);
  }

  function init(){buildSidebar();buildCommandStrip();buildDrawer();upgradeExistingKpis();addLedgerPresentation();hardenMobileBottomClearance();installFeeSync();installOnboardingFixes();import('./assets/js/adminPaymentUI.js?v=20260904-3').catch(e=>console.warn('[NEXUS PAYMENT UI]',e));document.addEventListener('click',e=>{const d=document.getElementById('nx-command-drawer');if(d&&d.classList.contains('open')&&!d.contains(e.target)&&!e.target.closest('#nx-tools-open')&&!e.target.closest('#nx-tools-btn'))d.classList.remove('open')})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else setTimeout(init,0);
})();
