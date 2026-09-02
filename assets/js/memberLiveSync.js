import { supabase } from './supabaseClient.js';

const MEMBER_SESSION_KEY = 'rg_member_session';
const EVENT_NAME = 'nexus:member-live-update';
const VISIBLE_POLL_INTERVAL_MS = 1000;

let activeMemberTopic = null;
let activeGymTopic = null;
let activeMemberChannel = null;
let activeGymChannel = null;
let lastSessionFingerprint = '';
let refreshTimer = null;
let refreshInFlight = false;
let retryTimer = null;
let visibleFastPollTimer = null;

function readSession() {
  try {
    const value = JSON.parse(localStorage.getItem(MEMBER_SESSION_KEY) || 'null');
    const token = value?.session_token;
    const memberId = value?.member_id || value?.id;
    const gymSlug = value?.gym_slug || window.currentGymSlug || new URLSearchParams(window.location.search).get('gym') || 'akash-fitness';
    const gymId = value?.gym_id || 1;
    if (token && memberId) {
      return {
        ...value,
        id: memberId,
        member_id: memberId,
        gym_slug: gymSlug,
        gym_id: gymId,
        session_token: token
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

async function digestHex(value) {
  try {
    if (globalThis.crypto?.subtle) {
      const bytes = new TextEncoder().encode(String(value));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (_) {}
  return String(value);
}

function removeChannel(channel) {
  if (!channel) return Promise.resolve();
  try { return supabase.removeChannel(channel); } catch (_) { return Promise.resolve(); }
}

async function stopChannels() {
  const member = activeMemberChannel;
  const gym = activeGymChannel;
  activeMemberChannel = null;
  activeGymChannel = null;
  activeMemberTopic = null;
  activeGymTopic = null;
  await Promise.allSettled([removeChannel(member), removeChannel(gym)]);
}

function applyAttendanceButtonState(state) {
  const btn = document.getElementById('btn-punch-attendance');
  const icon = document.getElementById('punch-btn-icon');
  const text = document.getElementById('punch-btn-text');
  const sync = document.getElementById('punch-last-sync');
  if (!btn || !state?.success) return;

  if (state.checked_in_today) {
    btn.onclick = null;
    btn.disabled = true;
    btn.className = "w-full py-4 px-4 bg-gradient-to-r from-emerald-500 via-matrixGreen to-cyberVolt text-black font-brand font-extrabold text-base tracking-wider rounded-2xl shadow-glow-green uppercase flex items-center justify-center gap-2 cursor-default opacity-90";
    if (icon) icon.innerText = "✓";
    if (text) text.innerText = "ATTENDANCE VERIFIED TODAY";
    if (sync) {
      const t = state.check_in ? new Date(state.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today';
      sync.innerText = `Today's Check-in: ${t} ✓`;
    }
  } else {
    btn.disabled = false;
    btn.onclick = () => window.openDeskQRScanner?.();
    btn.className = "w-full py-4 px-4 bg-gradient-to-r from-matrixGreen via-[#33ff88] to-cyberVolt text-black font-brand font-extrabold text-base tracking-wider rounded-2xl shadow-glow-green hover:brightness-110 active:scale-95 transition-all uppercase flex items-center justify-center gap-2 cursor-pointer relative overflow-hidden";
    if (icon) icon.innerText = "📷";
    if (text) text.innerText = "SCAN DESK QR TO PUNCH ATTENDANCE";
    if (sync) sync.innerText = "Today's Check-in: Not Logged";
  }
}

async function refreshFromServer(reason = 'live') {
  if (refreshInFlight) return;
  const session = readSession();
  if (!session) return;
  refreshInFlight = true;
  try {
    const { data, error } = await supabase.rpc('rpc_member_refresh_session', {
      p_gym_slug: String(session.gym_slug),
      p_session_token: String(session.session_token)
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Member session expired');

    const merged = {
      ...session,
      ...data,
      id: data.member_id || session.id,
      member_id: data.member_id || session.id,
      gym_id: data.gym_id || session.gym_id,
      gym_slug: data.gym_slug || session.gym_slug,
      phone: data.phone || session.phone,
      normalized_phone: data.phone || session.normalized_phone,
      session_token: session.session_token,
      session_expires_at: data.session_expires_at || session.session_expires_at || null,
      saved_at: Date.now()
    };
    localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(merged));
    window.__nexusMemberSession = merged;

    try {
      const { data: punchState, error: punchError } = await supabase.rpc('rpc_member_attendance_status', {
        p_gym_slug: String(session.gym_slug),
        p_member_id: merged.id,
        p_session_token: String(session.session_token)
      });
      if (!punchError && punchState?.success) applyAttendanceButtonState(punchState);
    } catch (punchError) {
      console.warn('[NEXUS ATTENDANCE STATE] Refresh failed:', punchError?.message || punchError);
    }

    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { ...data, member_id: merged.id, gym_id: merged.gym_id, gym_slug: merged.gym_slug }, reason }));
    window.dispatchEvent(new CustomEvent('nexus:member-refresh', { detail: merged, reason }));
    if (typeof window.__nexusRefreshMemberUI === 'function') window.__nexusRefreshMemberUI();
    if (typeof window.__nexusHideOldPresentation === 'function') window.__nexusHideOldPresentation();
    if (typeof window.renderAthletePassHUD === 'function') window.renderAthletePassHUD();
  } catch (error) {
    if (/session expired|session missing|member not found/i.test(error?.message || '')) {
      localStorage.removeItem(MEMBER_SESSION_KEY);
      window.__nexusMemberSession = null;
      await stopChannels();
      return;
    }
    console.warn('[NEXUS LIVE SYNC] Refresh failed:', error?.message || error);
  } finally {
    refreshInFlight = false;
  }
}

function scheduleRefresh(reason) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => refreshFromServer(reason), 80);
}

async function startChannels(session) {
  const fingerprint = `${session.id}:${session.gym_id}:${session.session_token}`;
  if (fingerprint === lastSessionFingerprint && activeMemberChannel && activeGymChannel) return;
  lastSessionFingerprint = fingerprint;
  await stopChannels();

  const [memberHash, gymHash] = await Promise.all([
    digestHex(session.id),
    digestHex(session.gym_id)
  ]);
  const memberTopic = `nexus:member-sync:${memberHash}`;
  const gymTopic = `nexus:gym-sync:${gymHash}`;
  activeMemberTopic = memberTopic;
  activeGymTopic = gymTopic;

  try { supabase.realtime.connect(); } catch (_) {}

  const memberChannel = supabase
    .channel(memberTopic)
    .on('broadcast', { event: 'member_sync' }, () => scheduleRefresh('member-broadcast'))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') scheduleRefresh('connected');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          const current = readSession();
          if (current) startChannels(current);
        }, 1500);
      }
    });

  const gymChannel = supabase
    .channel(gymTopic)
    .on('broadcast', { event: 'gym_sync' }, () => scheduleRefresh('gym-broadcast'))
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          const current = readSession();
          if (current) startChannels(current);
        }, 1500);
      }
    });

  activeMemberChannel = memberChannel;
  activeGymChannel = gymChannel;
}

