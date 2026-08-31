(()=>{
'use strict';
const q=(s,r=document)=>r.querySelector(s);
const gym=()=>String(q('#auth-gym-title')?.textContent||q('#header-gym-title')?.textContent||'RETRO GYM').replace(/ATHLETE CYBER HUD TERMINAL/ig,'').replace(/\s+/g,' ').trim()||'RETRO GYM';
function injectReferenceLayout(){
 const id='nexus-reference-layout-v1'; if(q('#'+id)) return;
 const st=document.createElement('style'); st.id=id;
 st.textContent=`
html,body{margin:0!important;padding:0!important;min-height:100%!important;background:#070809!important}
body.nexus-athlete-live{overflow-x:hidden!important}
body.nexus-athlete-live>header,body.nexus-athlete-live>.nx-legacy-nav,body.nexus-athlete-live>.scanlines-overlay,body.nexus-athlete-live>.holo-foil-beam,body.nexus-athlete-live>.laser-scan-beam,body.nexus-athlete-live>#nexus-offline-banner,body.nexus-athlete-live>#side-drawer,body.nexus-athlete-live>#drawer-backdrop,body.nexus-athlete-live>.tab-view,body.nexus-athlete-live>#nx2-bottom,body.nexus-athlete-live>#nx2-drawer,body.nexus-athlete-live>#nx3-bottom,body.nexus-athlete-live>#nx3-screens{display:none!important}
#nx5-app.live{display:block!important;position:relative!important;inset:auto!important;top:0!important;left:0!important;right:0!important;width:100%!important;min-height:100dvh!important;margin:0!important;padding-top:0!important;transform:none!important}
#nx5-app.live .nx5-wrap{width:min(620px,calc(100vw - 20px))!important;margin:0 auto!important;padding:0!important}
#nx5-app.live .nx5-top{height:62px!important;min-height:62px!important;margin:0!important;padding:0!important;position:relative!important;top:auto!important;background:linear-gradient(#070809 78%,transparent)!important}
#nx5-app.live .hero{padding:8px 0 18px!important;margin:0!important}
#nx5-app.live .h1{font-size:clamp(42px,12vw,60px)!important;line-height:.94!important;margin:9px 0 8px!important}
#nx5-app.live .h2{font-size:32px!important;line-height:1!important}
#nx5-app.live .sub{font-size:13px!important;line-height:1.45!important}
#nx5-app.live .k,#nx5-app.live .label{font-size:9px!important;line-height:1.35!important}
#nx5-app.live .pass{padding:22px!important;border-radius:22px!important;margin-bottom:10px!important}
#nx5-app.live .name{font-size:clamp(38px,10vw,52px)!important;line-height:.94!important;margin:23px 0 6px!important}
#nx5-app.live .phone{font-size:11px!important}
#nx5-app.live .metric{padding:15px!important;min-height:84px!important}
#nx5-app.live .metric strong{font-size:22px!important}
#nx5-app.live .metric.lime strong{font-size:32px!important}
#nx5-app.live .primary{min-height:60px!important;padding:16px 18px!important;font-size:14px!important}
#nx5-app.live .actions{gap:8px!important;margin:9px 0 24px!important}
#nx5-app.live .action{min-height:82px!important;padding:13px!important}
#nx5-app.live .action b{font-size:12px!important;margin-top:11px!important}
#nx5-app.live .action small{font-size:8px!important}
#nx5-app.live .title{margin:17px 0 11px!important}
#nx5-app.live .row{padding:15px!important;margin-bottom:8px!important}
#nx5-app.live .row b{font-size:13px!important}
#nx5-app.live .row small{font-size:10px!important}
#nx5-app.live .stats{gap:8px!important}
#nx5-app.live .stat{padding:16px 12px!important}
#nx5-app.live .stat strong{font-size:26px!important}
#nx5-app.live .stat small{font-size:8px!important}
#nx5-app.live .ref{padding:20px!important}
#nx5-app.live .code{font-size:27px!important}
#nx5-app.live .copy{font-size:9px!important}
#nx5-app.live .step{padding:15px!important}
#nx5-app.live .step b{font-size:12px!important}
#nx5-app.live .step small{font-size:9px!important}
#nx5-app.live .meal{padding:15px!important}
#nx5-app.live .meal b{font-size:13px!important}
#nx5-app.live .meal small{font-size:10px!important}
#nx5-app.live .water strong{font-size:25px!important}
#nx5-app.live .bottom{height:calc(80px + env(safe-area-inset-bottom,0px))!important;padding:7px 9px env(safe-area-inset-bottom,0px)!important}
#nx5-app.live .bottom-in{height:70px!important}
#nx5-app.live .nx5-nav{font-size:9px!important;min-height:65px!important}
#nx5-app.live .nx5-nav .ico{font-size:21px!important;margin-bottom:5px!important}
@media(display-mode:standalone){#nx5-app.live{padding-top:0!important;margin-top:0!important}#nx5-app.live .nx5-top{height:58px!important;min-height:58px!important}}
@media(max-width:430px){#nx5-app.live .nx5-wrap{width:calc(100vw - 20px)!important}#nx5-app.live .h1{font-size:clamp(40px,12vw,54px)!important}}
`;
 document.head.appendChild(st);
}
function markLive(){const app=q('#nx5-app');if(app?.classList.contains('live'))document.body.classList.add('nexus-athlete-live');else document.body.classList.remove('nexus-athlete-live');}
function init(){
 injectReferenceLayout();markLive();
 const app=q('#nx5-app');if(app&&!app.__nx5Observer){app.__nx5Observer=new MutationObserver(markLive);app.__nx5Observer.observe(app,{attributes:true,attributeFilter:['class']})}
 const tab=q('#tab-pass');if(!tab||q('#nx2-topbar'))return;
 if(!q('#nx2-topbar-force-style')){const s=document.createElement('style');s.id='nx2-topbar-force-style';s.textContent='.nx2-top.nx2-force-show{display:flex!important}';document.head.appendChild(s)}
 const bar=document.createElement('div');bar.id='nx2-topbar';bar.className='nx2-top nx2-force-show';
 bar.innerHTML='<button type="button" class="nx2-menu" id="nx2-menu-button" aria-label="Open member menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><div class="nx2-brand"><div class="nx2-brand-sub">NEXUS MEMBER</div><div class="nx2-brand-name">'+gym()+'</div></div><div style="width:44px;height:44px"></div>';
 tab.prepend(bar);bar.querySelector('#nx2-menu-button').onclick=()=>{const d=q('#nx2-drawer');if(d)d.classList.add('open');else q('#nx3-menu-button')?.click()};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
new MutationObserver(init).observe(document.body,{childList:true,subtree:true});
})();
