/* NEXUS WORLD UI bootstrap — presentation only. */
(()=>{
  'use strict';
  const init=()=>{
    const path=location.pathname.toLowerCase();
    const isAdmin=path.includes('admin-core')||path.includes('admin.html')||path.includes('admin-login');
    document.documentElement.classList.add('nexus-world-ui');
    document.body.classList.add('nexus-world-ui',isAdmin?'nexus-admin-page':'nexus-member-page');

    // Keep the existing functional layer intact. This script only marks the page
    // so the shared presentation system can restyle it without replacing hooks.
    document.documentElement.style.setProperty('color-scheme','dark');

    // Add a quiet live-status accent to the owner shell without touching data/state.
    if(isAdmin){
      const mark=document.createElement('div');
      mark.className='nw-live-mark';
      mark.setAttribute('aria-hidden','true');
      mark.innerHTML='<span></span>';
      document.body.appendChild(mark);
    }
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