async function reconcile() {
  const session = readSession();
  if (!session) {
    if (lastSessionFingerprint) {
      lastSessionFingerprint = '';
      await stopChannels();
    }
    return;
  }
  const fingerprint = `${session.id}:${session.gym_id}:${session.session_token}`;
  if (fingerprint !== lastSessionFingerprint || !activeMemberChannel || !activeGymChannel) {
    await startChannels(session);
  }
}

function manageFallbackPolling() {
  if (visibleFastPollTimer) {
    clearInterval(visibleFastPollTimer);
    visibleFastPollTimer = null;
  }
  if (document.visibilityState === 'visible') {
    const session = readSession();
    if (session?.session_token) {
      visibleFastPollTimer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          const s = readSession();
          if (s?.session_token) {
            scheduleRefresh('visible-fast-poll');
          }
        }
      }, VISIBLE_POLL_INTERVAL_MS);
    }
  }
}

export async function startMemberLiveSync() {
  if (typeof window === 'undefined') return;
  await reconcile();
  manageFallbackPolling();
  if (!window.__nexusLiveSyncInstalled) {
    window.__nexusLiveSyncInstalled = true;
    const wake = (reason) => {
      try { supabase.realtime.connect(); } catch (_) {}
      reconcile();
      scheduleRefresh(reason);
      manageFallbackPolling();
    };
    window.addEventListener('focus', () => wake('focus'));
    window.addEventListener('online', () => wake('online'));
    window.addEventListener('pageshow', () => wake('pageshow'));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        wake('visible');
      } else {
        if (visibleFastPollTimer) {
          clearInterval(visibleFastPollTimer);
          visibleFastPollTimer = null;
        }
      }
    });
  }
}

window.__nexusStartMemberLiveSync = startMemberLiveSync;

if (typeof window !== 'undefined') {
  startMemberLiveSync();
}
