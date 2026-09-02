/* NEXUS Member UI cleanup — one presentation shell, no mutation loops. */
(()=>{
  'use strict';

  const OLD_SELECTORS = [
    'main.tab-view',
    'nav.nx2-bottom', '.nx2-top', '.nx2-screen',
    '.nx3-bottom', '#nx3-bottom', '#nx3-screens',
    '#nx2-bottom', '#nx2-drawer', '.nx-legacy-nav',
    '.scanlines-overlay', '.holo-foil-beam', '.laser-scan-beam',
    '#nexus-offline-banner', '.tab-view',
    '#tab-pass', '#tab-workouts', '#tab-nutrition', '#tab-activity', '#tab-rewards'
  ];

  let scheduled = false;

  function hideOldPresentation(){
    document.querySelectorAll(OLD_SELECTORS.join(',')).forEach(el=>{
      if (el.closest('#nx5-app')) return;
      if (el.dataset.nx5LegacyHidden === '1') return;
      el.dataset.nx5LegacyHidden = '1';
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
      el.setAttribute('aria-hidden','true');
    });

    if (typeof window.__nexusRefreshMemberUI === 'function') {
      // v5 owns its own full-screen shell; cleanup only removes legacy layout nodes.
    }
  }

  function schedule(){
    if(scheduled) return;
    scheduled = true;
    requestAnimationFrame(()=>{
      scheduled = false;
      hideOldPresentation();
    });
  }

  window.__nexusHideOldPresentation = hideOldPresentation;
  hideOldPresentation();

  // Observe only DOM additions/removals. Never observe style/class attributes here;
  // changing them would create a self-triggering MutationObserver loop.
  const root = document.body || document.documentElement;
  if(root){
    const observer = new MutationObserver(schedule);
    observer.observe(root,{childList:true,subtree:true});
  }

  ['nexus:member-auth','nexus:member-login','nexus:member-logout','nexus:member-refresh','pageshow','focus','online'].forEach(evt=>{
    window.addEventListener(evt,()=>{
      hideOldPresentation();
      window.__nexusRefreshMemberUI?.();
    });
  });

  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){
      hideOldPresentation();
      window.__nexusRefreshMemberUI?.();
    }
  });
})();
