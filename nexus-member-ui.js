/* NEXUS Member UI — one canonical presentation entry point. */
(()=>{
  'use strict';
  const load=(id,src)=>{
    if(document.getElementById(id))return;
    const s=document.createElement('script');s.id=id;s.src=src;s.async=false;s.onerror=()=>console.error('[NEXUS] failed to load',src);document.head.appendChild(s);
  };
  const start=()=>{
    load('nexus-member-ui-v7','./nexus-member-ui-v7.js?v=20260902-v7');
    load('nexus-member-ui-cleanup','./nexus-member-ui-cleanup.js?v=20260902-clean2');
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
