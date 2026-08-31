/* NEXUS SALES UI — non-destructive progressive enhancement. */
(()=>{
  'use strict';
  const boot=()=>{
    document.documentElement.classList.add('nexus-sales-ready');
    document.body.classList.add('nexus-sales-ready');
    // Presentation enhancement only: mark existing interactive controls for consistent UX.
    document.querySelectorAll('button,a,input,select,textarea').forEach(el=>{
      if(!el.dataset.salesEnhanced) el.dataset.salesEnhanced='1';
    });
    // Never remove disabled states, handlers, feature gates, or existing DOM IDs.
    // This layer intentionally has no Supabase calls and no data mutation logic.
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
