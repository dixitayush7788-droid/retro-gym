/* NEXUS premium member portal UI layer — presentation only. No Supabase/API/data logic is changed. */
(() => {
  const css = String.raw`
:root{--nx-bg:#07090d;--nx-surface:#0e1218;--nx-line:rgba(255,255,255,.09);--nx-muted:#8b95a5;--nx-text:#f5f7fa;--nx-accent:#c8ff16;--nx-cyan:#42d8ff;--nx-green:#20e58a}
html.dark,body{background:radial-gradient(900px 500px at 75% -5%,rgba(66,216,255,.08),transparent 55%),radial-gradient(700px 450px at 20% 0%,rgba(200,255,22,.06),transparent 55%),var(--nx-bg)!important}
body{color:var(--nx-text)!important;font-family:'Plus Jakarta Sans',system-ui,sans-serif!important}
.scanlines-overlay{opacity:0!important}#toast-container{z-index:10000!important}
body>header{position:sticky!important;top:0!important;z-index:40!important;margin:0!important;padding:14px 28px!important;background:rgba(7,9,13,.82)!important;border-bottom:1px solid var(--nx-line)!important;box-shadow:0 18px 45px rgba(0,0,0,.28)!important;backdrop-filter:blur(22px)!important;-webkit-backdrop-filter:blur(22px)!important}
#top-member-avatar{width:42px!important;height:42px!important;border-radius:14px!important;background:linear-gradient(145deg,rgba(200,255,22,.18),rgba(66,216,255,.1))!important;border:1px solid rgba(200,255,22,.38)!important;box-shadow:0 0 24px rgba(200,255,22,.12)!important}
main.tab-view{width:min(1180px,calc(100vw - 270px))!important;margin:0 28px 110px 242px!important;padding-top:28px!important;padding-bottom:30px!important}
main.tab-view>*{border-color:var(--nx-line)!important}
.nexus-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin:4px 0 18px}.nexus-section-heading .nx-eyebrow{color:var(--nx-accent);font:700 10px/1.2 'Space Mono',monospace;letter-spacing:.18em;text-transform:uppercase;margin-bottom:7px}.nexus-section-heading .nx-title{color:var(--nx-text);font:800 clamp(26px,4vw,42px)/1 'Plus Jakarta Sans',sans-serif;letter-spacing:-.045em}.nexus-section-heading .nx-desc{color:var(--nx-muted);font:500 12px/1.5 'Plus Jakarta Sans',sans-serif;max-width:420px;text-align:right}
nav.nexus-premium-nav{position:fixed!important;left:18px!important;top:96px!important;bottom:18px!important;transform:none!important;width:202px!important;max-width:202px!important;height:auto!important;padding:14px!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;gap:7px!important;border-radius:22px!important;background:rgba(12,16,22,.86)!important;border:1px solid rgba(255,255,255,.09)!important;box-shadow:0 25px 70px rgba(0,0,0,.45)!important;backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important}
.nexus-nav-brand{display:flex;align-items:center;gap:10px;padding:7px 8px 16px;margin-bottom:4px;border-bottom:1px solid var(--nx-line)}.nexus-nav-brand .nx-mark{width:36px;height:36px;display:grid;place-items:center;border-radius:12px;color:#050608;background:linear-gradient(135deg,var(--nx-accent),#eaff83);font:900 16px/1 'Plus Jakarta Sans',sans-serif;box-shadow:0 8px 22px rgba(200,255,22,.18)}.nexus-nav-brand .nx-brand-name{color:#fff;font:800 13px/1.1 'Plus Jakarta Sans',sans-serif;letter-spacing:-.02em}.nexus-nav-brand .nx-brand-sub{color:#6f7988;font:700 8px/1.4 'Space Mono',monospace;letter-spacing:.12em;text-transform:uppercase;margin-top:3px}
nav.nexus-premium-nav .nav-tab-item{flex:0 0 auto!important;width:100%!important;min-height:49px!important;padding:9px 11px!important;flex-direction:row!important;justify-content:flex-start!important;gap:11px!important;border-radius:14px!important;color:#8d97a5!important;background:transparent!important;text-align:left!important;font:700 10px/1 'Plus Jakarta Sans',sans-serif!important;letter-spacing:.01em!important}nav.nexus-premium-nav .nav-tab-item:hover{color:#fff!important;background:rgba(255,255,255,.045)!important}nav.nexus-premium-nav .nav-tab-item.nexus-active{color:#11150a!important;background:linear-gradient(135deg,#c8ff16,#e8ff82)!important;box-shadow:0 10px 28px rgba(200,255,22,.14)!important}nav.nexus-premium-nav .nav-tab-item .active-indicator{display:none!important}nav.nexus-premium-nav .nav-tab-item>span:first-child{width:30px;height:30px;display:grid;place-items:center;flex:0 0 30px;border-radius:10px;background:rgba(255,255,255,.05);font-size:15px!important}nav.nexus-premium-nav .nav-tab-item.nexus-active>span:first-child{background:rgba(0,0,0,.08)}
.nexus-pass-card{border-radius:28px!important;padding:1px!important;background:linear-gradient(125deg,rgba(200,255,22,.78),rgba(66,216,255,.35) 48%,rgba(255,255,255,.12))!important;box-shadow:0 30px 80px rgba(0,0,0,.38)!important}.nexus-pass-card>div:not(.holo-foil-beam){border-radius:27px!important;background:radial-gradient(500px 220px at 85% 0%,rgba(66,216,255,.1),transparent 60%),radial-gradient(420px 260px at 0% 100%,rgba(200,255,22,.08),transparent 65%),linear-gradient(145deg,#11161e,#090c11 72%)!important;padding:25px!important}.nexus-pass-card .holo-foil-beam{opacity:.14!important}
#pass-member-name{font-size:clamp(28px,4vw,44px)!important;letter-spacing:-.045em!important;line-height:.98!important}#pass-member-phone{color:#c8ff16!important}#pass-valid-until,#pass-days-left,#pass-streak-number,#pass-id-capsule{font-size:14px!important}#pass-days-left{font-size:clamp(30px,5vw,52px)!important;letter-spacing:-.06em!important;line-height:1!important}#pass-progress-ring{filter:drop-shadow(0 0 9px rgba(200,255,22,.3))}
#tab-pass section,#tab-pass>div:not(.nexus-pass-card),#tab-workouts>*,#tab-nutrition>*,#tab-activity>*,#tab-rewards>*{border-radius:22px!important}#tab-pass section,#tab-pass>div:not(.nexus-pass-card),#tab-workouts section,#tab-nutrition section,#tab-activity section,#tab-rewards section{background:rgba(14,18,24,.84)!important;border:1px solid var(--nx-line)!important;box-shadow:0 18px 50px rgba(0,0,0,.22)!important}
#tab-pass button,#tab-workouts button,#tab-nutrition button,#tab-activity button,#tab-rewards button{border-radius:14px!important}#btn-punch-attendance{min-height:66px!important;border-radius:16px!important;box-shadow:0 12px 34px rgba(32,229,138,.13)!important}#attendance-live-badge{border-radius:999px!important;padding:7px 10px!important}.font-mono{letter-spacing:.01em}.shadow-glass-card{box-shadow:0 20px 60px rgba(0,0,0,.24)!important}
@media(max-width:767px){body>header{padding:11px 14px!important}main.tab-view{width:calc(100vw - 92px)!important;margin:0 14px 30px 78px!important;padding-top:18px!important}nav.nexus-premium-nav{left:10px!important;top:88px!important;bottom:12px!important;width:58px!important;max-width:58px!important;padding:8px!important;border-radius:18px!important}.nexus-nav-brand{justify-content:center;padding:4px 2px 11px}.nexus-nav-brand .nx-mark{width:38px;height:38px}.nexus-nav-brand .nx-copy{display:none}nav.nexus-premium-nav .nav-tab-item{min-height:46px!important;padding:7px!important;justify-content:center!important}nav.nexus-premium-nav .nav-tab-item>span:first-child{margin:0!important}nav.nexus-premium-nav .nav-tab-item>span:nth-child(2){display:none!important}.nexus-section-heading{display:block;margin-bottom:14px}.nexus-section-heading .nx-title{font-size:25px}.nexus-section-heading .nx-desc{margin-top:7px;text-align:left}.nexus-pass-card>div:not(.holo-foil-beam){padding:19px!important}#pass-member-name{font-size:29px!important}}
`;
  const style = document.createElement('style');
  style.id = 'nexus-premium-member-ui';
  style.textContent = css;

  const sectionMeta = {
    pass: ['MEMBER PASS', 'Your membership credential, validity and quick access'],
    workouts: ['TRAINING', 'Your training split, exercises and progressive overload plan'],
    nutrition: ['NUTRITION', 'Daily fuel, hydration and recovery guidance'],
    activity: ['ATTENDANCE', 'Your check-in history and live attendance record'],
    rewards: ['REWARDS', 'Referral benefits and member rewards']
  };

  function addSectionHeading(id) {
    const main = document.getElementById(`tab-${id}`);
    if (!main || main.querySelector('.nexus-section-heading')) return;
    const meta = sectionMeta[id];
    if (!meta) return;
    const el = document.createElement('div');
    el.className = 'nexus-section-heading';
    el.innerHTML = `<div><div class="nx-eyebrow">NEXUS MEMBER</div><div class="nx-title">${meta[0]}</div></div><div class="nx-desc">${meta[1]}</div>`;
    main.prepend(el);
  }

  function setupNav() {
    const nav = document.querySelector('nav.fixed.bottom-3');
    if (!nav || nav.dataset.nexusUiReady) return;
    nav.dataset.nexusUiReady = '1';
    nav.classList.add('nexus-premium-nav');
    const brand = document.createElement('div');
    brand.className = 'nexus-nav-brand';
    brand.innerHTML = `<div class="nx-mark">N</div><div class="nx-copy"><div class="nx-brand-name">NEXUS MEMBER</div><div class="nx-brand-sub">Digital Fitness OS</div></div>`;
    nav.prepend(brand);
    const labels = {'nav-tab-pass':'MEMBER PASS','nav-tab-workouts':'TRAINING','nav-tab-nutrition':'NUTRITION','nav-tab-activity':'ATTENDANCE','nav-tab-rewards':'REWARDS'};
    Object.entries(labels).forEach(([id,label]) => { const btn=document.getElementById(id); if(!btn)return; const t=btn.querySelector('span:nth-child(2)'); if(t)t.textContent=label; });
    const syncActive=()=>document.querySelectorAll('nav.nexus-premium-nav .nav-tab-item').forEach(btn=>{const tab=document.getElementById(btn.id.replace('nav-tab-','tab-'));btn.classList.toggle('nexus-active',!!tab&&!tab.classList.contains('hidden'));});
    setTimeout(syncActive,150);
    const observer=new MutationObserver(syncActive);
    ['tab-pass','tab-workouts','tab-nutrition','tab-activity','tab-rewards'].forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['class']});});
    const passName=document.getElementById('pass-member-name');
    if(passName){const card=Array.from(document.querySelectorAll('#tab-pass>div')).find(el=>el.contains(passName));if(card)card.classList.add('nexus-pass-card');}
  }

  function init(){
    if(!document.getElementById('nexus-premium-member-ui')) document.head.appendChild(style);
    ['pass','workouts','nutrition','activity','rewards'].forEach(addSectionHeading);
    setupNav();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();
