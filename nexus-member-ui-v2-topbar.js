(()=>{
'use strict';
const q=(s,r=document)=>r.querySelector(s);
const text=()=>String(q('#auth-gym-title')?.textContent||q('#header-gym-title')?.textContent||'RETRO GYM').replace(/ATHLETE CYBER HUD TERMINAL/ig,'').replace(/\s+/g,' ').trim()||'RETRO GYM';
const member=()=>String(q('#pass-member-name')?.textContent||'MEMBER').replace(/\s+/g,' ').trim();
const init=()=>{
 const tab=q('#tab-pass'); if(!tab||q('#nx2-topbar')) return;
 const bar=document.createElement('div'); bar.id='nx2-topbar'; bar.className='nx2-top nx2-force-show';
 const initials=member().split(' ').filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'M';
 bar.innerHTML='<button type="button" class="nx2-menu" id="nx2-menu-button" aria-label="Open member menu"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button><div class="nx2-brand"><div class="nx2-brand-name">'+text().toUpperCase()+'</div><div class="nx2-brand-sub">NEXUS MEMBER · PRIVATE FITNESS</div></div><div class="nx2-avatar">'+initials+'</div>';
 tab.prepend(bar);
 bar.querySelector('#nx2-menu-button').onclick=()=>{const d=document.getElementById('nx2-drawer');if(d)d.classList.add('open')};
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
new MutationObserver(init).observe(document.body,{childList:true,subtree:true});
})();