/* NEXUS Member UI — Canonical, self-contained single-path Member Presentation for Akash Fitness. */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const call = (fnName, ...args) => {
    try {
      if (typeof window[fnName] === 'function') {
        return window[fnName](...args);
      }
    } catch (e) {
      console.warn('[NEXUS]', fnName, e);
    }
  };

  const readSession = () => {
    try {
      return window.__nexusMemberSession || window.currentAthlete || JSON.parse(localStorage.getItem('rg_member_session') || 'null') || null;
    } catch (_) {
      return null;
    }
  };

  const memberName = () => readSession()?.full_name || 'AYUSH';
  const memberPhone = () => String(readSession()?.phone || readSession()?.normalized_phone || '').replace(/\D/g, '').slice(-10);
  const gymName = () => {
    const raw = $('#auth-gym-title')?.textContent || $('#header-gym-title')?.textContent || window.currentGymConfig?.gym_name || 'AKASH FITNESS';
    return String(raw).replace(/ATHLETE CYBER HUD TERMINAL/ig, '').trim() || 'AKASH FITNESS';
  };
  const supportPhone = () => {
    const raw = window.currentGymConfig?.support_phone || '8467895365';
    return String(raw).replace(/\D/g, '').slice(-10) || '8467895365';
  };
  const daysLeft = () => {
    const s = readSession();
    if (s?.days_remaining != null) return String(s.days_remaining);
    if (s?.valid_until) {
      const n = Math.ceil((new Date(s.valid_until).getTime() - Date.now()) / 86400000);
      return String(Math.max(0, n));
    }
    return '30';
  };
  const validUntil = () => {
    const v = readSession()?.valid_until;
    if (!v) return '1 OCT 2026';
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase();
  };
  const initials = () => memberName().split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'A';
  const sessionActive = () => {
    const s = readSession();
    return !!(s && (s.session_token || s.phone || s.normalized_phone || s.full_name || s.member_id));
  };

  const CSS = `
:root {
  --nx-l: #b8ff25;
  --nx-bg: #070809;
  --nx-line: rgba(255, 255, 255, 0.17);
  --nx-safe-top: env(safe-area-inset-top, 0px);
  --nx-safe-bottom: env(safe-area-inset-bottom, 0px);
}
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  min-height: 100% !important;
  background: var(--nx-bg) !important;
  color: #f5f6f6 !important;
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
  overflow: hidden !important;
}
#legacy-member-hud, .nx-legacy-wrapper {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  overflow: hidden !important;
}
#nx5-app {
  display: none;
  position: fixed !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100dvh !important;
  background: var(--nx-bg) !important;
  z-index: 1000 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  overscroll-behavior-y: contain;
  padding: 0 12px calc(78px + var(--nx-safe-bottom)) !important;
  box-sizing: border-box !important;
  -webkit-overflow-scrolling: touch;
  pointer-events: auto !important;
  touch-action: pan-y !important;
}
#nx5-app.live {
  display: block !important;
}
#nx5-app * {
  box-sizing: border-box;
}
.nx5-section {
  display: none;
}
.nx5-section.active {
  display: block;
}
.nx5-section[data-tab="home"] {
  min-height: calc(100dvh - 85px);
  display: none;
  flex-direction: column;
  justify-content: space-between;
  gap: 8px;
}
.nx5-section[data-tab="home"].active {
  display: flex;
}
#nx5-wrap {
  width: 100%;
  max-width: 520px;
  margin: 0 auto;
  padding-top: max(8px, var(--nx-safe-top));
}
.nx5-header {
  height: 60px;
  display: grid;
  grid-template-columns: 46px minmax(0, 1fr) 46px;
  gap: 8px;
  align-items: center;
  flex: none;
}
.nx5-menu, .nx5-user {
  width: 46px;
  height: 46px;
  border: 1px solid var(--nx-line);
  background: #101214;
  color: #fff;
  border-radius: 13px;
  display: grid;
  place-items: center;
  cursor: pointer;
  pointer-events: auto !important;
  touch-action: manipulation !important;
  -webkit-user-select: none;
  user-select: none;
}
.nx5-menu {
  font-size: 20px;
}
.nx5-user {
  border-radius: 50%;
  color: var(--nx-l);
  border-color: #78a82a;
  font: 800 15px 'Plus Jakarta Sans', sans-serif;
}
.nx5-brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}
.nx5-af {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: #11180c;
  border: 1px solid #78a82a;
  color: var(--nx-l);
  display: grid;
  place-items: center;
  font: 800 10px 'Space Mono', monospace;
}
.nx5-gym {
  font: 800 19px/1 'Plus Jakarta Sans', sans-serif;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nx5-vip {
  border: 1px solid #5e8521;
  border-radius: 6px;
  padding: 3px 5px;
  color: var(--nx-l);
  font: 700 7px 'Space Mono', monospace;
}
.nx5-tag {
  margin: 4px 0 0 44px;
  color: #747b7f;
  font: 600 7px 'Space Mono', monospace;
}
.nx5-hero {
  padding: 4px 0;
  flex: none;
}
.nx5-status {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 7px 10px;
  border: 1px solid #4d6f1c;
  background: #101805;
  border-radius: 8px;
  color: var(--nx-l);
  font: 800 9px 'Space Mono', monospace;
}
.nx5-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--nx-l);
  box-shadow: 0 0 9px var(--nx-l);
}
.nx5-hero h1 {
  margin: 8px 0 3px;
  font: 900 38px/0.95 'Plus Jakarta Sans', sans-serif;
  letter-spacing: -0.055em;
}
.nx5-sub {
  margin: 0;
  color: #858b8f;
  font: 600 12px/1.25 'Plus Jakarta Sans', sans-serif;
}
.nx5-pass {
  border: 1px solid rgba(255, 255, 255, 0.19);
  border-radius: 19px;
  padding: 15px;
  background: linear-gradient(145deg, #17191b, #0d0f10);
  position: relative;
  overflow: hidden;
  flex: none;
}
.nx5-pass:after {
  content: '';
  position: absolute;
  width: 190px;
  height: 190px;
  border: 1px solid rgba(184, 255, 37, 0.2);
  border-radius: 50%;
  right: -100px;
  top: -115px;
  pointer-events: none;
}
.nx5-pass-top {
  display: flex;
  justify-content: space-between;
  position: relative;
  z-index: 1;
}
.nx5-label {
  color: var(--nx-l);
  font: 800 9px 'Space Mono', monospace;
}
.nx5-mark {
  width: 38px;
  height: 38px;
  border: 1px solid #5e8521;
  border-radius: 10px;
  background: #18200e;
  color: var(--nx-l);
  display: grid;
  place-items: center;
  font: 800 18px 'Plus Jakarta Sans', sans-serif;
}
.nx5-member {
  margin: 13px 0 4px;
  font: 900 36px/0.92 'Plus Jakarta Sans', sans-serif;
  letter-spacing: -0.045em;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
}
.nx5-phone {
  color: #8a9094;
  font: 11px 'Space Mono', monospace;
}
.nx5-metrics {
  display: grid;
  grid-template-columns: 1.35fr 0.65fr;
  margin-top: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 13px;
  overflow: hidden;
  background: #090b0c;
}
.nx5-metric {
  padding: 11px 12px;
}
.nx5-metric + .nx5-metric {
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}
.nx5-metric small {
  display: block;
  color: var(--nx-l);
  font: 800 9px 'Space Mono', monospace;
  margin-bottom: 6px;
}
.nx5-metric strong {
  font: 800 22px/1 'Plus Jakarta Sans', sans-serif;
  white-space: nowrap;
}
.nx5-metric:last-child strong {
  font-size: 32px;
  color: var(--nx-l);
}
.nx5-idline {
  display: flex;
  justify-content: space-between;
  color: #70767a;
  font: 9px 'Space Mono', monospace;
  margin-top: 9px;
}
.nx5-check {
  position: relative;
  width: 100%;
  height: 64px;
  border: 0;
  border-radius: 14px;
  background: var(--nx-l);
  color: #071000;
  text-align: left;
  padding: 10px 14px;
  cursor: pointer;
  pointer-events: auto !important;
  touch-action: manipulation !important;
  flex: none;
}
.nx5-check b {
  font: 900 15px 'Plus Jakarta Sans', sans-serif;
}
.nx5-check small {
  display: block;
  font: 700 9px 'Space Mono', monospace;
  margin-top: 4px;
}
.nx5-check .bolt {
  float: right;
  font-size: 25px;
  margin-top: -23px;
}
.nx5-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
  flex: none;
}
.nx5-action {
  height: 94px;
  border: 1px solid var(--nx-line);
  border-radius: 14px;
  background: #0f1113;
  color: #fff;
  text-align: center;
  padding: 9px 4px;
  cursor: pointer;
  pointer-events: auto !important;
  touch-action: manipulation !important;
  -webkit-user-select: none;
  user-select: none;
}
.nx5-action .ico {
  display: block;
  color: var(--nx-l);
  font-size: 26px;
  line-height: 28px;
}
.nx5-action b {
  display: block;
  font: 800 12px 'Plus Jakarta Sans', sans-serif;
  margin-top: 8px;
}
.nx5-action small {
  display: block;
  color: #73797d;
  font: 700 8px 'Space Mono', monospace;
  margin-top: 4px;
}
.nx5-plan-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex: none;
}
.nx5-plan-head h2 {
  margin: 0;
  font: 900 24px/1 'Plus Jakarta Sans', sans-serif;
}
.nx5-live {
  color: #858b8f;
  font: 700 8px 'Space Mono', monospace;
}
.nx5-live i {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nx-l);
  margin-left: 4px;
}
.nx5-plan {
  min-height: 64px;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1px solid var(--nx-line);
  border-radius: 13px;
  background: #0e1012;
  padding: 10px 12px;
  margin-top: 6px;
  flex: none;
}
.nx5-plan-icon {
  width: 35px;
  height: 35px;
  border-radius: 9px;
  background: #18200f;
  color: var(--nx-l);
  display: grid;
  place-items: center;
}
.nx5-plan b {
  font: 800 12px 'Plus Jakarta Sans', sans-serif;
}
.nx5-plan small {
  display: block;
  color: #777d80;
  font: 700 9px 'Plus Jakarta Sans', sans-serif;
  margin-top: 3px;
}
.nx5-arrow {
  margin-left: auto;
  color: #777;
  font-size: 25px;
}
.nx5-back {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0 14px;
}
.nx5-back button {
  width: 42px;
  height: 42px;
  border: 1px solid var(--nx-line);
  border-radius: 11px;
  background: #101214;
  color: #fff;
  font-size: 25px;
  cursor: pointer;
  pointer-events: auto !important;
  touch-action: manipulation !important;
}
.nx5-title {
  margin: 0;
  font: 900 32px/1 'Plus Jakarta Sans', sans-serif;
}
.nx5-panel {
  border: 1px solid var(--nx-line);
  border-radius: 15px;
  background: #101214;
  padding: 15px;
  margin-bottom: 9px;
}
.nx5-statgrid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 7px;
  margin-bottom: 12px;
}
.nx5-stat {
  border: 1px solid var(--nx-line);
  border-radius: 13px;
  background: #0d0f10;
  padding: 13px 8px;
  text-align: center;
}
.nx5-stat strong {
  display: block;
  font: 900 22px 'Plus Jakarta Sans', sans-serif;
  color: var(--nx-l);
}
.nx5-stat small, .nx5-meal small, .nx5-step small {
  color: #777d80;
  font: 700 9px 'Plus Jakarta Sans', sans-serif;
}
.nx5-meal {
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1px solid var(--nx-line);
  border-radius: 13px;
  background: #101214;
  padding: 13px;
  margin-bottom: 7px;
}
.nx5-meal .emoji {
  font-size: 25px;
}
.nx5-meal b {
  font: 800 12px 'Plus Jakarta Sans', sans-serif;
}
.nx5-code {
  font: 900 25px 'Plus Jakarta Sans', sans-serif;
  color: var(--nx-l);
  margin: 5px 0 10px;
  letter-spacing: 1px;
}
.nx5-button {
  width: 100%;
  height: 50px;
  border: 0;
  border-radius: 12px;
  background: var(--nx-l);
  color: #071000;
  font: 900 12px 'Plus Jakarta Sans', sans-serif;
  cursor: pointer;
  pointer-events: auto !important;
  touch-action: manipulation !important;
}
.nx5-bottom {
  position: fixed !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  height: calc(68px + var(--nx-safe-bottom)) !important;
  padding: 4px 8px var(--nx-safe-bottom) !important;
  background: rgba(7, 8, 9, 0.985) !important;
  border-top: 1px solid rgba(255, 255, 255, 0.12) !important;
  z-index: 11000 !important;
  pointer-events: auto !important;
}
.nx5-bottom-inner {
  width: 100%;
  max-width: 520px;
  height: 60px;
  margin: auto;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  align-items: center;
}
.nx5-nav-item {
  height: 58px;
  border: 0;
  background: transparent;
  color: #73797d;
  border-radius: 12px;
  font: 800 8px 'Space Mono', monospace;
  cursor: pointer;
  pointer-events: auto !important;
  touch-action: manipulation !important;
  -webkit-user-select: none;
  user-select: none;
}
.nx5-nav-item.active {
  color: var(--nx-l);
}
.nx5-nav-item .ico {
  display: block;
  font: 22px/24px 'Plus Jakarta Sans', sans-serif;
  margin-bottom: 3px;
}
.nx5-check-circle {
  width: 52px;
  height: 52px;
  margin: -8px auto 0;
  border-radius: 50%;
  background: var(--nx-l);
  color: #071000;
  display: grid;
  place-items: center;
  font-size: 22px;
  box-shadow: 0 0 0 4px #090a0b, 0 0 24px rgba(184, 255, 37, 0.25);
}
.nx5-check-label {
  display: block;
  margin-top: 3px;
}
.nx5-drawer-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 12000;
  display: none;
  pointer-events: auto;
}
.nx5-drawer-backdrop.open {
  display: block;
}
.nx5-drawer {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: min(86vw, 360px);
  background: #0d0f10;
  border-right: 1px solid rgba(184, 255, 37, 0.3);
  z-index: 12001;
  transform: translateX(-105%);
  transition: transform 0.2s ease;
  padding: calc(18px + var(--nx-safe-top)) 18px 24px;
  box-shadow: 20px 0 60px rgba(0, 0, 0, 0.55);
  pointer-events: auto;
}
.nx5-drawer.open {
  transform: translateX(0);
}
.nx5-drawer-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 22px;
}
.nx5-drawer-head b {
  font: 900 22px 'Plus Jakarta Sans', sans-serif;
}
.nx5-drawer-close {
  width: 42px;
  height: 42px;
  border: 1px solid var(--nx-line);
  border-radius: 12px;
  background: #121416;
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
.nx5-drawer-card {
  border: 1px solid var(--nx-line);
  border-radius: 15px;
  padding: 14px;
  background: #111416;
  margin-bottom: 12px;
}
.nx5-drawer-item {
  width: 100%;
  height: 52px;
  border: 1px solid var(--nx-line);
  border-radius: 12px;
  background: #101214;
  color: #fff;
  text-align: left;
  padding: 0 14px;
  margin: 5px 0;
  font: 800 11px 'Plus Jakarta Sans', sans-serif;
  cursor: pointer;
  pointer-events: auto;
  touch-action: manipulation;
}
.nx5-drawer-item.accent {
  background: var(--nx-l);
  color: #071000;
  border-color: var(--nx-l);
}
.nx5-toast {
  position: fixed;
  left: 50%;
  bottom: 82px;
  transform: translate(-50%, 10px);
  opacity: 0;
  background: #f1f3f3;
  color: #070809;
  border-radius: 10px;
  padding: 10px 14px;
  font: 800 10px 'Space Mono', monospace;
  z-index: 60000;
  pointer-events: none;
  transition: opacity 0.15s, transform 0.15s;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
}
.nx5-toast.show {
  opacity: 1;
  transform: translate(-50%, 0);
}
#auth-modal, #pass-renewal-modal, #pwa-install-guide-modal, #qr-scanner-modal, #gatekeeper-modal {
  z-index: 25000 !important;
  pointer-events: auto !important;
}
#toast-container {
  z-index: 26000 !important;
  pointer-events: none !important;
}
#toast-container * {
  pointer-events: auto !important;
}
@media (max-height: 760px) {
  .nx5-header { height: 50px; }
  .nx5-hero h1 { font-size: 32px; }
  .nx5-member { font-size: 30px; }
  .nx5-action { height: 76px; }
  .nx5-check { height: 56px; }
  .nx5-plan { min-height: 54px; }
  .nx5-bottom { height: 60px; }
  .nx5-bottom-inner { height: 54px; }
  .nx5-nav-item { height: 52px; }
  .nx5-check-circle { width: 46px; height: 46px; font-size: 19px; }
}
`;

  function toast(msg) {
    let t = $('.nx5-toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(window.__nxToastTimer);
    window.__nxToastTimer = setTimeout(() => t.classList.remove('show'), 2000);
  }

  function attendance() {
    const old = $('#btn-punch-attendance');
    const b = $('#nx5-check');
    if (!b) return;

    const text = (old?.innerText || old?.textContent || '').replace(/\s+/g, ' ').toUpperCase();
    const verified = !!old?.disabled || /ATTENDANCE VERIFIED|ALREADY CHECKED|CHECK.?IN.*VERIFIED|TODAY.*CHECK.?IN/.test(text);

    if (verified) {
      b.disabled = true;
      b.onclick = null;
      b.innerHTML = '<b>✓ &nbsp; ATTENDANCE VERIFIED TODAY <span class="bolt">✓</span></b><small>YOUR GYM CHECK-IN HAS BEEN RECORDED</small>';
      b.style.opacity = '0.75';
      b.style.pointerEvents = 'none';
    } else {
      b.disabled = false;
      b.onclick = checkin;
      b.innerHTML = '<b>▣ &nbsp; CHECK IN AT THE GYM <span class="bolt">ϟ</span></b><small>SCAN THE RECEPTION QR • UPDATE YOUR STREAK</small>';
      b.style.opacity = '1';
      b.style.pointerEvents = 'auto';
    }
  }

  function checkin() {
    const b = $('#btn-punch-attendance');
    if (b && !b.disabled && typeof b.click === 'function') {
      try {
        b.click();
        return;
      } catch (_) {}
    }
    call('openDeskQRScanner');
  }

  function activate(tab) {
    const a = $('#nx5-app');
    if (!a) return;
    $$('.nx5-section', a).forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
    $$('.nx5-nav-item[data-tab]', a).forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
    a.scrollTop = 0;
    window.__nexusMemberActiveTab = tab;
  }

  function openDrawer() {
    const d = $('.nx5-drawer');
    const o = $('.nx5-drawer-backdrop');
    d?.classList.add('open');
    d?.setAttribute('aria-hidden', 'false');
    o?.classList.add('open');
  }

  function closeDrawer() {
    const d = $('.nx5-drawer');
    const o = $('.nx5-drawer-backdrop');
    d?.classList.remove('open');
    d?.setAttribute('aria-hidden', 'true');
    o?.classList.remove('open');
  }

  function runAction(action) {
    closeDrawer();
    if (action === 'renew') {
      return call('openPassRenewalModal');
    }
    if (action === 'install') {
      return call('triggerPwaInstall');
    }
    if (action === 'share') {
      return call('shareReferralViaWhatsApp');
    }
    if (action === 'referral') {
      return activate('referral');
    }
    if (action === 'progress') {
      return activate('progress');
    }
    if (action === 'nutrition') {
      return activate('nutrition');
    }
    if (action === 'pass') {
      return activate('pass');
    }
    if (action === 'home') {
      return activate('home');
    }
    if (action === 'checkin') {
      return checkin();
    }
    if (action === 'concierge') {
      const phone = supportPhone();
      const name = memberName();
      const text = encodeURIComponent(`Hi ${gymName()}, I am ${name} (+91 ${memberPhone()}). I need assistance with my gym membership pass.`);
      window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
      return;
    }
    if (action === 'logout') {
      const token = readSession()?.session_token;
      const finish = () => {
        localStorage.removeItem('rg_member_session');
        window.__nexusMemberSession = null;
        window.currentAthlete = null;
        if (typeof window.logoutAthlete === 'function') {
          try { window.logoutAthlete(); } catch (_) {}
        }
        syncAuth();
      };
      if (token && typeof window.logoutMemberSession === 'function') {
        Promise.resolve(window.logoutMemberSession(token)).finally(finish);
      } else if (token) {
        import('./assets/js/memberAuth.js').then((m) => m.logoutMemberSession?.(token)).catch(() => {}).finally(finish);
      } else {
        finish();
      }
      return;
    }
  }

  function syncAuth() {
    const s = readSession();
    const active = sessionActive();
    const app = $('#nx5-app');
    const auth = $('#auth-modal');

    if (active) {
      window.__nexusMemberSession = s;
      app?.classList.add('live');
      if (auth) {
        auth.classList.add('hidden');
        auth.style.display = 'none';
      }
      hydrate();
      attendance();
    } else {
      app?.classList.remove('live');
      closeDrawer();
      if (auth) {
        auth.classList.remove('hidden');
        auth.style.display = 'flex';
      }
    }
  }

  function hydrate() {
    const n = $('#nx5-name');
    const p = $('#nx5-phone');
    const g = $('#nx5-gym');
    const d = $('#nx5-days');
    const e = $('#nx5-expiry');
    const i = $('#nx5-id');
    const u = $('#nx5-user');
    const m = $('#nx5-member');
    const dn = $('#nx5-drawer-name');
    const pm = $('#nx5-pass-member');
    const pp = $('#nx5-pass-phone');
    const pe = $('#nx5-pass-expiry');
    const refCode = $('#nx5-referral-code');

    const name = memberName();
    const phone = memberPhone();
    const gym = gymName();
    const days = daysLeft();
    const expiry = validUntil();
    const code = readSession()?.referral_code || phone || 'NEXUS';

    if (n) n.textContent = name;
    if (m) m.textContent = name;
    if (p) p.textContent = phone ? `+91 ${phone}` : '—';
    if (g) g.textContent = gym;
    if (d) d.textContent = days;
    if (e) e.textContent = expiry;
    if (i) i.textContent = phone ? `RT-${phone}` : 'RT-MEMBER';
    if (u) u.textContent = initials();
    if (dn) dn.textContent = name;
    if (pm) pm.textContent = name;
    if (pp) pp.textContent = phone ? `+91 ${phone}` : '—';
    if (pe) pe.textContent = expiry;
    if (refCode) refCode.textContent = code;
  }

  function build() {
    if ($('#nx5-app')) return;

    const st = document.createElement('style');
    st.id = 'nx5-style-canonical';
    st.textContent = CSS;
    document.head.appendChild(st);

    const a = document.createElement('div');
    a.id = 'nx5-app';
    a.innerHTML = `
<div id="nx5-wrap">
  <header class="nx5-header">
    <button type="button" class="nx5-menu" id="nx5-menu" aria-label="Open menu">☰</button>
    <div>
      <div class="nx5-brand-row">
        <div class="nx5-af">AF</div>
        <b class="nx5-gym" id="nx5-gym">${esc(gymName())}</b>
        <span class="nx5-vip">● VIP</span>
      </div>
      <div class="nx5-tag">AKASH FITNESS • DIGITAL MEMBER HUD</div>
    </div>
    <button type="button" class="nx5-user" id="nx5-user" aria-label="Member menu">${initials()}</button>
  </header>

  <!-- TAB: HOME -->
  <section class="nx5-section active" data-tab="home">
    <div class="nx5-hero">
      <span class="nx5-status"><i class="nx5-dot"></i> MEMBERSHIP ACTIVE</span>
      <h1>HEY, <span id="nx5-name">${esc(memberName())}</span>. 👋</h1>
      <p class="nx5-sub">YOUR TRAINING DAY STARTS HERE.</p>
    </div>

    <div class="nx5-pass">
      <div class="nx5-pass-top">
        <span class="nx5-label">NEXUS DIGITAL MEMBERSHIP</span>
        <span class="nx5-mark" id="nx5-mark">${initials()[0] || 'A'}</span>
      </div>
      <div class="nx5-member" id="nx5-member">${esc(memberName())}</div>
      <div class="nx5-phone" id="nx5-phone">${esc(memberPhone() ? '+91 ' + memberPhone() : '—')}</div>
      <div class="nx5-metrics">
        <div class="nx5-metric">
          <small>VALID UNTIL</small>
          <strong id="nx5-expiry">${validUntil()}</strong>
        </div>
        <div class="nx5-metric">
          <small>DAYS LEFT</small>
          <strong id="nx5-days">${daysLeft()}</strong>
        </div>
      </div>
      <div class="nx5-idline">
        <span>MEMBER ID</span>
        <span id="nx5-id">${memberPhone() ? `RT-${memberPhone()}` : 'RT-MEMBER'}</span>
      </div>
    </div>

    <button type="button" class="nx5-check" id="nx5-check" data-action="checkin">
      <b>▣ &nbsp; CHECK IN AT THE GYM <span class="bolt">ϟ</span></b>
      <small>SCAN THE RECEPTION QR • UPDATE YOUR STREAK</small>
    </button>

    <div class="nx5-actions">
      <button type="button" class="nx5-action" data-action="renew">
        <span class="ico">⟳</span>
        <b>Renew Pass</b>
        <small>UPI • INSTANT</small>
      </button>
      <button type="button" class="nx5-action" data-action="concierge">
        <span class="ico">💬</span>
        <b>Gym Concierge</b>
        <small>WHATSAPP</small>
      </button>
      <button type="button" class="nx5-action" data-action="install">
        <span class="ico">⇩</span>
        <b>Install App</b>
        <small>ADD TO HOME</small>
      </button>
    </div>

    <div class="nx5-plan-head">
      <h2>TODAY'S PLAN</h2>
      <span class="nx5-live">LIVE <i></i></span>
    </div>
    <div class="nx5-plan">
      <span class="nx5-plan-icon">💪</span>
      <div>
        <b>PUSH FOCUS</b>
        <small>CHEST • SHOULDERS • TRICEPS</small>
      </div>
      <span class="nx5-arrow">›</span>
    </div>
    <div class="nx5-plan">
      <span class="nx5-plan-icon">🔥</span>
      <div>
        <b>KEEP YOUR STREAK</b>
        <small>CHECK IN TODAY TO RECORD YOUR SESSION</small>
      </div>
      <span class="nx5-arrow">›</span>
    </div>
  </section>

  <!-- TAB: PROGRESS -->
  <section class="nx5-section" data-tab="progress">
    <div class="nx5-back">
      <button type="button" data-action="home">‹</button>
      <h2 class="nx5-title">PROGRESS</h2>
    </div>
    <div class="nx5-statgrid">
      <div class="nx5-stat">
        <strong>${daysLeft()}</strong>
        <small>DAYS LEFT</small>
      </div>
      <div class="nx5-stat">
        <strong>VIP</strong>
        <small>STATUS</small>
      </div>
      <div class="nx5-stat">
        <strong>100%</strong>
        <small>ACCESS</small>
      </div>
    </div>
    <div class="nx5-panel">
      <b>Training Progress & Attendance</b>
      <p class="nx5-sub" style="margin-top: 6px;">Your live check-in history and workouts synchronize automatically when scanning the desk QR.</p>
    </div>
  </section>

  <!-- TAB: REFERRAL -->
  <section class="nx5-section" data-tab="referral">
    <div class="nx5-back">
      <button type="button" data-action="home">‹</button>
      <h2 class="nx5-title">REFERRAL</h2>
    </div>
    <div class="nx5-panel">
      <span class="nx5-label">INVITE FRIENDS & EARN FREE DAYS</span>
      <div class="nx5-code" id="nx5-referral-code">${esc(readSession()?.referral_code || memberPhone() || 'NEXUS')}</div>
      <button type="button" class="nx5-button" data-action="share">SHARE ON WHATSAPP 🚀</button>
    </div>
    <div class="nx5-panel">
      <b>YOUR SQUAD</b>
      <p class="nx5-sub" style="margin-top: 6px;">Every friend who joins using your code adds +7 free days to your VIP pass.</p>
    </div>
  </section>

  <!-- TAB: NUTRITION -->
  <section class="nx5-section" data-tab="nutrition">
    <div class="nx5-back">
      <button type="button" data-action="home">‹</button>
      <h2 class="nx5-title">NUTRITION</h2>
    </div>
    <div class="nx5-meal">
      <span class="emoji">🥣</span>
      <div>
        <b>Breakfast Fuel</b>
        <small>High protein oats + eggs + almonds</small>
      </div>
    </div>
    <div class="nx5-meal">
      <span class="emoji">🍛</span>
      <div>
        <b>Power Lunch</b>
        <small>Grilled chicken / paneer + rice + dal</small>
      </div>
    </div>
    <div class="nx5-meal">
      <span class="emoji">🥗</span>
      <div>
        <b>Post-Workout Recovery</b>
        <small>Whey protein shake + banana</small>
      </div>
    </div>
  </section>

  <!-- TAB: PASS -->
  <section class="nx5-section" data-tab="pass">
    <div class="nx5-back">
      <button type="button" data-action="home">‹</button>
      <h2 class="nx5-title">MEMBERSHIP PASS</h2>
    </div>
    <div class="nx5-pass" style="margin-bottom: 12px;">
      <span class="nx5-label">DIGITAL ACCESS KEY</span>
      <div class="nx5-member" id="nx5-pass-member">${esc(memberName())}</div>
      <div class="nx5-phone" id="nx5-pass-phone">${esc(memberPhone() ? '+91 ' + memberPhone() : '—')}</div>
      <div class="nx5-idline">
        <span>VALID UNTIL</span>
        <span id="nx5-pass-expiry">${validUntil()}</span>
      </div>
    </div>
    <button type="button" class="nx5-button" data-action="renew">RENEW MEMBERSHIP ⚡</button>
  </section>
</div>

<!-- FIXED BOTTOM NAVIGATION -->
<nav class="nx5-bottom">
  <div class="nx5-bottom-inner">
    <button type="button" class="nx5-nav-item active" data-tab="home">
      <span class="ico">⌂</span>
      HOME
    </button>
    <button type="button" class="nx5-nav-item" data-tab="progress">
      <span class="ico">↗</span>
      PROGRESS
    </button>
    <button type="button" class="nx5-nav-item" data-tab="checkin">
      <span class="nx5-check-circle">▣</span>
      <span class="nx5-check-label">CHECK-IN</span>
    </button>
    <button type="button" class="nx5-nav-item" data-tab="referral">
      <span class="ico">👥</span>
      REFERRAL
    </button>
    <button type="button" class="nx5-nav-item" data-tab="nutrition">
      <span class="ico">🥗</span>
      NUTRITION
    </button>
  </div>
</nav>

<!-- SLIDE-OUT CONCIERGE DRAWER -->
<div class="nx5-drawer-backdrop" id="nx5-drawer-backdrop"></div>
<aside class="nx5-drawer" id="nx5-drawer" aria-hidden="true">
  <div class="nx5-drawer-head">
    <b>AKASH FITNESS</b>
    <button type="button" class="nx5-drawer-close" data-action="close-drawer" aria-label="Close menu">×</button>
  </div>
  <div class="nx5-drawer-card">
    <b id="nx5-drawer-name">${esc(memberName())}</b>
    <div class="nx5-sub">Member Portal • Live VIP Pass</div>
  </div>
  <button type="button" class="nx5-drawer-item" data-action="pass">Membership Pass</button>
  <button type="button" class="nx5-drawer-item" data-action="renew">Renew Pass (UPI Instant)</button>
  <button type="button" class="nx5-drawer-item accent" data-action="concierge">WhatsApp Concierge</button>
  <button type="button" class="nx5-drawer-item" data-action="share">Invite Friends / Share</button>
  <button type="button" class="nx5-drawer-item" data-action="nutrition">Nutrition Guidelines</button>
  <button type="button" class="nx5-drawer-item" data-action="install">Install App to Home Screen</button>
  <button type="button" class="nx5-drawer-item" style="color:#ff6b6b;border-color:rgba(255,107,107,0.3);margin-top:14px;" data-action="logout">Log Out</button>
</aside>

<div class="nx5-toast"></div>
`;
    document.body.appendChild(a);

    // Bind event listeners cleanly
    const bindClick = (el, fn) => {
      if (!el) return;
      el.addEventListener('click', (e) => {
        fn(e);
      });
    };

    bindClick($('#nx5-menu'), openDrawer);
    bindClick($('#nx5-user'), openDrawer);
    bindClick($('#nx5-drawer-backdrop'), closeDrawer);
    bindClick($('.nx5-drawer-close'), closeDrawer);

    $$('[data-action]', a).forEach((el) => {
      bindClick(el, () => {
        const action = el.dataset.action;
        if (action === 'close-drawer') return closeDrawer();
        runAction(action);
      });
    });

    $$('.nx5-nav-item[data-tab]', a).forEach((el) => {
      bindClick(el, () => {
        const tab = el.dataset.tab;
        if (tab === 'checkin') return checkin();
        activate(tab);
      });
    });

    bindClick($('#nx5-check'), checkin);

    window.__nexusRefreshMemberUI = () => {
      hydrate();
      attendance();
      syncAuth();
    };

    syncAuth();
    attendance();

    setInterval(() => {
      if (document.visibilityState === 'visible' && sessionActive()) {
        hydrate();
        attendance();
      }
    }, 1500);
  }

  function init() {
    build();
    syncAuth();

    window.addEventListener('nexus:member-live-update', syncAuth);
    window.addEventListener('nexus:member-login', syncAuth);
    window.addEventListener('nexus:member-auth', syncAuth);
    window.addEventListener('nexus:member-logout', syncAuth);
    window.addEventListener('nexus:member-refresh', syncAuth);
    window.addEventListener('pageshow', syncAuth);
    window.addEventListener('focus', syncAuth);
    window.addEventListener('online', syncAuth);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') syncAuth();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
