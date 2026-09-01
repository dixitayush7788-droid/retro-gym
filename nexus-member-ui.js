/* NEXUS Member UI — single presentation entry point. */
(()=>{
  'use strict';
  const loadScript=(id,src)=>{
    if(document.getElementById(id)) return;
    const s=document.createElement('script');
    s.id=id;
    s.src=src;
    s.async=false;
    s.onerror=()=>console.error('[NEXUS] failed to load',src);
    document.head.appendChild(s);
  };
  const start=()=>{
    loadScript('nexus-member-ui-v5','./nexus-member-ui-v5.js?v=20260901-single-shell3');
    loadScript('nexus-member-ui-cleanup','./nexus-member-ui-cleanup.js?v=20260901-single-shell3');
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
