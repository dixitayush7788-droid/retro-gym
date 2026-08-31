/* NEXUS WORLD UI bootstrap — presentation only. */
(()=>{
  'use strict';
  const loadSalesLayer=()=>{
    if(document.getElementById('nexus-sales-ui-css')) return;
    const css=document.createElement('link');
    css.id='nexus-sales-ui-css';
    css.rel='stylesheet';
    css.href='./nexus-sales-ui.css';
    document.head.appendChild(css);
    const js=document.createElement('script');
    js.id='nexus-sales-ui-js';
    js.src='./nexus-sales-ui.js';
    js.defer=false;
    document.head.appendChild(js);
  };
  const init=()=>{
    const path=location.pathname.toLowerCase();
    const isAdmin=path.includes('admin-core')||path.includes('admin.html')||path.includes('admin-login');
    document.documentElement.classList.add('nexus-world-ui');
    document.body.classList.add('nexus-world-ui',isAdmin?'nexus-admin-page':'nexus-member-page');
    document.documentElement.style.setProperty('color-scheme','dark');
    if(isAdmin){
      const mark=document.createElement('div');
      mark.className='nw-live-mark';
      mark.setAttribute('aria-hidden','true');
      mark.innerHTML='<span></span>';
      document.body.appendChild(mark);
    }
    loadSalesLayer();
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
