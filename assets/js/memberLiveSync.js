import { supabase } from './supabaseClient.js';

const MEMBER_SESSION_KEY = 'rg_member_session';
const EVENT_NAME = 'nexus:member-live-update';
const FALLBACK_INTERVAL_MS = 15000;

let activeMemberTopic = null;
let activeGymTopic = null;
let activeMemberChannel = null;
let activeGymChannel = null;
let lastSessionFingerprint = '';
let refreshTimer = null;
let refreshInFlight = false;
let retryTimer = null;

function readSession() {
  try {
    const value = JSON.parse(localStorage.getItem(MEMBER_SESSION_KEY) || 'null');
    return value && value.session_token && value.id && value.gym_id && value.gym_slug ? value : null;
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
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { ...data, member_id: merged.id, gym_id: merged.gym_id, gym_slug: merged.gym_slug }, reason }));
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
  refreshTimer = window.setTimeout(() => refreshFromServer(reason), 100);
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

  const memberChannel = supabase
    .channel(memberTopic)
    .on('broadcast', { event: 'member_sync' }, () => scheduleRefresh('member-change'))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') scheduleRefresh('connected');
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          const current = readSession();
          if (current) startChannels(current);
        }, 2000);
      }
    });

  const gymChannel = supabase
    .channel(gymTopic)
    .on('broadcast', { event: 'gym_sync' }, () => scheduleRefresh('gym-change'))
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        window.clearTimeout(retryTimer);
        retryTimer = window.setTimeout(() => {
          const current = readSession();
          if (current) startChannels(current);
        }, 2000);
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

export async function startMemberLiveSync() {
  if (typeof window === 'undefined') return;
  await reconcile();
  if (!window.__nexusLiveSyncInstalled) {
    window.__nexusLiveSyncInstalled = true;
    window.addEventListener('focus', () => { reconcile(); scheduleRefresh('focus'); });
    window.addEventListener('online', () => { reconcile(); scheduleRefresh('online'); });
    window.addEventListener('pageshow', () => { reconcile(); scheduleRefresh('pageshow'); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        reconcile();
        scheduleRefresh('visible');
      }
    });
    window.setInterval(() => {
      reconcile();
      refreshFromServer('fallback-poll');
    }, FALLBACK_INTERVAL_MS);
  }
}

window.__nexusStartMemberLiveSync = startMemberLiveSync;

if (typeof window !== 'undefined') {
  startMemberLiveSync();
}
