/* NEXUS MEMBER UI loader — reference-driven presentation layer. */
(()=>{
  const load=()=>{
    if(document.getElementById('nexus-member-ui-v3')) return;
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
      s.onload=()=>{
        const v3=document.createElement('script');
        v3.id='nexus-member-ui-v3';
        v3.src='./nexus-member-ui-v3.js';
        v3.defer=false;
        document.head.appendChild(v3);
        v3.onload=()=>{
          const css=document.createElement('link');
          css.rel='stylesheet';
          css.href='./nexus-world-ui.css?v=20260901-compact';
          document.head.appendChild(css);
          const ref=document.createElement('link');
          ref.id='nexus-member-reference-css';
          ref.rel='stylesheet';
          ref.href='./nexus-member-reference.css?v=20260901-compact';
          document.head.appendChild(ref);
          const world=document.createElement('script');
          world.id='nexus-world-ui';
          world.src='./nexus-world-ui.js';
          world.defer=false;
          document.head.appendChild(world);
        };
      };
    };
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
