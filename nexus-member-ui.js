/* NEXUS Member UI — stable entry point. v4 is self-contained and only hides the legacy visual shell after it has rendered. */
(()=>{
  'use strict';
  const id='nexus-member-ui-v4';
  const load=()=>{
    if(document.getElementById(id)) return;
    const s=document.createElement('script');
    s.id=id;
    s.src='./nexus-member-ui-v4.js?v=20260901-stable';
    s.async=false;
    s.onerror=()=>console.error('[NEXUS] Member UI failed to load v4');
    document.head.appendChild(s);
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
