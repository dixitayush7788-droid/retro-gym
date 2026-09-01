/* NEXUS Member UI cleanup — one presentation shell only. */
(()=>{
  'use strict';
  const OLD_SELECTORS = [
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
    '.scanlines-overlay',
    '.holo-foil-beam',
    '.laser-scan-beam',
    '#nexus-offline-banner'
  ];

  const hideOldPresentation = () => {
    OLD_SELECTORS.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        if (el.id === 'nx5-app' || el.closest('#nx5-app')) return;
        el.dataset.nx5LegacyHidden = '1';
        el.style.setProperty('display', 'none', 'important');
        el.setAttribute('aria-hidden', 'true');
      });
    });

    /* v5 needs the existing drawer as a functional interaction surface.
       Do not let the old-shell cleanup permanently kill it. */
    document.querySelectorAll('#side-drawer,#drawer-backdrop').forEach(el => {
      if (!el.closest('#nx5-app')) el.style.removeProperty('display');
    });

    document.querySelectorAll('style[data-nx5-legacy]').forEach(el => el.remove());
  };

  const run = () => {
    hideOldPresentation();
    requestAnimationFrame(hideOldPresentation);
    setTimeout(hideOldPresentation, 250);
    setTimeout(hideOldPresentation, 1000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, {once:true});
  } else {
    run();
  }

  new MutationObserver(() => hideOldPresentation()).observe(document.body, {
    childList: true,
    subtree: true
  });
})();
