/* NEXUS Member UI cleanup — one canonical shell, deterministic and touch-safe. */
(()=>{
'use strict';
const OLD_SELECTORS=[
'body > div:not(#nx5-app):not(#auth-modal):not(#drawer-backdrop):not(#side-drawer):not(#pwa-install-guide-modal):not(#qr-scanner-modal):not(#pass-renewal-modal):not(#toast-container):not(#gatekeeper-modal)',
'main.tab-view','nav.nx2-bottom','.nx2-top','.nx2-screen','.nx3-bottom','#nx3-bottom','#nx3-screens','#nx2-bottom','#nx2-drawer','.nx-legacy-nav','.scanlines-overlay','.holo-foil-beam','.laser-scan-beam','#nexus-offline-banner','.tab-view','#tab-pass','#tab-workouts','#tab-nutrition','#tab-activity','#tab-rewards'
];
let scheduled=false;
function clean(){document.querySelectorAll(OLD_SELECTORS.join(',')).forEach(el=>{if(el.id==='nx5-app'||el.closest('#nx5-app'))return;if(el.dataset.nx5LegacyHidden==='1')return;el.dataset.nx5LegacyHidden='1';el.style.setProperty('display','none','important');el.style.setProperty('height','0','important');el.style.setProperty('min-height','0','important');el.style.setProperty('max-height','0','important');el.style.setProperty('margin','0','important');el.style.setProperty('padding','0','important');el.style.setProperty('overflow','hidden','important');el.style.setProperty('visibility','hidden','important');el.style.setProperty('position','absolute','important');el.style.setProperty('top','-9999px','important');el.style.setProperty('pointer-events','none','important');el.setAttribute('aria-hidden','true')})}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;clean()})}
window.__nexusHideOldPresentation=clean;
clean();
const root=document.body||document.documentElement;if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});
['nexus:member-auth','nexus:member-login','nexus:member-logout','nexus:member-refresh','pageshow','focus','online'].forEach(e=>addEventListener(e,()=>{clean();window.__nexusRefreshMemberUI?.()}));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){clean();window.__nexusRefreshMemberUI?.()}});
})();
