/* NEXUS Member UI — stable entry point. v5 is the only presentation shell loaded. */
(()=>{
  'use strict';
  const id='nexus-member-ui-v5';
  const load=()=>{
    if(document.getElementById(id)) return;
    const s=document.createElement('script');
    s.id=id;
    s.src='./nexus-member-ui-v5.js?v=20260901-stable2';
    s.async=false;
    s.onerror=()=>console.error('[NEXUS] Member UI v5 failed to load');
    document.head.appendChild(s);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
