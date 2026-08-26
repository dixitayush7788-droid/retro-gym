/* NEXUS MEMBER UI loader — v2 premium black/silver presentation layer. */
(()=>{
  const load=()=>{
    if(document.getElementById('nexus-member-ui-v2')) return;
    const top=document.createElement('script');
    top.id='nexus-member-ui-v2-topbar';
    top.src='./nexus-member-ui-v2-topbar.js';
    top.defer=false;
    document.head.appendChild(top);
    top.onload=()=>{
      const s=document.createElement('script');
      s.id='nexus-member-ui-v2';
      s.src='./nexus-member-ui-v2.js';
      s.defer=false;
      document.head.appendChild(s);
    };
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
