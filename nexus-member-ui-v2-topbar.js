(()=>{
'use strict';
const q=(s,r=document)=>r.querySelector(s);
const text=()=>String(q('#auth-gym-title')?.textContent||q('#header-gym-title')?.textContent||'RETRO GYM').replace(/ATHLETE CYBER HUD TERMINAL/ig,'').replace(/\s+/g,' ').trim()||'RETRO GYM';
const init=()=>{
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
