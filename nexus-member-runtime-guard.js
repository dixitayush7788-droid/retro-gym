/* NEXUS Member runtime guard — presentation/touch/attendance only. */
(()=>{
'use strict';
const qs=(s,r=document)=>r.querySelector(s);
const qsa=(s,r=document)=>[...r.querySelectorAll(s)];
const legacySelectors=[
 'main.tab-view','nav.nx2-bottom','.nx2-top','.nx2-screen','.nx3-bottom','#nx3-bottom','#nx3-screens','#nx2-bottom','#nx2-drawer','.nx-legacy-nav',
 'body > header','body > nav:not(.nx5-bottom)', '.scanlines-overlay','.holo-foil-beam','.laser-scan-beam','#nexus-offline-banner','.tab-view',
 '#tab-pass','#tab-workouts','#tab-nutrition','#tab-activity','#tab-rewards'
];
function hideLegacy(){
 qsa(legacySelectors.join(',')).forEach(el=>{
  if(el.closest('#nx5-app')) return;
  el.style.setProperty('display','none','important');
  el.style.setProperty('height','0','important');
  el.style.setProperty('min-height','0','important');
  el.style.setProperty('max-height','0','important');
  el.style.setProperty('margin','0','important');
  el.style.setProperty('padding','0','important');
  el.style.setProperty('overflow','hidden','important');
  el.style.setProperty('visibility','hidden','important');
  el.style.setProperty('position','absolute','important');
  el.style.setProperty('top','-9999px','important');
  el.style.setProperty('pointer-events','none','important');
 });
 const app=qs('#nx5-app');
 if(app){
  app.style.setProperty('position','fixed','important');
  app.style.setProperty('inset','0','important');
  app.style.setProperty('width','100%','important');
  app.style.setProperty('height','100dvh','important');
  app.style.setProperty('min-height','0','important');
  app.style.setProperty('max-height','100dvh','important');
  app.style.setProperty('margin','0','important');
  app.style.setProperty('transform','none','important');
  app.style.setProperty('pointer-events','auto','important');
  app.style.setProperty('z-index','1000','important');
 }
 ['#auth-modal','#drawer-backdrop','#qr-scanner-modal','#pass-renewal-modal','#pwa-install-guide-modal','#gatekeeper-modal'].forEach(sel=>{
  const el=qs(sel); if(!el) return;
  const hidden=el.classList.contains('hidden') || el.getAttribute('aria-hidden')==='true' || getComputedStyle(el).display==='none' || getComputedStyle(el).visibility==='hidden';
  if(hidden){el.style.setProperty('pointer-events','none','important'); el.style.setProperty('visibility','hidden','important');}
 });
}
function syncPunch(){
 const old=qs('#btn-punch-attendance');
 const btn=qs('#nx5-check');
 if(!btn) return;
 if(!old){btn.style.setProperty('pointer-events','auto','important');return;}
 const text=(old.innerText||old.textContent||'').replace(/\s+/g,' ').trim().toUpperCase();
 const verified=!!old.disabled || /ATTENDANCE VERIFIED|CHECK-IN.*VERIFIED|TODAY.*CHECK-IN/.test(text);
 if(verified){
   btn.disabled=true;
   btn.onclick=null;
   btn.innerHTML='<b>✓ &nbsp; ATTENDANCE VERIFIED TODAY <span class="bolt">✓</span></b><small>YOUR GYM CHECK-IN HAS BEEN RECORDED</small>';
   btn.style.setProperty('background','#b8ff25','important');
   btn.style.setProperty('opacity','.72','important');
   btn.style.setProperty('cursor','default','important');
   btn.style.setProperty('pointer-events','none','important');
 } else {
   btn.disabled=false;
   btn.onclick=()=>window.openDeskQRScanner?.();
   btn.innerHTML='<b>▣ &nbsp; CHECK IN AT THE GYM <span class="bolt">ϟ</span></b><small>SCAN THE RECEPTION QR • UPDATE YOUR STREAK</small>';
   btn.style.removeProperty('opacity');
   btn.style.setProperty('pointer-events','auto','important');
   btn.style.setProperty('cursor','pointer','important');
 }
}
function boot(){
 hideLegacy();
 syncPunch();
 const old=qs('#btn-punch-attendance');
 if(old && !old.__nx5Mirror){
   old.__nx5Mirror=true;
   new MutationObserver(syncPunch).observe(old,{attributes:true,childList:true,subtree:true,characterData:true});
 }
 if(!window.__nx5GuardObserver){
  window.__nx5GuardObserver=true;
  new MutationObserver(()=>{hideLegacy();syncPunch()}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden','disabled']});
 }
}
const run=()=>{boot();setTimeout(boot,50);setTimeout(boot,250);setTimeout(boot,1000)};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
['nexus:member-auth','nexus:member-login','nexus:member-logout','nexus:member-live-update','nexus:member-refresh','pageshow','focus','online'].forEach(e=>window.addEventListener(e,run));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')run()});
})();
