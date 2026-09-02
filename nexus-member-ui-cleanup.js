/* NEXUS Member UI cleanup — single presentation shell only. */
(()=>{
  'use strict';
  const OLD_SELECTORS = [
    'body > div:not(#nx5-app):not(#auth-modal):not(#drawer-backdrop):not(#side-drawer):not(#pwa-install-guide-modal):not(#qr-scanner-modal):not(#pass-renewal-modal):not(#toast-container):not(#gatekeeper-modal)',
    'main.tab-view',
    'nav.nx2-bottom',
    '.nx2-top',
    '.nx2-screen',
    '.nx3-bottom',
    '#nx3-bottom',
    '#nx3-screens',
    '#nx2-bottom',
    '#nx2-drawer',
    '.nx-legacy-nav',
    'body > header',
    'body > nav:not(.nx5-bottom)',
    '.scanlines-overlay',
    '.holo-foil-beam',
    '.laser-scan-beam',
    '#nexus-offline-banner',
    '.tab-view',
    '#tab-pass',
    '#tab-workouts',
    '#tab-nutrition',
    '#tab-activity',
    '#tab-rewards'
  ];

  let cleanupRunning = false;
  const hideOldPresentation = () => {
    if (cleanupRunning) return;
    cleanupRunning = true;
    try {
      OLD_SELECTORS.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (el.id === 'nx5-app' || el.closest('#nx5-app')) return;
          el.dataset.nx5LegacyHidden = '1';
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('height', '0', 'important');
          el.style.setProperty('min-height', '0', 'important');
          el.style.setProperty('max-height', '0', 'important');
          el.style.setProperty('margin', '0', 'important');
          el.style.setProperty('padding', '0', 'important');
          el.style.setProperty('overflow', 'hidden', 'important');
          el.style.setProperty('visibility', 'hidden', 'important');
          el.style.setProperty('position', 'absolute', 'important');
          el.style.setProperty('top', '-9999px', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
          el.setAttribute('aria-hidden', 'true');
        });
      });

      /* Keep side-drawer, auth-modal, and other interactive modals clean */
      document.querySelectorAll('#side-drawer,#drawer-backdrop,#auth-modal,#pwa-install-guide-modal,#qr-scanner-modal,#pass-renewal-modal,#toast-container').forEach(el => {
        if (!el.closest('#nx5-app')) {
          el.style.removeProperty('height');
          el.style.removeProperty('min-height');
          el.style.removeProperty('overflow');
        }
      });

      document.querySelectorAll('style[data-nx5-legacy]').forEach(el => el.remove());
    } finally {
      cleanupRunning = false;
    }
  };

  window.__nexusHideOldPresentation = hideOldPresentation;

  const run = () => {
    hideOldPresentation();
    requestAnimationFrame(hideOldPresentation);
    setTimeout(hideOldPresentation, 50);
    setTimeout(hideOldPresentation, 150);
    setTimeout(hideOldPresentation, 300);
    setTimeout(hideOldPresentation, 1000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }

  // Observe child additions AND attribute/class/style modifications on DOM
  const targetRoot = document.body || document.documentElement;
  if (targetRoot) {
    const obs = new MutationObserver(() => hideOldPresentation());
    obs.observe(targetRoot, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });
  }

  // Event hooks for login, logout, session refresh, visibility
  [
    'nexus:member-auth',
    'nexus:member-login',
    'nexus:member-logout',
    'nexus:member-live-update',
    'nexus:member-refresh',
    'storage',
    'pageshow',
    'focus'
  ].forEach(evt => window.addEventListener(evt, () => run()));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') run();
  });
})();

