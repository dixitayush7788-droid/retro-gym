(()=>{
'use strict';
const q=(s,r=document)=>r.querySelector(s);
const text=()=>String(q('#auth-gym-title')?.textContent||q('#header-gym-title')?.textContent||'RETRO GYM').replace(/ATHLETE CYBER HUD TERMINAL/ig,'').replace(/\s+/g,' ').trim()||'RETRO GYM';

const injectReadability=()=>{
 const id='nexus-athlete-mobile-readability-v1';
 if(q('#'+id)) return;
 const st=document.createElement('style');
 st.id=id;
 st.textContent=`
/* NEXUS ATHLETE MOBILE READABILITY / PWA OVERRIDE
   Scoped exclusively to the athlete/member experience. Owner/Admin UI is untouched. */
#nx5-app{
  font-size:15px!important;
  padding-top:0!important;
  margin-top:0!important;
  min-height:100dvh!important;
}
#nx5-app .nx5-wrap{
  padding-top:0!important;
  margin-top:0!important;
}
#nx5-app .nx5-top{
  height:58px!important;
  min-height:58px!important;
  background:linear-gradient(var(--bg) 72%,transparent)!important;
}
#nx5-app .nx5-brand small{font-size:9px!important;line-height:1.25!important;letter-spacing:.14em!important}
#nx5-app .nx5-brand b{font-size:19px!important;line-height:1.1!important}
#nx5-app .nx5-menu{width:44px!important;height:44px!important;font-size:20px!important}
#nx5-app .k{font-size:10px!important;line-height:1.35!important;letter-spacing:.16em!important}
#nx5-app .h1{font-size:clamp(46px,13vw,64px)!important;line-height:.94!important;margin:8px 0 10px!important}
#nx5-app .h2{font-size:34px!important;line-height:1!important}
#nx5-app .sub{font-size:14px!important;line-height:1.55!important}
#nx5-app .label{font-size:9px!important;line-height:1.35!important;letter-spacing:.13em!important}
#nx5-app .pass{padding:24px!important;border-radius:24px!important;margin-bottom:12px!important}
#nx5-app .name{font-size:clamp(40px,11vw,56px)!important;line-height:.95!important;margin:24px 0 7px!important}
#nx5-app .phone{font-size:12px!important}
#nx5-app .grid{gap:10px!important;margin-top:22px!important}
#nx5-app .metric{padding:16px!important;min-height:88px!important}
#nx5-app .metric strong{font-size:23px!important;margin-top:8px!important}
#nx5-app .metric.lime strong{font-size:34px!important}
#nx5-app .primary{padding:18px 19px!important;border-radius:18px!important;font-size:15px!important;min-height:62px!important}
#nx5-app .primary small{font-size:9px!important;margin-top:6px!important}
#nx5-app .actions{gap:9px!important;margin:10px 0 28px!important}
#nx5-app .action{min-height:88px!important;padding:14px!important;border-radius:18px!important}
#nx5-app .action b{font-size:13px!important;margin-top:12px!important}
#nx5-app .action small{font-size:9px!important;margin-top:5px!important}
#nx5-app .title{margin:18px 0 14px!important}
#nx5-app .live{font-size:9px!important}
#nx5-app .stats{gap:9px!important}
#nx5-app .stat{padding:18px 13px!important;min-height:88px!important}
#nx5-app .stat strong{font-size:28px!important}
#nx5-app .stat small{font-size:9px!important;margin-top:7px!important}
#nx5-app .row{padding:17px!important;gap:13px!important;margin-bottom:9px!important}
#nx5-app .row-icon{width:38px!important;height:38px!important;font-size:18px!important}
#nx5-app .row b{font-size:14px!important}
#nx5-app .row small{font-size:10px!important;margin-top:5px!important}
#nx5-app .arrow{font-size:24px!important}
#nx5-app .chip{font-size:10px!important;padding:10px 14px!important}
#nx5-app .ref{padding:22px!important}
#nx5-app .code{font-size:28px!important}
#nx5-app .copy{font-size:10px!important;padding:12px 14px!important}
#nx5-app .step{padding:16px!important;margin-bottom:9px!important}
#nx5-app .step b{font-size:13px!important}
#nx5-app .step small{font-size:10px!important;margin-top:6px!important}
#nx5-app .meal{padding:17px!important;margin-bottom:9px!important}
#nx5-app .meal .emoji{font-size:27px!important}
#nx5-app .meal b{font-size:14px!important}
#nx5-app .meal small{font-size:10px!important;margin-top:5px!important}
#nx5-app .water{padding:18px!important}
#nx5-app .water strong{font-size:26px!important}
#nx5-app .water button{font-size:11px!important;padding:10px 12px!important}
#nx5-app .empty{padding:32px 20px!important;font-size:13px!important}
#nx5-app .empty b{font-size:20px!important}
#nx5-app .bottom{
  height:calc(82px + var(--safe))!important;
  padding:8px 10px var(--safe)!important;
}
#nx5-app .bottom-in{height:74px!important;gap:5px!important}
#nx5-app .nx5-nav{font-size:10px!important;min-height:68px!important;border-radius:16px!important}
#nx5-app .nx5-nav .ico{font-size:22px!important;margin-bottom:6px!important}
#nx5-app .toast{font-size:11px!important;max-width:calc(100vw - 32px)!important;text-align:center!important}
/* iPhone / installed PWA: eliminate artificial top breathing room */
@media(max-width:759px){
  #nx5-app .nx5-wrap{width:calc(100vw - 24px)!important}
  #nx5-app .hero{padding:8px 0 18px!important}
}
@media(display-mode:standalone){
  #nx5-app{padding-top:0!important}
  #nx5-app .nx5-top{height:58px!important}
}
@supports(padding:max(0px)){
  #nx5-app{padding-bottom:calc(82px + max(var(--safe), env(safe-area-inset-bottom,0px)))!important}
}
`;
 document.head.appendChild(st);
};

const init=()=>{
 injectReadability();
 const tab=q('#tab-pass'); if(!tab||q('#nx2-topbar')) return;
 if(!q('#nx2-topbar-force-style')){const st=document.createElement('style');st.id='nx2-topbar-force-style';st.textContent='.nx2-top.nx2-force-show{display:flex!important}';document.head.appendChild(st)}
 const bar=document.createElement('div'); bar.id='nx2-topbar'; bar.className='nx2-top nx2-force-show';
 bar.innerHTML='<button type="button" class="nx2-menu" id="nx2-menu-button" aria-label="Open member menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><div class="nx2-brand"><div class="nx2-brand-sub" style="font-size:10px;letter-spacing:.28em">NEXUS MEMBER</div><div class="nx2-brand-name" style="font-size:16px;letter-spacing:.08em">PRIVATE FITNESS CLUB</div></div><div style="width:44px;height:44px"></div>';
 tab.prepend(bar);
 bar.querySelector('#nx2-menu-button').onclick=()=>{const d=document.getElementById('nx2-drawer');if(d)d.classList.add('open');else document.getElementById('nx3-menu-button')?.click()};
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
new MutationObserver(init).observe(document.body,{childList:true,subtree:true});
})();
