/* NEXUS MEMBER PORTAL — PREMIUM VISUAL LAYER
   Presentation-only layer. Existing auth, Supabase, attendance, renewal,
   QR/punching and member data logic are intentionally untouched.
*/
(() => {
  'use strict';

  const css = String.raw`
:root{
  --nx-bg:#0b0b0b;
  --nx-bg2:#101010;
  --nx-panel:#121212;
  --nx-panel2:#171717;
  --nx-red:#8b0d1a;
  --nx-red2:#b41628;
  --nx-red-soft:rgba(139,13,26,.22);
  --nx-white:#f5f2ed;
  --nx-muted:#aaa49d;
  --nx-line:rgba(245,242,237,.12);
  --nx-line-strong:rgba(245,242,237,.2);
  --nx-gold:#d8b36a;
  --nx-green:#7fcf9a;
}

html.dark,body{
  background:
    radial-gradient(700px 360px at 88% -8%,rgba(139,13,26,.24),transparent 62%),
    radial-gradient(600px 360px at 8% 20%,rgba(139,13,26,.10),transparent 65%),
    var(--nx-bg)!important;
}
body{
  color:var(--nx-white)!important;
  font-family:'Plus Jakarta Sans',system-ui,sans-serif!important;
  min-height:100vh;
}
.scanlines-overlay{display:none!important}
#toast-container{z-index:10000!important}

/* Existing header: keep it functional, make it premium. */
body>header{
  position:sticky!important;top:0!important;z-index:90!important;
  margin:0!important;padding:13px 22px!important;
  background:rgba(11,11,11,.88)!important;
  border-bottom:1px solid var(--nx-line)!important;
  box-shadow:0 18px 55px rgba(0,0,0,.35)!important;
  backdrop-filter:blur(20px)!important;
  -webkit-backdrop-filter:blur(20px)!important;
}
#top-member-avatar{
  width:42px!important;height:42px!important;border-radius:50%!important;
  background:linear-gradient(145deg,var(--nx-red),#28050a)!important;
  border:1px solid rgba(245,242,237,.24)!important;
  box-shadow:0 0 28px rgba(139,13,26,.3)!important;
}

/* Content rail. */
main.tab-view{
  width:min(1160px,calc(100vw - 48px))!important;
  margin:0 auto 120px!important;
  padding:30px 0 36px!important;
}

/* =========================================================
   FOUR-ITEM BOTTOM NAV — Home / Progress / Nutrition / Referral
   ========================================================= */
nav.nexus-premium-nav{
  position:fixed!important;
  left:50%!important;bottom:14px!important;top:auto!important;
  transform:translateX(-50%)!important;
  width:min(560px,calc(100vw - 24px))!important;
  max-width:none!important;height:74px!important;
  padding:8px!important;
  display:flex!important;align-items:stretch!important;justify-content:space-between!important;
  gap:6px!important;
  border-radius:24px!important;
  background:rgba(17,17,17,.94)!important;
  border:1px solid rgba(245,242,237,.14)!important;
  box-shadow:0 22px 70px rgba(0,0,0,.72),0 0 0 1px rgba(139,13,26,.08)!important;
  backdrop-filter:blur(24px)!important;-webkit-backdrop-filter:blur(24px)!important;
  z-index:120!important;
}
.nexus-nav-brand{display:none!important}
nav.nexus-premium-nav .nav-tab-item{
  flex:1 1 0!important;width:auto!important;min-height:58px!important;
  padding:7px 6px!important;display:flex!important;flex-direction:column!important;
  align-items:center!important;justify-content:center!important;gap:4px!important;
  border-radius:17px!important;color:#8f8b86!important;background:transparent!important;
  text-align:center!important;font:700 9px/1 'Plus Jakarta Sans',sans-serif!important;
  letter-spacing:.02em!important;transition:all .2s ease!important;
}
nav.nexus-premium-nav .nav-tab-item:hover{color:var(--nx-white)!important;background:rgba(245,242,237,.045)!important}
nav.nexus-premium-nav .nav-tab-item.nexus-active{
  color:var(--nx-white)!important;
  background:linear-gradient(145deg,#8b0d1a,#5e0811)!important;
  box-shadow:0 10px 28px rgba(139,13,26,.32),inset 0 1px 0 rgba(245,242,237,.16)!important;
}
nav.nexus-premium-nav .nav-tab-item .active-indicator{display:none!important}
nav.nexus-premium-nav .nav-tab-item>span:first-child{
  width:29px;height:29px;display:grid;place-items:center;flex:0 0 29px;
  border-radius:10px;background:rgba(245,242,237,.055);font-size:15px!important;
}
nav.nexus-premium-nav .nav-tab-item.nexus-active>span:first-child{background:rgba(245,242,237,.1)}

/* =========================================================
   SIDE BAR / DRAWER
   ========================================================= */
#nexus-member-sidebar{
  position:fixed;left:18px;top:92px;bottom:104px;width:238px;z-index:100;
  padding:14px;border:1px solid var(--nx-line);border-radius:24px;
  background:rgba(15,15,15,.94);box-shadow:0 28px 80px rgba(0,0,0,.58);
  backdrop-filter:blur(24px);-webkit-backdrop-filter:blur(24px);
  display:flex;flex-direction:column;overflow:hidden;
}
#nexus-member-sidebar .nx-side-head{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:5px 5px 14px;border-bottom:1px solid var(--nx-line);margin-bottom:10px;
}
#nexus-member-sidebar .nx-side-brand{display:flex;align-items:center;gap:10px;min-width:0}
#nexus-member-sidebar .nx-side-mark{
  width:38px;height:38px;border-radius:12px;display:grid;place-items:center;
  background:linear-gradient(145deg,var(--nx-red),#30060b);border:1px solid rgba(245,242,237,.16);
  color:var(--nx-white);font:900 15px/1 'Plus Jakarta Sans',sans-serif;
  box-shadow:0 10px 26px rgba(139,13,26,.28);
}
#nexus-member-sidebar .nx-side-title{font:800 12px/1.1 'Plus Jakarta Sans',sans-serif;color:var(--nx-white)}
#nexus-member-sidebar .nx-side-sub{margin-top:3px;font:700 8px/1.3 'Space Mono',monospace;color:#77716b;letter-spacing:.12em;text-transform:uppercase}
#nexus-member-sidebar .nx-side-close{
  width:30px;height:30px;border:1px solid var(--nx-line);border-radius:10px;
  background:rgba(245,242,237,.04);color:#aaa49d;cursor:pointer;
}
#nexus-member-sidebar .nx-side-scroll{overflow:auto;min-height:0;padding-right:2px}
#nexus-member-sidebar .nx-side-label{
  margin:12px 7px 7px;color:#706a64;font:700 8px/1.2 'Space Mono',monospace;letter-spacing:.16em;text-transform:uppercase;
}
#nexus-member-sidebar .nx-side-btn{
  width:100%;display:flex;align-items:center;gap:11px;padding:10px 10px;margin:3px 0;
  border:1px solid transparent;border-radius:13px;background:transparent;color:#a6a19b;
  text-align:left;font:700 10px/1.2 'Plus Jakarta Sans',sans-serif;cursor:pointer;transition:.2s ease;
}
#nexus-member-sidebar .nx-side-btn:hover{background:rgba(245,242,237,.045);color:var(--nx-white);border-color:var(--nx-line)}
#nexus-member-sidebar .nx-side-btn .nx-ico{
  width:30px;height:30px;display:grid;place-items:center;flex:0 0 30px;border-radius:9px;
  background:#191919;border:1px solid var(--nx-line);font-size:14px;
}
#nexus-member-sidebar .nx-side-btn.nx-danger{color:#e5a3aa}
#nexus-member-sidebar .nx-side-btn.nx-danger .nx-ico{color:#f09aa3;background:rgba(139,13,26,.18);border-color:rgba(139,13,26,.42)}
#nexus-member-sidebar .nx-side-calendar{
  margin:7px 0 11px;padding:11px;border:1px solid var(--nx-line);border-radius:16px;background:#111;
}
#nexus-member-sidebar .nx-cal-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}
#nexus-member-sidebar .nx-cal-month{font:800 10px/1 'Plus Jakarta Sans',sans-serif;color:var(--nx-white)}
#nexus-member-sidebar .nx-cal-caption{font:700 7px/1 'Space Mono',monospace;color:#716b65;text-transform:uppercase;letter-spacing:.1em}
#nexus-member-sidebar .nx-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}
#nexus-member-sidebar .nx-cal-grid span{font:700 7px/22px 'Space Mono',monospace;color:#77716b;height:22px}
#nexus-member-sidebar .nx-cal-grid .nx-day{color:#a8a29b;background:#171717;border-radius:6px}
#nexus-member-sidebar .nx-cal-grid .nx-today{color:#fff;background:var(--nx-red);box-shadow:0 5px 14px rgba(139,13,26,.32)}
#nexus-member-sidebar .nx-side-foot{margin-top:auto;padding-top:10px;border-top:1px solid var(--nx-line)}

/* Main area leaves room for desktop sidebar. */
@media(min-width:1000px){
  main.tab-view{width:min(1060px,calc(100vw - 330px))!important;margin-left:286px!important;margin-right:28px!important}
}

/* =========================================================
   HOME HERO / 3D GYM BRANDING
   ========================================================= */
.nx-home-hero{
  position:relative;overflow:hidden;margin-bottom:20px;padding:30px 28px 28px;
  min-height:220px;border:1px solid rgba(245,242,237,.13);border-radius:30px;
  background:
    radial-gradient(500px 230px at 92% 5%,rgba(139,13,26,.32),transparent 65%),
    linear-gradient(145deg,#151515,#0b0b0b 70%);
  box-shadow:0 28px 80px rgba(0,0,0,.38),inset 0 1px 0 rgba(245,242,237,.06);
}
.nx-home-hero:before{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 0 52%,rgba(139,13,26,.08) 65%,transparent 80%);pointer-events:none}
.nx-home-kicker{position:relative;z-index:2;color:#b9b3ad;font:700 9px/1.2 'Space Mono',monospace;letter-spacing:.25em;text-transform:uppercase}
.nx-3d-gym{
  position:relative;z-index:2;margin:10px 0 4px;
  color:var(--nx-white);font-family:Georgia,'Times New Roman',serif;font-weight:900;
  font-size:clamp(42px,8vw,88px);line-height:.86;letter-spacing:-.055em;
  text-transform:uppercase;text-shadow:
    1px 1px 0 #d7d0c8,2px 2px 0 #c4bcb4,3px 3px 0 #a9a19a,4px 4px 0 #8e8780,
    5px 5px 0 #6f6862,6px 7px 0 #4e4843,0 18px 35px rgba(0,0,0,.65);
}
.nx-3d-gym .nx-red-word{color:#a91021;text-shadow:
    1px 1px 0 #d75a66,2px 2px 0 #8b0d1a,3px 3px 0 #650812,4px 5px 0 #3e050a,0 16px 32px rgba(139,13,26,.32)}
.nx-home-meta{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:8px;margin-top:18px}
.nx-home-chip{padding:7px 10px;border:1px solid var(--nx-line);border-radius:999px;background:rgba(245,242,237,.035);color:#b8b1aa;font:700 8px/1 'Space Mono',monospace;letter-spacing:.08em;text-transform:uppercase}
.nx-home-chip.nx-live{border-color:rgba(127,207,154,.25);color:#9bd6ac;background:rgba(127,207,154,.06)}
.nx-home-watermark{position:absolute;right:-35px;bottom:-55px;font:900 190px/.7 Georgia,serif;color:rgba(139,13,26,.08);pointer-events:none;transform:rotate(-9deg)}

/* Section headings */
.nexus-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin:4px 0 18px}
.nexus-section-heading .nx-eyebrow{color:#b41628;font:800 9px/1.2 'Space Mono',monospace;letter-spacing:.2em;text-transform:uppercase;margin-bottom:8px}
.nexus-section-heading .nx-title{color:var(--nx-white);font:800 clamp(25px,4vw,40px)/1 'Plus Jakarta Sans',sans-serif;letter-spacing:-.045em}
.nexus-section-heading .nx-desc{color:var(--nx-muted);font:500 11px/1.5 'Plus Jakarta Sans',sans-serif;max-width:430px;text-align:right}

/* Premium membership card — credit-card visual language. */
.nexus-pass-card{border-radius:27px!important;padding:1px!important;background:linear-gradient(135deg,#f0ebe3 0%,#8b0d1a 38%,#3b080e 72%,#f5f2ed 100%)!important;box-shadow:0 30px 90px rgba(0,0,0,.48)!important}
.nexus-pass-card>div:not(.holo-foil-beam){
  position:relative;border-radius:26px!important;
  background:
    radial-gradient(430px 220px at 90% 0%,rgba(139,13,26,.38),transparent 65%),
    linear-gradient(145deg,#181818,#0c0c0c 72%)!important;
  padding:28px!important;
}
.nexus-pass-card .holo-foil-beam{opacity:.06!important;background:linear-gradient(115deg,transparent 35%,rgba(245,242,237,.2) 50%,transparent 65%)!important}
#pass-member-name{font-size:clamp(30px,5vw,52px)!important;letter-spacing:-.055em!important;line-height:.96!important;color:var(--nx-white)!important}
#pass-member-phone{color:#c98b93!important}
#pass-valid-until,#pass-days-left,#pass-streak-number,#pass-id-capsule{font-size:14px!important}
#pass-days-left{font-size:clamp(32px,5vw,54px)!important;letter-spacing:-.06em!important;line-height:1!important;color:var(--nx-white)!important}
#pass-progress-ring{filter:drop-shadow(0 0 9px rgba(139,13,26,.32))}
#tab-pass section,#tab-pass>div:not(.nexus-pass-card),#tab-workouts>*,#tab-nutrition>*,#tab-activity>*,#tab-rewards>*{border-radius:20px!important}
#tab-pass section,#tab-pass>div:not(.nexus-pass-card),#tab-workouts section,#tab-nutrition section,#tab-activity section,#tab-rewards section{
  background:rgba(18,18,18,.9)!important;border:1px solid var(--nx-line)!important;box-shadow:0 18px 55px rgba(0,0,0,.24)!important
}
#tab-pass button,#tab-workouts button,#tab-nutrition button,#tab-activity button,#tab-rewards button{border-radius:13px!important}
#btn-punch-attendance{min-height:64px!important;border-radius:15px!important;box-shadow:0 12px 34px rgba(139,13,26,.2)!important}
#attendance-live-badge{border-radius:999px!important;padding:7px 10px!important}

/* Kill the old neon palette only at the visual layer. */
[class*="cyberVolt"],[class*="cyanCyber"],[class*="matrixGreen"]{text-shadow:none}

/* Drawer toggle */
#nx-sidebar-toggle{
  position:fixed;left:16px;top:94px;z-index:110;width:42px;height:42px;border-radius:13px;
  border:1px solid var(--nx-line);background:#121212;color:var(--nx-white);display:grid;place-items:center;
  box-shadow:0 12px 35px rgba(0,0,0,.38);cursor:pointer;font-size:18px;
}

@media(max-width:999px){
  #nexus-member-sidebar{left:10px;top:84px;bottom:98px;width:270px;transform:translateX(-118%);transition:transform .25s ease;box-shadow:0 28px 90px rgba(0,0,0,.78)}
  #nexus-member-sidebar.nx-open{transform:translateX(0)}
  #nx-sidebar-toggle{left:12px;top:86px;width:40px;height:40px}
  main.tab-view{width:calc(100vw - 24px)!important;margin:0 12px 110px!important;padding-top:22px!important}
  .nx-home-hero{padding:25px 20px 23px;min-height:200px;border-radius:25px}
  .nx-3d-gym{font-size:clamp(40px,13vw,64px)}
  .nexus-section-heading{display:block;margin-bottom:14px}
  .nexus-section-heading .nx-title{font-size:26px}
  .nexus-section-heading .nx-desc{margin-top:7px;text-align:left}
  .nexus-pass-card>div:not(.holo-foil-beam){padding:20px!important}
}
@media(max-width:430px){
  nav.nexus-premium-nav{bottom:8px!important;width:calc(100vw - 16px)!important;height:70px!important;border-radius:21px!important}
  nav.nexus-premium-nav .nav-tab-item{min-height:54px!important}
  .nx-home-hero{padding:22px 17px 20px}
  .nx-3d-gym{font-size:40px}
}
`;

  const style = document.createElement('style');
  style.id = 'nexus-premium-member-ui';
  style.textContent = css;

  const sectionMeta = {
    pass: ['HOME', 'Your membership pass, access status and quick actions'],
    workouts: ['PROGRESS', 'Training split, exercise progress and performance'],
    nutrition: ['NUTRITION', 'Fuel, hydration and recovery guidance'],
    activity: ['ATTENDANCE', 'Complete attendance history and check-in record'],
    rewards: ['REFERRAL', 'Referral benefits, rewards and sharing']
  };

  const navLabels = {
    'nav-tab-pass': ['HOME','⌂'],
    'nav-tab-workouts': ['PROGRESS','↗'],
    'nav-tab-nutrition': ['NUTRITION','◒'],
    'nav-tab-rewards': ['REFERRAL','↗']
  };

  function cleanText(value, fallback='') {
    return String(value || fallback).replace(/\s+/g,' ').trim();
  }

  function clickExisting(id) {
    const el = document.getElementById(id);
    if (el) { el.click(); return true; }
    return false;
  }

  function showToast(message) {
    const host = document.getElementById('toast-container');
    if (!host) return;
    const node = document.createElement('div');
    node.style.cssText='pointer-events:auto;background:#151515;color:#f5f2ed;border:1px solid rgba(245,242,237,.14);border-left:3px solid #8b0d1a;border-radius:12px;padding:11px 13px;font:700 10px/1.35 "Plus Jakarta Sans",sans-serif;box-shadow:0 18px 45px rgba(0,0,0,.5);';
    node.textContent=message;
    host.appendChild(node);
    setTimeout(()=>node.remove(),3200);
  }

  function findGymName() {
    const direct = cleanText(document.getElementById('auth-gym-title')?.textContent);
    if (direct && direct !== 'RETRO GYM') return direct;
    const title = cleanText(document.title).split('—')[0];
    if (title && !/nexus|member|cyber/i.test(title)) return title;
    const h = Array.from(document.querySelectorAll('h1,h2,h3')).map(x=>cleanText(x.textContent)).find(x=>/fitness|gym|club|studio/i.test(x));
    return h || 'YOUR GYM';
  }

  function buildHomeHero() {
    const tab = document.getElementById('tab-pass');
    if (!tab || tab.querySelector('.nx-home-hero')) return;
    const gym = findGymName();
    const passName = cleanText(document.getElementById('pass-member-name')?.textContent,'MEMBER');
    const hero = document.createElement('section');
    hero.className='nx-home-hero';
    hero.innerHTML=`
      <div class="nx-home-kicker">NEXUS MEMBER • PRIVATE FITNESS CLUB</div>
      <div class="nx-3d-gym"><span>${gym.replace(/\s+(FITNESS|GYM|CLUB)$/i,'')}</span><br><span class="nx-red-word">${/fitness/i.test(gym)?'FITNESS':'FITNESS'}</span></div>
      <div class="nx-home-meta">
        <span class="nx-home-chip">ELITE MEMBER</span>
        <span class="nx-home-chip">${passName}</span>
        <span class="nx-home-chip nx-live">● MEMBERSHIP ACTIVE</span>
      </div>
      <div class="nx-home-watermark">NX</div>`;
    tab.prepend(hero);
  }

  function addSectionHeading(id) {
    const main = document.getElementById(`tab-${id}`);
    if (!main || main.querySelector('.nexus-section-heading')) return;
    const meta = sectionMeta[id];
    if (!meta) return;
    const el = document.createElement('div');
    el.className='nexus-section-heading';
    el.innerHTML=`<div><div class="nx-eyebrow">NEXUS MEMBER</div><div class="nx-title">${meta[0]}</div></div><div class="nx-desc">${meta[1]}</div>`;
    main.prepend(el);
  }

  function setupBottomNav() {
    const nav = document.querySelector('nav.fixed.bottom-3, nav.fixed.bottom-4, nav.fixed');
    if (!nav || nav.dataset.nexusUiReady) return;
    const buttons = Array.from(nav.querySelectorAll('.nav-tab-item'));
    if (!buttons.length) return;
    nav.dataset.nexusUiReady='1';
    nav.classList.add('nexus-premium-nav');

    buttons.forEach(btn=>{
      const id=btn.id;
      if (id==='nav-tab-activity') btn.style.display='none';
      const meta=navLabels[id];
      if (!meta) return;
      const spans=btn.querySelectorAll('span');
      if (spans[0]) spans[0].textContent=meta[1];
      if (spans[1]) spans[1].textContent=meta[0];
      btn.setAttribute('aria-label',meta[0]);
    });

    const sync=()=>Object.keys(navLabels).forEach(id=>{
      const btn=document.getElementById(id);
      const tab=document.getElementById(id.replace('nav-tab-','tab-'));
      if(btn) btn.classList.toggle('nexus-active',!!tab&&!tab.classList.contains('hidden'));
    });
    setTimeout(sync,120);
    ['tab-pass','tab-workouts','tab-nutrition','tab-rewards'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['class']});
    });
  }

  function findWhatsAppTarget() {
    const anchors=Array.from(document.querySelectorAll('a[href]'));
    const wa=anchors.find(a=>/wa\.me|whatsapp\.com/i.test(a.href));
    if(wa) return wa.href;
    const cfg=window.NEXUS_CONFIG||{};
    const candidates=[cfg.ADMIN_WHATSAPP,cfg.ADMIN_PHONE,cfg.WHATSAPP_NUMBER,cfg.GYM_ADMIN_PHONE];
    const raw=candidates.find(Boolean);
    if(raw){const digits=String(raw).replace(/\D/g,'');if(digits.length>=10)return `https://wa.me/${digits}`;}
    return '';
  }

  function whatsappInquiry() {
    const target=findWhatsAppTarget();
    if(target){window.open(target,'_blank','noopener,noreferrer');return;}
    showToast('Admin WhatsApp is not configured in this gym profile yet.');
  }

  function whatsappReferral() {
    const gym=findGymName();
    const text=`Join me at ${gym}. Check out the gym member portal: ${location.href}`;
    const url=`https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url,'_blank','noopener,noreferrer');
  }

  function doLogout() {
    const candidates=Array.from(document.querySelectorAll('button,a,[role="button"]'));
    const target=candidates.find(el=>/\b(logout|sign out|sign-out)\b/i.test(cleanText(el.textContent)));
    if(target){target.click();return;}
    showToast('Use the existing account menu to sign out.');
  }

  function buildCalendar() {
    const d=new Date();
    const year=d.getFullYear(), month=d.getMonth(), today=d.getDate();
    const first=new Date(year,month,1).getDay();
    const days=new Date(year,month+1,0).getDate();
    const names=['S','M','T','W','T','F','S'];
    const cells=names.map(n=>`<span>${n}</span>`);
    for(let i=0;i<first;i++) cells.push('<span></span>');
    for(let n=1;n<=days;n++) cells.push(`<span class="nx-day ${n===today?'nx-today':''}">${n}</span>`);
    return `<div class="nx-side-calendar"><div class="nx-cal-top"><span class="nx-cal-month">${d.toLocaleString('en-IN',{month:'long',year:'numeric'})}</span><span class="nx-cal-caption">ATTENDANCE</span></div><div class="nx-cal-grid">${cells.join('')}</div></div>`;
  }

  function buildSidebar() {
    if(document.getElementById('nexus-member-sidebar')) return;
    const aside=document.createElement('aside');
    aside.id='nexus-member-sidebar';
    aside.innerHTML=`
      <div class="nx-side-head">
        <div class="nx-side-brand"><div class="nx-side-mark">N</div><div><div class="nx-side-title">MEMBER OS</div><div class="nx-side-sub">PRIVATE CLUB ACCESS</div></div></div>
        <button class="nx-side-close" type="button" aria-label="Close menu">×</button>
      </div>
      <div class="nx-side-scroll">
        <div class="nx-side-label">Your account</div>
        <button class="nx-side-btn" data-action="home"><span class="nx-ico">⌂</span><span>Home</span></button>
        <button class="nx-side-btn" data-action="attendance"><span class="nx-ico">▦</span><span>Attendance Calendar</span></button>
        <button class="nx-side-btn" data-action="progress"><span class="nx-ico">↗</span><span>Training Progress</span></button>
        <button class="nx-side-btn" data-action="nutrition"><span class="nx-ico">◒</span><span>Nutrition & Recovery</span></button>
        ${buildCalendar()}
        <div class="nx-side-label">Connect</div>
        <button class="nx-side-btn" data-action="inquiry"><span class="nx-ico">⌁</span><span>WhatsApp • Ask Admin</span></button>
        <button class="nx-side-btn" data-action="referral"><span class="nx-ico">↗</span><span>WhatsApp Referral</span></button>
        <button class="nx-side-btn" data-action="rewards"><span class="nx-ico">✦</span><span>Rewards</span></button>
      </div>
      <div class="nx-side-foot"><button class="nx-side-btn nx-danger" data-action="logout"><span class="nx-ico">↪</span><span>Log out</span></button></div>`;
    document.body.appendChild(aside);

    const toggle=document.createElement('button');
    toggle.id='nx-sidebar-toggle';
    toggle.type='button';toggle.setAttribute('aria-label','Open member sidebar');toggle.textContent='☰';
    document.body.appendChild(toggle);

    const close=()=>aside.classList.remove('nx-open');
    toggle.addEventListener('click',()=>aside.classList.toggle('nx-open'));
    aside.querySelector('.nx-side-close').addEventListener('click',close);
    aside.querySelectorAll('[data-action]').forEach(btn=>btn.addEventListener('click',()=>{
      const action=btn.dataset.action;
      if(action==='home') clickExisting('nav-tab-pass');
      if(action==='attendance') clickExisting('nav-tab-activity');
      if(action==='progress') clickExisting('nav-tab-workouts');
      if(action==='nutrition') clickExisting('nav-tab-nutrition');
      if(action==='rewards'||action==='referral') clickExisting('nav-tab-rewards');
      if(action==='inquiry') whatsappInquiry();
      if(action==='referral') whatsappReferral();
      if(action==='logout') doLogout();
      if(action!=='inquiry'&&action!=='referral'&&action!=='logout') close();
    }));
  }

  function markPassCard(){
    const passName=document.getElementById('pass-member-name');
    if(!passName) return;
    const card=Array.from(document.querySelectorAll('#tab-pass>div')).find(el=>el.contains(passName));
    if(card) card.classList.add('nexus-pass-card');
  }

  function init(){
    if(!document.getElementById('nexus-premium-member-ui')) document.head.appendChild(style);
    ['pass','workouts','nutrition','activity','rewards'].forEach(addSectionHeading);
    setupBottomNav();
    buildHomeHero();
    markPassCard();
    buildSidebar();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
