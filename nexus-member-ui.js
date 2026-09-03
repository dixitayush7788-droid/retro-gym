/* ==========================================================================
   NEXUS MEMBER PORTAL — CANONICAL SINGLE-PATH RUNTIME ARCHITECTURE
   Akash Fitness / Multi-Tenant Digital Pass & Cyber HUD
   ========================================================================== */

(() => {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. CONSTANTS & SUPABASE CONFIGURATION
  // --------------------------------------------------------------------------
  const SUPABASE_URL = 'https://zfvkvrhuovvbfbrutpph.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_bFbeqpwaWmp0aioDVSkLAg_J7X4lzWk';
  const DEFAULT_GYM_SLUG = 'akash-fitness-2343';
  const LEGACY_SLUG_ALIASES = ['akash-fitness', 'retro-gym'];
  const MEMBER_SESSION_KEY = 'rg_member_session';
  const LAST_GYM_SLUG_KEY = 'rg_last_gym_slug';

  // Initialize Canonical Supabase Client Singleton
  let supabaseClient = null;
  function getSupabase() {
    if (supabaseClient) return supabaseClient;
    if (typeof window !== 'undefined' && window.__NEXUS_CANONICAL_SUPABASE_CLIENT__) {
      supabaseClient = window.__NEXUS_CANONICAL_SUPABASE_CLIENT__;
      return supabaseClient;
    }
    const config = {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    };
    if (typeof window !== 'undefined' && window.supabase?.createClient) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, config);
    }
    if (typeof window !== 'undefined' && supabaseClient) {
      window.__NEXUS_CANONICAL_SUPABASE_CLIENT__ = supabaseClient;
      window.supabaseClient = supabaseClient;
      window.db = supabaseClient;
    }
    return supabaseClient;
  }

  // --------------------------------------------------------------------------
  // 2. CANONICAL CENTRALIZED STATE
  // --------------------------------------------------------------------------
  const state = {
    tenant: {
      id: 4,
      slug: DEFAULT_GYM_SLUG,
      name: 'Akash fitness',
      tagline: 'DIGITAL MEMBER HUD',
      logo_url: '',
      owner_upi: 'Akash@897',
      owner_phone: '9044372343',
      status: 'OPEN', // OPEN | DELAYED | CLOSED | HOLIDAY | SUSPENDED | INACTIVE
      notice_text: 'Regular timings in effect. Stay hydrated and hit your sets!',
      delayed_time: '5:00 PM',
      pricing: { p1: 1200, p3: 3200, p6: 5800, p12: 10500 },
      features: { workouts: true, nutrition: true, qr_attendance: true, notices: true },
      updated_at: new Date().toISOString()
    },
    member: null, // full_name, phone, valid_until, days_remaining, plan_name, streak_count, referral_code, etc.
    attendance: {
      checked_in_today: false,
      check_in_time: null,
      attendance_status: 'NOT_CHECKED_IN'
    },
    session: {
      session_token: null,
      session_expires_at: null
    },
    ui: {
      isInitializing: true,
      gatekeeperError: null, // { title, message, details, type }
      authStep: 'phone', // 'phone' | 'pin'
      pendingAuthMember: null,
      pinDigits: ['', '', '', ''],
      activeTab: 'home', // 'home' | 'progress' | 'referral' | 'nutrition' | 'pass'
      drawerOpen: false,
      renewModalOpen: false,
      qrModalOpen: false,
      installModalOpen: false,
      selectedRenewalMonths: 1,
      qrScannerInstance: null
    }
  };

  // Expose state for runtime inspection
  if (typeof window !== 'undefined') {
    window.nexusState = state;
  }

  // --------------------------------------------------------------------------
  // 2B. CALENDAR DATE & ATTENDANCE SAME-DAY PERSISTENCE
  // --------------------------------------------------------------------------
  function getTodayCalendarDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function getAttendanceLockKey(gymSlug, memberId) {
    const s = String(gymSlug || state.tenant.slug || DEFAULT_GYM_SLUG).toLowerCase().trim();
    const m = String(memberId || state.member?.id || state.member?.member_id || '').trim();
    const dateStr = getTodayCalendarDateString();
    return `rg_att_lock_${s}_${m}_${dateStr}`;
  }

  function setLocalAttendanceLock(gymSlug, memberId, checkInTimeStr) {
    try {
      const key = getAttendanceLockKey(gymSlug, memberId);
      const data = {
        date: getTodayCalendarDateString(),
        check_in_time: checkInTimeStr || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (_) {}
  }

  function getLocalAttendanceLock(gymSlug, memberId) {
    try {
      const key = getAttendanceLockKey(gymSlug, memberId);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.date === getTodayCalendarDateString()) {
        return parsed;
      }
      localStorage.removeItem(key);
    } catch (_) {}
    return null;
  }

  function clearLocalAttendanceLock(gymSlug, memberId) {
    try {
      const key = getAttendanceLockKey(gymSlug, memberId);
      localStorage.removeItem(key);
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 3. UTILITY & AUDIO SYNTHESIS ENGINE
  // --------------------------------------------------------------------------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cleanPhone = (p) => String(p || '').replace(/\D/g, '').slice(-10);

  let audioCtx = null;
  function playCyberChime(type = 'success') {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!audioCtx && AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      if (!audioCtx) return;

      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === 'tap') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
        osc.start(now);
        osc.stop(now + 0.04);
      } else if (type === 'alert') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.linearRampToValueAtTime(240, now + 0.2);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (_) {}
  }

  function showToast(message, type = 'info') {
    const container = $('#nexus-toast-container') || document.body;
    const toast = document.createElement('div');
    let border = 'border-cyberVolt/40 text-cyberVolt';
    let icon = '⚡';
    if (type === 'success') { border = 'border-matrixGreen/50 text-matrixGreen'; icon = '✓'; }
    if (type === 'error') { border = 'border-crimsonAlert/50 text-crimsonAlert'; icon = '⚠️'; }
    if (type === 'alert' || type === 'warning') { border = 'border-moltenGold/50 text-moltenGold'; icon = '⏳'; }

    toast.className = `p-3.5 rounded-2xl bg-surfaceCard/95 border ${border} shadow-2xl backdrop-blur-xl font-mono text-xs flex items-center justify-between transition-all duration-300 transform translate-y-2 pointer-events-auto`;
    toast.innerHTML = `<span>${esc(message)}</span><span class="text-xs ml-2">${icon}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // --------------------------------------------------------------------------
  // 4. TENANT RESOLUTION & GATEKEEPER
  // --------------------------------------------------------------------------
  function normalizeGymSlug(slug) {
    if (!slug || typeof slug !== 'string') return DEFAULT_GYM_SLUG;
    const trimmed = slug.toLowerCase().trim();
    if (LEGACY_SLUG_ALIASES.includes(trimmed)) {
      return DEFAULT_GYM_SLUG;
    }
    return trimmed;
  }

  function resolveCurrentGymSlug() {
    // 1. URL parameter ?gym=<slug> is authoritative when explicitly supplied
    const urlParam = new URLSearchParams(window.location.search).get('gym');
    if (urlParam) {
      const resolved = normalizeGymSlug(urlParam);
      localStorage.setItem(LAST_GYM_SLUG_KEY, resolved);
      return resolved;
    }

    // 2. Check persisted session (ONLY valid non-numeric gym_slug string, never numeric gym_id)
    try {
      const saved = JSON.parse(localStorage.getItem(MEMBER_SESSION_KEY) || 'null');
      if (saved && typeof saved.gym_slug === 'string' && saved.gym_slug.trim() && isNaN(Number(saved.gym_slug))) {
        const resolved = normalizeGymSlug(saved.gym_slug);
        localStorage.setItem(LAST_GYM_SLUG_KEY, resolved);
        return resolved;
      }
    } catch (_) {}

    // 3. Check last remembered gym slug
    const last = localStorage.getItem(LAST_GYM_SLUG_KEY);
    if (last && typeof last === 'string' && last.trim() && isNaN(Number(last))) {
      const resolved = normalizeGymSlug(last);
      localStorage.setItem(LAST_GYM_SLUG_KEY, resolved);
      return resolved;
    }

    // 4. Canonical deployment default for Akash Fitness
    localStorage.setItem(LAST_GYM_SLUG_KEY, DEFAULT_GYM_SLUG);
    return DEFAULT_GYM_SLUG;
  }

  async function fetchAndHydrateGym(inputSlug) {
    const slug = normalizeGymSlug(inputSlug);
    const db = getSupabase();
    let gymData = null;

    if (db) {
      try {
        const { data: rpcData, error: rpcErr } = await db.rpc('rpc_get_public_gym_by_slug', { p_slug: slug });
        if (!rpcErr && rpcData) {
          gymData = rpcData;
        }
      } catch (_) {}

      if (!gymData) {
        try {
          const { data: rowData, error: rowErr } = await db.from('gyms').select('*').eq('slug', slug).maybeSingle();
          if (!rowErr && rowData) {
            gymData = rowData;
          }
        } catch (_) {}
      }
    }

    // Default tenant fallback ONLY for known primary Akash Fitness deployment
    if (!gymData) {
      if (slug === DEFAULT_GYM_SLUG) {
        gymData = {
          id: 4,
          slug: DEFAULT_GYM_SLUG,
          name: 'Akash fitness',
          is_active: true,
          status: 'ACTIVE',
          op_status: 'OPEN',
          owner_upi: 'Akash@897',
          owner_phone: '9044372343',
          pricing: { p1: 1200, p3: 3200, p6: 5800, p12: 10500 },
          notice_text: 'Regular timings in effect. Stay hydrated and hit your sets!',
          delayed_time: '5:00 PM',
          features: { workouts: true, nutrition: true, qr_attendance: true, notices: true }
        };
      } else {
        // Genuine unknown slug -> show tenant-not-found state
        state.ui.gatekeeperError = {
          title: 'Gym Station Not Found',
          message: '🏢 This gym station is not registered on the platform or has been decommissioned.',
          details: `Target Station: ${slug}`,
          type: 'notfound'
        };
        state.ui.isInitializing = false;
        renderApp();
        return false;
      }
    }

    if (gymData.is_active === false || gymData.status === 'INACTIVE' || gymData.status === 'SUSPENDED') {
      state.ui.gatekeeperError = {
        title: 'Service Suspended',
        message: '⚠️ Service Suspended. Please contact gym administration.',
        details: `Gym: ${gymData.name || gymData.gym_name || slug}`,
        type: 'suspended'
      };
      state.ui.isInitializing = false;
      renderApp();
      return false;
    }

    // Populate state.tenant
    const p = gymData.pricing || {};
    state.tenant = {
      id: gymData.id || 4,
      slug: gymData.slug || slug,
      name: gymData.name || gymData.gym_name || 'Akash fitness',
      tagline: gymData.tagline || gymData.gym_tagline || `${gymData.name || slug.toUpperCase()} • DIGITAL MEMBER HUD`,
      logo_url: gymData.logo_url || '',
      owner_upi: gymData.owner_upi_id || gymData.owner_upi || 'Akash@897',
      owner_phone: gymData.owner_phone || gymData.support_phone || '9044372343',
      status: gymData.op_status || gymData.status || 'OPEN',
      notice_text: gymData.notice_text || 'Regular timings in effect. Stay hydrated and hit your sets!',
      delayed_time: gymData.delayed_time || '5:00 PM',
      pricing: {
        p1: p.p1 || p.plan_1m_price || gymData.plan_1m_price || 1200,
        p3: p.p3 || p.plan_3m_price || gymData.plan_3m_price || 3200,
        p6: p.p6 || p.plan_6m_price || gymData.plan_6m_price || 5800,
        p12: p.p12 || p.plan_12m_price || gymData.plan_12m_price || 10500
      },
      features: gymData.features || { workouts: true, nutrition: true, qr_attendance: true, notices: true },
      updated_at: gymData.updated_at || new Date().toISOString()
    };

    localStorage.setItem(LAST_GYM_SLUG_KEY, state.tenant.slug);
    document.title = `${state.tenant.name} — Member HUD`;
    return true;
  }

  // --------------------------------------------------------------------------
  // 5. AUTHENTICATION & SESSION PERSISTENCE
  // --------------------------------------------------------------------------
  function loadPersistedSession() {
    try {
      const raw = localStorage.getItem(MEMBER_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.session_token || parsed.phone || parsed.full_name)) {
        // Ensure gym_slug is normalized
        if (parsed.gym_slug) {
          parsed.gym_slug = normalizeGymSlug(parsed.gym_slug);
        }
        return parsed;
      }
    } catch (_) {}
    return null;
  }

  function saveCanonicalSession(memberData) {
    if (!memberData) return;
    const sessionToken = memberData.session_token || state.session.session_token;
    const sessionObj = {
      id: memberData.member_id || memberData.id,
      member_id: memberData.member_id || memberData.id,
      gym_id: memberData.gym_id || state.tenant.id,
      gym_slug: normalizeGymSlug(memberData.gym_slug || state.tenant.slug),
      full_name: memberData.full_name || 'Athlete',
      phone: memberData.phone || '',
      normalized_phone: memberData.phone || memberData.normalized_phone || '',
      referral_code: memberData.referral_code || '',
      is_active: memberData.is_active !== false,
      valid_until: memberData.valid_until || null,
      days_remaining: memberData.days_remaining != null ? memberData.days_remaining : 30,
      plan_name: memberData.plan_name || 'VIP Member',
      membership_status: memberData.membership_status || 'ACTIVE',
      streak_count: Number(memberData.streak_count || 0),
      referral_count: Number(memberData.referral_count || 0),
      referral_free_days: Number(memberData.referral_free_days || 0),
      referral_money_saved: Number(memberData.referral_money_saved || 0),
      referrals: Array.isArray(memberData.referrals) ? memberData.referrals : [],
      session_token: sessionToken,
      session_expires_at: memberData.session_expires_at || null,
      saved_at: Date.now()
    };

    localStorage.setItem(MEMBER_SESSION_KEY, JSON.stringify(sessionObj));
    state.member = sessionObj;
    state.session.session_token = sessionToken;
    state.session.session_expires_at = sessionObj.session_expires_at;

    window.__nexusMemberSession = sessionObj;
    window.currentAthlete = sessionObj;
    return sessionObj;
  }

  async function refreshMemberSession() {
    const db = getSupabase();
    const token = state.session.session_token;
    const slug = state.tenant.slug;
    if (!db || !token || !slug) return;

    try {
      const { data, error } = await db.rpc('rpc_member_refresh_session', {
        p_gym_slug: slug,
        p_session_token: token
      });
      if (error) throw error;
      if (data && data.success) {
        saveCanonicalSession({ ...state.member, ...data });
        renderApp();
      }
    } catch (err) {
      if (/expired|not found|invalid/i.test(err?.message || '')) {
        handleLogout();
      }
    }
  }

  async function checkAttendanceStatus() {
    const db = getSupabase();
    const memberId = state.member?.id || state.member?.member_id;
    const token = state.session.session_token;
    const slug = state.tenant.slug;
    if (!db || !memberId || !token || !slug) return;

    // Fast check: inspect local date-keyed marker first
    const localLock = getLocalAttendanceLock(slug, memberId);
    if (localLock) {
      state.attendance = {
        checked_in_today: true,
        check_in_time: localLock.check_in_time,
        attendance_status: 'VERIFIED'
      };
    }

    try {
      const { data, error } = await db.rpc('rpc_member_attendance_status', {
        p_gym_slug: slug,
        p_member_id: memberId,
        p_session_token: token
      });
      if (!error && data && data.success) {
        const isCheckedIn = !!data.checked_in_today;
        const timeStr = data.check_in
          ? new Date(data.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : (localLock?.check_in_time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        state.attendance = {
          checked_in_today: isCheckedIn,
          check_in_time: isCheckedIn ? timeStr : null,
          attendance_status: isCheckedIn ? 'VERIFIED' : 'NOT_CHECKED_IN'
        };

        if (isCheckedIn) {
          setLocalAttendanceLock(slug, memberId, timeStr);
        } else {
          clearLocalAttendanceLock(slug, memberId);
        }
        renderApp();
      }
    } catch (_) {}
  }

  async function handlePhoneSubmit(phoneNumber) {
    const phone = cleanPhone(phoneNumber);
    if (phone.length !== 10) {
      playCyberChime('alert');
      showToast('Please enter a valid 10-digit mobile number.', 'error');
      return;
    }

    const db = getSupabase();
    if (!db) {
      showToast('Database connection offline.', 'error');
      return;
    }

    const btn = $('#nexus-btn-phone-submit');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>VERIFYING ROSTER...</span>`;
    }

    try {
      const { data, error } = await db.rpc('rpc_member_auth_start', {
        p_gym_slug: state.tenant.slug,
        p_phone: phone
      });
      if (error) throw error;
      if (!data || !data.success) {
        throw new Error(data?.error || 'Athlete not found on roster. Please register at reception.');
      }

      state.ui.pendingAuthMember = data;
      state.ui.authStep = 'pin';
      state.ui.pinDigits = ['', '', '', ''];
      playCyberChime('tap');
      renderApp();
      setTimeout(() => {
        const firstPin = $('.nexus-pin-digit');
        if (firstPin) firstPin.focus();
      }, 50);
    } catch (err) {
      playCyberChime('alert');
      showToast(err?.message || 'Unable to verify athlete phone.', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>VERIFY ATHLETE IDENTITY ⚡</span>`;
      }
    }
  }

  async function handlePinSubmit(pin) {
    if (String(pin).length !== 4) {
      playCyberChime('alert');
      showToast('Please enter all 4 digits of your PIN.', 'alert');
      return;
    }

    const pending = state.ui.pendingAuthMember;
    const slug = state.tenant.slug;
    const db = getSupabase();
    if (!pending || !db) return;

    try {
      let result;
      if (!pending.has_pin) {
        const { data: setData, error: setErr } = await db.rpc('rpc_member_set_pin', {
          p_gym_slug: slug,
          p_phone: pending.phone,
          p_pin: String(pin)
        });
        if (setErr) throw setErr;
        if (!setData?.success) throw new Error(setData?.error || 'Could not save PIN.');

        const { data: verData, error: verErr } = await db.rpc('rpc_member_verify_pin', {
          p_gym_slug: slug,
          p_phone: pending.phone,
          p_pin: String(pin)
        });
        if (verErr) throw verErr;
        result = verData;
        showToast('4-Digit Security PIN Created Successfully! 🔒', 'success');
      } else {
        const { data: verData, error: verErr } = await db.rpc('rpc_member_verify_pin', {
          p_gym_slug: slug,
          p_phone: pending.phone,
          p_pin: String(pin)
        });
        if (verErr) throw verErr;
        if (!verData?.success) throw new Error(verData?.error || 'Incorrect security PIN.');
        result = verData;
      }

      saveCanonicalSession({
        ...result,
        gym_id: pending.gym_id || state.tenant.id,
        gym_slug: slug
      });

      state.ui.pendingAuthMember = null;
      state.ui.authStep = 'phone';
      state.ui.pinDigits = ['', '', '', ''];

      playCyberChime('success');
      showToast(`Welcome back, ${state.member.full_name}! ⚡`, 'success');

      await checkAttendanceStatus();
      await refreshMemberSession();
      startRealtimeSubscriptions();
      renderApp();
    } catch (err) {
      playCyberChime('alert');
      showToast(err?.message || 'Authentication failed.', 'error');
      state.ui.pinDigits = ['', '', '', ''];
      renderApp();
    }
  }

  async function handleLogout() {
    const token = state.session.session_token;
    const db = getSupabase();
    if (token && db) {
      try {
        await db.rpc('rpc_member_logout', { p_session_token: token });
      } catch (_) {}
    }

    clearLocalAttendanceLock(state.tenant.slug, state.member?.id || state.member?.member_id);
    localStorage.removeItem(MEMBER_SESSION_KEY);
    state.member = null;
    state.session.session_token = null;
    state.session.session_expires_at = null;
    state.attendance = { checked_in_today: false, check_in_time: null, attendance_status: 'NOT_CHECKED_IN' };
    state.ui.drawerOpen = false;
    state.ui.authStep = 'phone';
    state.ui.pinDigits = ['', '', '', ''];

    stopRealtimeSubscriptions();
    playCyberChime('tap');
    showToast('Logged out successfully.', 'info');
    renderApp();
  }

  // --------------------------------------------------------------------------
  // 6. REALTIME SUBSCRIPTIONS & RECONCILIATION
  // --------------------------------------------------------------------------
  let activeGymChannel = null;
  let activeMemberChannel = null;

  async function digestHex(val) {
    try {
      if (globalThis.crypto?.subtle) {
        const bytes = new TextEncoder().encode(String(val));
        const digest = await crypto.subtle.digest('SHA-256', bytes);
        return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}
    return String(val);
  }

  async function startRealtimeSubscriptions() {
    const db = getSupabase();
    if (!db) return;

    stopRealtimeSubscriptions();

    try {
      // 1. Gym Tenant Live Channel (status, delayed_time, notices, pricing)
      const gymHash = await digestHex(state.tenant.id || 1);
      const gymTopic = `nexus:gym-sync:${gymHash}`;

      activeGymChannel = db.channel(gymTopic)
        .on('broadcast', { event: 'gym_sync' }, () => {
          fetchAndHydrateGym(state.tenant.slug).then(() => renderApp());
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'gyms', filter: `slug=eq.${state.tenant.slug}` }, (payload) => {
          if (payload.new) {
            fetchAndHydrateGym(state.tenant.slug).then(() => {
              showToast('⚡ Gym operational status updated live!', 'info');
              renderApp();
            });
          }
        })
        .subscribe();

      // 2. Member Live Channel (membership renewal, streak, validity)
      if (state.member?.id) {
        const memberHash = await digestHex(state.member.id);
        const memberTopic = `nexus:member-sync:${memberHash}`;

        activeMemberChannel = db.channel(memberTopic)
          .on('broadcast', { event: 'member_sync' }, () => {
            refreshMemberSession();
            checkAttendanceStatus();
          })
          .subscribe();
      }
    } catch (err) {
      console.warn('[NEXUS REALTIME] Subscription warning:', err);
    }
  }

  function stopRealtimeSubscriptions() {
    const db = getSupabase();
    if (!db) return;
    if (activeGymChannel) {
      try { db.removeChannel(activeGymChannel); } catch (_) {}
      activeGymChannel = null;
    }
    if (activeMemberChannel) {
      try { db.removeChannel(activeMemberChannel); } catch (_) {}
      activeMemberChannel = null;
    }
  }

  // --------------------------------------------------------------------------
  // 7. QR CODE ATTENDANCE CHECK-IN ENGINE
  // --------------------------------------------------------------------------
  async function openQRScanner() {
    if (!state.member?.id || !state.session.session_token) {
      showToast('Please authenticate to check in.', 'error');
      return;
    }

    const memberId = state.member?.id || state.member?.member_id;
    const slug = state.tenant.slug;

    // 1. Fast local check: if already verified today, do not open camera or request permission
    const localLock = getLocalAttendanceLock(slug, memberId);
    if (state.attendance.checked_in_today || localLock) {
      const timeStr = state.attendance.check_in_time || localLock?.check_in_time || 'Reception';
      state.attendance.checked_in_today = true;
      state.attendance.check_in_time = timeStr;
      state.attendance.attendance_status = 'VERIFIED';
      renderApp();
      playCyberChime('success');
      showToast(`✓ Attendance already verified today at ${timeStr}!`, 'success');
      return;
    }

    // 2. Authoritative check with rpc_member_attendance_status before opening camera
    const db = getSupabase();
    const token = state.session.session_token;

    if (!db || !token) {
      showToast('Session error. Please log in again.', 'error');
      return;
    }

    try {
      const { data, error } = await db.rpc('rpc_member_attendance_status', {
        p_gym_slug: slug,
        p_member_id: memberId,
        p_session_token: token
      });

      if (error) {
        showToast('Could not verify attendance status. Please try again.', 'error');
        return;
      }

      if (data && data.success && data.checked_in_today) {
        const timeStr = data.check_in
          ? new Date(data.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        state.attendance = {
          checked_in_today: true,
          check_in_time: timeStr,
          attendance_status: 'VERIFIED'
        };
        setLocalAttendanceLock(slug, memberId, timeStr);
        renderApp();
        playCyberChime('success');
        showToast(`✓ Attendance already verified today at ${timeStr}!`, 'success');
        return;
      }
    } catch (err) {
      showToast('Network error checking attendance. Please try again.', 'error');
      return;
    }

    // 3. If and only if checked_in_today === false, open the QR scanner modal
    state.ui.qrModalOpen = true;
    renderApp();

    setTimeout(() => {
      startCameraScanner();
    }, 100);
  }

  function closeQRScanner() {
    state.ui.qrModalOpen = false;
    stopCameraScanner();
    renderApp();
  }

  function startCameraScanner() {
    const readerEl = document.getElementById('nexus-qr-reader');
    if (!readerEl || !window.Html5Qrcode) return;

    stopCameraScanner();

    const scanner = new window.Html5Qrcode('nexus-qr-reader');
    state.ui.qrScannerInstance = scanner;

    const qrConfig = { fps: 15, qrbox: { width: 250, height: 250 } };
    scanner.start(
      { facingMode: 'environment' },
      qrConfig,
      async (decodedText) => {
        handleScannedQRCode(decodedText);
      },
      () => {}
    ).catch((err) => {
      console.warn('[NEXUS CAMERA] Camera error:', err);
      const feedback = $('#nexus-scanner-status-text');
      if (feedback) feedback.innerText = 'CAMERA ACCESS BLOCKED — TAP RETRY OR ALLOW PERMISSION';
    });
  }

  function stopCameraScanner() {
    if (state.ui.qrScannerInstance) {
      try {
        state.ui.qrScannerInstance.stop().then(() => {
          try { state.ui.qrScannerInstance.clear(); } catch (_) {}
          state.ui.qrScannerInstance = null;
        }).catch(() => {
          state.ui.qrScannerInstance = null;
        });
      } catch (_) {
        state.ui.qrScannerInstance = null;
      }
    }
  }

  async function handleScannedQRCode(qrToken) {
    stopCameraScanner();
    playCyberChime('tap');

    const db = getSupabase();
    const slug = state.tenant.slug;
    const memberId = state.member?.id || state.member?.member_id;
    const sessionToken = state.session.session_token;

    if (!db || !slug || !memberId || !sessionToken) {
      showToast('Session missing. Please log in again.', 'error');
      closeQRScanner();
      return;
    }

    try {
      const { data, error } = await db.rpc('rpc_member_check_in', {
        p_gym_slug: slug,
        p_member_id: memberId,
        p_session_token: sessionToken,
        p_qr_token: qrToken || `AUTH_DESK_QR_${slug}_2026`
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Attendance punch rejected.');

      const timeStr = data.check_in
        ? new Date(data.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      state.attendance = {
        checked_in_today: true,
        check_in_time: timeStr,
        attendance_status: 'VERIFIED'
      };

      setLocalAttendanceLock(slug, memberId, timeStr);

      if (data.streak_count != null) {
        state.member.streak_count = Number(data.streak_count);
        saveCanonicalSession(state.member);
      }

      closeQRScanner();
      playCyberChime('success');
      showToast(data.status === 'ALREADY_CHECKED_IN' ? '✓ Attendance already verified today!' : '✓ Reception Desk QR Attendance Verified! 🔥', 'success');
      renderApp();
    } catch (err) {
      playCyberChime('alert');
      showToast('Attendance verification failed: ' + (err?.message || err), 'error');
      closeQRScanner();
    }
  }

  // --------------------------------------------------------------------------
  // 8. RENEWAL & UPI INTENT ENGINE
  // --------------------------------------------------------------------------
  function openRenewModal() {
    state.ui.drawerOpen = false;
    state.ui.renewModalOpen = true;
    playCyberChime('tap');
    renderApp();
  }

  function closeRenewModal() {
    state.ui.renewModalOpen = false;
    playCyberChime('tap');
    renderApp();
  }

  function selectRenewalPlan(months) {
    state.ui.selectedRenewalMonths = months;
    playCyberChime('tap');
    renderApp();
  }

  function getSelectedRenewalPrice() {
    const m = state.ui.selectedRenewalMonths;
    const p = state.tenant.pricing;
    if (m === 3) return p.p3 || 3200;
    if (m === 6) return p.p6 || 5800;
    if (m === 12) return p.p12 || 10500;
    return p.p1 || 1200;
  }

  function executeUPIPayment() {
    playCyberChime('tap');
    const price = getSelectedRenewalPrice();
    const upiId = state.tenant.owner_upi || 'gymowner@okhdfcbank';
    const gymName = state.tenant.name || 'Akash Fitness';
    const memberName = state.member?.full_name || 'Athlete';
    const note = encodeURIComponent(`${memberName} ${state.ui.selectedRenewalMonths}M Pass Renewal`);
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(gymName)}&am=${price}&cu=INR&tn=${note}`;

    window.location.href = upiUri;
    showToast(`Launching UPI payment for ₹${price.toLocaleString('en-IN')}...`, 'success');
  }

  function copyGymUPI() {
    playCyberChime('tap');
    const upiId = state.tenant.owner_upi || 'gymowner@okhdfcbank';
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(upiId).then(() => {
        showToast(`Copied UPI ID: ${upiId} 📋`, 'success');
      }).catch(() => {
        showToast(`UPI ID: ${upiId}`, 'info');
      });
    } else {
      showToast(`UPI ID: ${upiId}`, 'info');
    }
  }

  // --------------------------------------------------------------------------
  // 9. PWA INSTALLATION ENGINE
  // --------------------------------------------------------------------------
  let deferredInstallPrompt = null;
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      showToast('✓ Akash Fitness App installed successfully!', 'success');
    });
  }

  function triggerPWAInstall() {
    state.ui.drawerOpen = false;
    playCyberChime('tap');

    // Check if already in standalone PWA mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator).standalone === true;
    if (isStandalone) {
      showToast('✓ App is already installed and running in Standalone Mode!', 'success');
      return;
    }

    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
          showToast('✓ Installing Akash Fitness App...', 'success');
        }
        deferredInstallPrompt = null;
      });
    } else {
      // Show iOS Safari / Chrome step-by-step guidance modal
      state.ui.installModalOpen = true;
      renderApp();
    }
  }

  function closeInstallModal() {
    state.ui.installModalOpen = false;
    playCyberChime('tap');
    renderApp();
  }

  // --------------------------------------------------------------------------
  // 10. SOCIAL / WHATSAPP / REFERRAL ACTIONS
  // --------------------------------------------------------------------------
  function openGymConcierge() {
    state.ui.drawerOpen = false;
    playCyberChime('tap');
    const phone = cleanPhone(state.tenant.owner_phone || '8467895365');
    const name = state.member?.full_name || 'Athlete';
    const memPhone = cleanPhone(state.member?.phone || '');
    const text = encodeURIComponent(`Hi ${state.tenant.name}, I am ${name} (+91 ${memPhone}). I need assistance regarding my VIP membership pass.`);
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
  }

  function shareReferralWhatsApp() {
    playCyberChime('tap');
    const code = state.member?.referral_code || cleanPhone(state.member?.phone || '') || 'NEXUS';
    const gymName = state.tenant.name || 'Akash Fitness';
    const url = window.location.origin + window.location.pathname + `?gym=${state.tenant.slug}`;
    const text = encodeURIComponent(`⚡ Join me at ${gymName}! Use my VIP invite code *${code}* when registering to get bonus membership days.\n\nOpen digital pass here: ${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  function copyReferralCode() {
    playCyberChime('tap');
    const code = state.member?.referral_code || cleanPhone(state.member?.phone || '') || 'NEXUS';
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Copied Referral Code: ${code} 📋`, 'success');
      });
    } else {
      showToast(`Referral Code: ${code}`, 'info');
    }
  }

  // --------------------------------------------------------------------------
  // 11. CSS STYLES (SINGLE CANONICAL STYLESHEET)
  // --------------------------------------------------------------------------
  const CANONICAL_CSS = `
:root {
  --volt: #CCFF00;
  --matrix: #00FF66;
  --gold: #FFB800;
  --crimson: #FF3366;
  --cyan: #00F0FF;
  --void: #070809;
  --card: #10121a;
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}
html, body {
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  min-height: 100% !important;
  background-color: var(--void) !important;
  color: #f4f4f5 !important;
  font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif !important;
  -webkit-tap-highlight-color: transparent !important;
  overflow-x: hidden !important;
}
#nexus-app-root {
  min-height: 100dvh;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  position: relative;
  box-sizing: border-box;
  padding-top: max(8px, var(--safe-top));
  padding-bottom: calc(84px + var(--safe-bottom));
  padding-left: 14px;
  padding-right: 14px;
}
.holo-foil-beam {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background: linear-gradient(115deg, transparent 35%, rgba(204, 255, 0, 0.08) 45%, rgba(0, 240, 255, 0.15) 50%, rgba(255, 184, 0, 0.12) 55%, transparent 65%);
  pointer-events: none;
}
@keyframes foilSheen {
  0% { transform: translateX(-150%) rotate(25deg); }
  100% { transform: translateX(250%) rotate(25deg); }
}
.animate-foil-sheen {
  animation: foilSheen 4s ease-in-out infinite;
}
@keyframes laserScan {
  0% { top: 6%; opacity: 0.8; }
  50% { top: 92%; opacity: 1; }
  100% { top: 6%; opacity: 0.8; }
}
.laser-scan-beam {
  position: absolute;
  left: 6%;
  right: 6%;
  height: 3px;
  background: linear-gradient(90deg, transparent, #00FF66, #CCFF00, #00FF66, transparent);
  box-shadow: 0 0 15px #00FF66, 0 0 8px #CCFF00;
  animation: laserScan 2.2s ease-in-out infinite;
  z-index: 25;
  pointer-events: none;
}
#nexus-qr-reader {
  border: none !important;
}
#nexus-qr-reader video {
  object-fit: cover !important;
  border-radius: 1.25rem !important;
  width: 100% !important;
  height: 100% !important;
}
#nexus-qr-reader__scan_region {
  border-radius: 1.25rem;
}
`;

  function ensureStyles() {
    let styleEl = document.getElementById('nexus-canonical-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'nexus-canonical-css';
      styleEl.textContent = CANONICAL_CSS;
      document.head.appendChild(styleEl);
    }
  }

  // --------------------------------------------------------------------------
  // 12. CANONICAL PRESENTATION RENDER ENGINE
  // --------------------------------------------------------------------------
  function renderApp() {
    ensureStyles();

    let root = document.getElementById('nexus-app-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'nexus-app-root';
      document.body.appendChild(root);
    }

    // A. INITIALIZING / LOADING SCREEN
    if (state.ui.isInitializing) {
      root.innerHTML = `
        <div class="min-h-[85vh] flex flex-col items-center justify-center text-center p-6 space-y-5">
          <div class="w-16 h-16 rounded-3xl bg-cyberVolt/20 border border-cyberVolt/50 text-cyberVolt flex items-center justify-center font-brand font-extrabold text-2xl shadow-glow-volt animate-pulse">
            ⚡
          </div>
          <div class="space-y-1">
            <h2 class="font-brand text-2xl font-bold text-white tracking-wider uppercase">${esc(state.tenant.name)}</h2>
            <p class="font-mono text-xs text-cyberVolt">CONNECTING ATHLETE CYBER TERMINAL...</p>
          </div>
        </div>
      `;
      return;
    }

    // B. GATEKEEPER ERROR SCREEN
    if (state.ui.gatekeeperError) {
      const err = state.ui.gatekeeperError;
      root.innerHTML = `
        <div class="min-h-[85vh] flex flex-col items-center justify-center text-center p-6 space-y-6">
          <div class="w-16 h-16 rounded-3xl bg-crimsonAlert/20 border border-crimsonAlert/50 text-crimsonAlert flex items-center justify-center font-brand text-2xl shadow-glow-crimson">
            ⚠️
          </div>
          <div class="space-y-2">
            <h2 class="font-brand text-2xl font-bold text-white uppercase">${esc(err.title)}</h2>
            <p class="text-sm text-zinc-300 max-w-xs mx-auto">${esc(err.message)}</p>
            ${err.details ? `<p class="font-mono text-xs text-zinc-500">${esc(err.details)}</p>` : ''}
          </div>
          <button type="button" onclick="location.href='?gym=akash-fitness-2343'" class="px-6 py-3.5 bg-cyberVolt text-black font-brand font-extrabold text-sm rounded-2xl shadow-glow-volt uppercase cursor-pointer hover:brightness-110 active:scale-95 transition-all">
            LAUNCH DEFAULT STATION ⚡
          </button>
        </div>
      `;
      return;
    }

    // C. AUTHENTICATION REQUIRED SCREEN
    if (!state.member || !state.session.session_token) {
      renderAuthScreen(root);
      return;
    }

    // D. CANONICAL MEMBER PORTAL / HUD
    renderMemberHUD(root);
  }

  // --------------------------------------------------------------------------
  // 12A. AUTHENTICATION SCREEN
  // --------------------------------------------------------------------------
  function renderAuthScreen(root) {
    const t = state.tenant;
    const isPinStep = state.ui.authStep === 'pin';
    const pending = state.ui.pendingAuthMember;

    root.innerHTML = `
      <div class="min-h-[90vh] flex flex-col items-center justify-center py-6 px-1">
        <div class="w-full bg-surfaceCard/95 rounded-3xl border border-cyberVolt/30 p-6 sm:p-7 shadow-glass-card relative overflow-hidden space-y-6">
          
          <!-- Cyber Glow Background -->
          <div class="absolute -top-20 -right-20 w-44 h-44 bg-cyberVolt/15 rounded-full blur-3xl pointer-events-none"></div>
          <div class="absolute -bottom-20 -left-20 w-44 h-44 bg-cyanCyber/15 rounded-full blur-3xl pointer-events-none"></div>

          <!-- Auth Branding -->
          <div class="text-center space-y-2 relative z-10">
            <div class="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-cyberVolt/20 via-cyanCyber/10 to-transparent border border-cyberVolt/40 text-cyberVolt mb-1 shadow-glow-volt">
              <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 5v14M18 5v14M3 9v6M21 9v6M6 12h12" />
              </svg>
            </div>
            <h1 class="font-brand text-3xl font-extrabold tracking-tight text-white leading-none">${esc(t.name)}</h1>
            <p class="font-mono text-xs tracking-wider uppercase text-cyberVolt">ATHLETE CYBER HUD TERMINAL</p>
          </div>

          ${!isPinStep ? `
            <!-- STEP 1: PHONE NUMBER INPUT -->
            <div class="space-y-4 relative z-10">
              <div>
                <label class="block font-mono text-[11px] uppercase tracking-wider text-zinc-400 mb-1.5">Registered 10-Digit Mobile Number</label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-xs text-cyberVolt font-bold">+91</span>
                  <input 
                    type="tel" 
                    id="nexus-phone-input" 
                    maxlength="10" 
                    placeholder="9876543210"
                    class="w-full bg-black/60 border border-white/15 focus:border-cyberVolt rounded-2xl py-3.5 pl-14 pr-4 font-mono text-base text-white tracking-widest outline-none transition-all"
                    inputmode="numeric"
                  />
                </div>
              </div>

              <button 
                type="button"
                id="nexus-btn-phone-submit"
                class="w-full py-4 bg-gradient-to-r from-cyberVolt via-[#d8ff33] to-matrixGreen text-black font-brand font-extrabold text-base tracking-wider rounded-2xl shadow-glow-volt hover:brightness-110 active:scale-95 transition-all uppercase cursor-pointer"
              >
                VERIFY ATHLETE IDENTITY ⚡
              </button>
            </div>
          ` : `
            <!-- STEP 2: 4-DIGIT PIN SECURITY CHECK -->
            <div class="space-y-5 relative z-10">
              <div class="text-center space-y-1">
                <h3 class="font-brand text-xl text-white tracking-wide">
                  ${pending?.has_pin ? 'ENTER 4-DIGIT SECURITY PIN' : 'CREATE 4-DIGIT PASSKEY PIN'}
                </h3>
                <p class="font-mono text-[11px] text-zinc-400">
                  ${pending?.has_pin ? `Welcome back, ${esc(pending.full_name)}!` : 'Set your personal security passkey PIN'}
                </p>
              </div>

              <div class="flex justify-center gap-3">
                ${[0, 1, 2, 3].map((i) => `
                  <input 
                    type="password" 
                    maxlength="1" 
                    data-index="${i}"
                    class="nexus-pin-digit w-12 h-14 bg-black/70 border border-white/20 focus:border-cyberVolt text-center font-mono text-2xl text-cyberVolt rounded-2xl outline-none shadow-inner transition-all"
                    inputmode="numeric"
                    value="${state.ui.pinDigits[i] || ''}"
                  />
                `).join('')}
              </div>

              <!-- Virtual Keypad (0-9) -->
              <div class="grid grid-cols-3 gap-2 max-w-[260px] mx-auto pt-2">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `
                  <button type="button" data-key="${n}" class="nexus-keypad-btn py-3.5 rounded-2xl bg-surfaceMuted/80 hover:bg-white/10 active:scale-95 border border-white/10 font-mono text-lg font-bold text-white transition-all cursor-pointer">
                    ${n}
                  </button>
                `).join('')}
                <button type="button" data-key="back" class="nexus-keypad-btn py-3.5 rounded-2xl bg-surfaceMuted/80 hover:bg-white/10 active:scale-95 border border-white/10 font-mono text-xs font-bold text-zinc-400 transition-all cursor-pointer">
                  ⌫
                </button>
                <button type="button" data-key="0" class="nexus-keypad-btn py-3.5 rounded-2xl bg-surfaceMuted/80 hover:bg-white/10 active:scale-95 border border-white/10 font-mono text-lg font-bold text-white transition-all cursor-pointer">
                  0
                </button>
                <button type="button" data-key="submit" class="nexus-keypad-btn py-3.5 rounded-2xl bg-cyberVolt hover:brightness-110 active:scale-95 text-black font-mono text-sm font-bold shadow-glow-volt transition-all cursor-pointer">
                  ➔
                </button>
              </div>

              <div class="text-center pt-2">
                <button type="button" id="nexus-btn-auth-back" class="font-mono text-xs text-zinc-400 hover:text-white underline cursor-pointer">
                  ← Use different phone number
                </button>
              </div>
            </div>
          `}
        </div>
      </div>
    `;

    // Bind auth events
    const phoneInput = $('#nexus-phone-input');
    const phoneSubmit = $('#nexus-btn-phone-submit');
    if (phoneSubmit && phoneInput) {
      phoneSubmit.addEventListener('click', () => handlePhoneSubmit(phoneInput.value));
      phoneInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handlePhoneSubmit(phoneInput.value);
      });
    }

    const backBtn = $('#nexus-btn-auth-back');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        state.ui.authStep = 'phone';
        state.ui.pinDigits = ['', '', '', ''];
        renderApp();
      });
    }

    const pinInputs = $$('.nexus-pin-digit');
    pinInputs.forEach((input, idx) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '').slice(-1);
        state.ui.pinDigits[idx] = val;
        e.target.value = val;
        if (val && idx < 3) {
          pinInputs[idx + 1].focus();
        }
        if (state.ui.pinDigits.every((d) => d.length === 1)) {
          handlePinSubmit(state.ui.pinDigits.join(''));
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && idx > 0) {
          pinInputs[idx - 1].focus();
        }
      });
    });

    const keyBtns = $$('.nexus-keypad-btn');
    keyBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.key;
        if (key === 'back') {
          for (let i = 3; i >= 0; i--) {
            if (state.ui.pinDigits[i]) {
              state.ui.pinDigits[i] = '';
              break;
            }
          }
        } else if (key === 'submit') {
          if (state.ui.pinDigits.every((d) => d.length === 1)) {
            handlePinSubmit(state.ui.pinDigits.join(''));
          } else {
            showToast('Enter all 4 digits of your PIN.', 'alert');
          }
        } else {
          for (let i = 0; i < 4; i++) {
            if (!state.ui.pinDigits[i]) {
              state.ui.pinDigits[i] = key;
              break;
            }
          }
        }
        renderApp();
        if (state.ui.pinDigits.every((d) => d.length === 1)) {
          handlePinSubmit(state.ui.pinDigits.join(''));
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 12B. CANONICAL MEMBER HUD
  // --------------------------------------------------------------------------
  function renderMemberHUD(root) {
    const t = state.tenant;
    const m = state.member;
    const att = state.attendance;
    const activeTab = state.ui.activeTab;

    const initials = (m.full_name || 'A').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase() || 'A';
    const phoneDisplay = m.phone ? `+91 ${cleanPhone(m.phone)}` : '—';
    const memberId = m.phone ? `RT-${cleanPhone(m.phone)}` : 'RT-MEMBER';
    const daysLeft = m.days_remaining != null ? String(m.days_remaining) : '30';
    const validUntilDate = m.valid_until ? (isNaN(new Date(m.valid_until).getTime()) ? String(m.valid_until) : new Date(m.valid_until).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).toUpperCase()) : '1 OCT 2026';

    root.innerHTML = `
      <!-- TOP STATUS & BRANDING HEADER -->
      <header class="flex items-center justify-between py-2 mb-2">
        <div class="flex items-center gap-2.5">
          <button 
            type="button" 
            id="nexus-btn-open-drawer"
            class="w-11 h-11 rounded-2xl bg-surfaceCard border border-white/15 hover:border-cyberVolt/40 flex items-center justify-center text-white active:scale-95 transition-all cursor-pointer shadow-lg"
            aria-label="Open Navigation Menu"
          >
            <svg class="w-5 h-5 text-cyberVolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          <div class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-xl bg-cyberVolt/20 border border-cyberVolt/40 text-cyberVolt flex items-center justify-center font-brand font-bold text-xs shadow-glow-volt overflow-hidden shrink-0">
              ${t.logo_url ? `<img src="${esc(t.logo_url)}" alt="${esc(t.name)}" class="w-full h-full object-cover" referrerpolicy="no-referrer" />` : 'AF'}
            </div>
            <div>
              <div class="flex items-center gap-1.5">
                <span class="font-brand text-lg font-extrabold text-white tracking-tight leading-none">${esc(t.name)}</span>
                <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyberVolt/15 text-cyberVolt border border-cyberVolt/30 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-cyberVolt animate-pulse"></span> VIP
                </span>
              </div>
              <p class="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">CYBER HUD PASS</p>
            </div>
          </div>
        </div>

        <button 
          type="button" 
          id="nexus-btn-user-avatar"
          class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyberVolt/20 to-cyanCyber/20 border border-cyberVolt/40 text-cyberVolt font-brand font-bold text-sm flex items-center justify-center shadow-glow-volt cursor-pointer active:scale-95 transition-all"
        >
          ${esc(initials)}
        </button>
      </header>

      <!-- MAIN TAB CONTENT CONTAINER -->
      <main class="space-y-4">
        
        <!-- TAB 1: HOME -->
        <div id="nexus-tab-home" class="${activeTab === 'home' ? 'block' : 'hidden'} space-y-4">
          
          <!-- LIVE GYM OPERATIONAL STATUS BANNER (DELAYED / CLOSED / HOLIDAY) -->
          ${renderLiveOperationsBanner()}

          <!-- HOLOGRAPHIC VIP PASS CARD -->
          <div class="p-[1.5px] rounded-3xl bg-gradient-to-tr from-cyberVolt via-cyanCyber to-moltenGold shadow-glass-card relative overflow-hidden">
            <div class="holo-foil-beam animate-foil-sheen"></div>
            <div class="bg-surfaceCard/95 rounded-[22px] p-5 relative z-10 backdrop-blur-xl space-y-4">
              
              <div class="flex items-start justify-between">
                <div>
                  <span class="text-[10px] font-mono font-bold uppercase tracking-widest text-cyberVolt block mb-1">NEXUS DIGITAL PASS</span>
                  <h2 class="font-brand text-2xl font-extrabold text-white tracking-wide">${esc(m.full_name)}</h2>
                  <p class="font-mono text-xs text-zinc-400 tracking-wider">${esc(phoneDisplay)}</p>
                </div>
                <div class="w-10 h-10 rounded-2xl bg-black/60 border border-cyberVolt/40 flex items-center justify-center text-cyberVolt font-brand font-extrabold text-base shadow-glow-volt">
                  ${esc(initials[0] || 'A')}
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3 py-3 border-y border-white/10 font-mono text-xs">
                <div>
                  <span class="text-[10px] text-zinc-400 block uppercase">VALID UNTIL</span>
                  <strong class="text-white text-sm font-bold">${esc(validUntilDate)}</strong>
                </div>
                <div>
                  <span class="text-[10px] text-zinc-400 block uppercase">DAYS REMAINING</span>
                  <strong class="text-cyberVolt text-sm font-bold">${esc(daysLeft)} DAYS</strong>
                </div>
              </div>

              <div class="flex items-center justify-between font-mono text-[11px] text-zinc-400 pt-1">
                <span class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full bg-matrixGreen animate-pulse"></span>
                  <span class="text-matrixGreen font-bold">${esc(m.membership_status || 'ACTIVE')}</span>
                </span>
                <span class="tracking-wider text-zinc-400">${esc(memberId)}</span>
              </div>

            </div>
          </div>

          <!-- CHECK-IN / ATTENDANCE CTA -->
          <button 
            type="button" 
            id="nexus-btn-checkin-cta"
            class="w-full py-4 px-4 ${att.checked_in_today ? 'bg-gradient-to-r from-emerald-500 via-matrixGreen to-cyberVolt text-black shadow-glow-green cursor-default' : 'bg-gradient-to-r from-matrixGreen via-[#33ff88] to-cyberVolt text-black shadow-glow-green hover:brightness-110 active:scale-95 cursor-pointer'} font-brand font-extrabold text-base tracking-wider rounded-2xl uppercase flex items-center justify-center gap-2 transition-all"
          >
            ${att.checked_in_today ? `
              <span>✓</span>
              <span>ATTENDANCE VERIFIED TODAY (${esc(att.check_in_time || 'Recorded')})</span>
            ` : `
              <span>▣</span>
              <span>CHECK IN AT THE GYM ϟ</span>
            `}
          </button>

          <!-- 3-ACTION BUTTONS (RENEW PASS, GYM CONCIERGE, INSTALL APP) -->
          <div class="grid grid-cols-3 gap-2">
            <button 
              type="button" 
              id="nexus-btn-renew-action"
              class="p-3 rounded-2xl bg-surfaceCard border border-white/10 hover:border-moltenGold/50 text-left transition-all cursor-pointer active:scale-95"
            >
              <span class="text-lg block mb-1">⟳</span>
              <strong class="font-brand text-xs font-bold text-white block leading-tight">Renew Pass</strong>
              <span class="text-[9px] font-mono text-moltenGold block">UPI • INSTANT</span>
            </button>

            <button 
              type="button" 
              id="nexus-btn-concierge-action"
              class="p-3 rounded-2xl bg-surfaceCard border border-white/10 hover:border-matrixGreen/50 text-left transition-all cursor-pointer active:scale-95"
            >
              <span class="text-lg block mb-1">💬</span>
              <strong class="font-brand text-xs font-bold text-white block leading-tight">Concierge</strong>
              <span class="text-[9px] font-mono text-matrixGreen block">WHATSAPP</span>
            </button>

            <button 
              type="button" 
              id="nexus-btn-install-action"
              class="p-3 rounded-2xl bg-surfaceCard border border-white/10 hover:border-cyanCyber/50 text-left transition-all cursor-pointer active:scale-95"
            >
              <span class="text-lg block mb-1">⇩</span>
              <strong class="font-brand text-xs font-bold text-white block leading-tight">Install App</strong>
              <span class="text-[9px] font-mono text-cyanCyber block">ADD TO HOME</span>
            </button>
          </div>

          <!-- TODAY'S PLAN / WORKOUT SECTION -->
          <div class="space-y-2">
            <div class="flex items-center justify-between px-1">
              <h3 class="font-brand text-xs uppercase tracking-wider text-zinc-400">TODAY'S PLAN</h3>
              <span class="text-[10px] font-mono text-matrixGreen font-bold flex items-center gap-1">
                <span class="w-1.5 h-1.5 rounded-full bg-matrixGreen animate-pulse"></span> LIVE
              </span>
            </div>

            <div class="p-4 rounded-2xl bg-surfaceCard border border-white/10 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <span class="text-2xl">💪</span>
                <div>
                  <strong class="font-brand text-sm font-bold text-white block">PUSH FOCUS</strong>
                  <span class="text-[11px] font-mono text-zinc-400">CHEST • SHOULDERS • TRICEPS</span>
                </div>
              </div>
              <span class="text-zinc-500 text-lg">›</span>
            </div>

            <div class="p-4 rounded-2xl bg-surfaceCard border border-white/10 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <span class="text-2xl">🔥</span>
                <div>
                  <strong class="font-brand text-sm font-bold text-white block">STREAK: ${esc(m.streak_count || 0)} DAYS</strong>
                  <span class="text-[11px] font-mono text-zinc-400">PUNCH DAILY AT RECEPTION DESK</span>
                </div>
              </div>
              <span class="text-zinc-500 text-lg">›</span>
            </div>
          </div>

        </div>

        <!-- TAB 2: PROGRESS -->
        <div id="nexus-tab-progress" class="${activeTab === 'progress' ? 'block' : 'hidden'} space-y-4">
          <div class="flex items-center gap-2 pb-2">
            <button type="button" class="nexus-back-home w-8 h-8 rounded-xl bg-surfaceMuted flex items-center justify-center text-white cursor-pointer">‹</button>
            <h2 class="font-brand text-lg font-bold text-white">ATHLETE PROGRESS</h2>
          </div>

          <div class="grid grid-cols-3 gap-2 text-center font-mono">
            <div class="p-3.5 rounded-2xl bg-surfaceCard border border-white/10">
              <strong class="font-brand text-xl text-cyberVolt block">${esc(daysLeft)}</strong>
              <span class="text-[9px] text-zinc-400 uppercase">DAYS LEFT</span>
            </div>
            <div class="p-3.5 rounded-2xl bg-surfaceCard border border-white/10">
              <strong class="font-brand text-xl text-matrixGreen block">${esc(m.streak_count || 0)}</strong>
              <span class="text-[9px] text-zinc-400 uppercase">DAY STREAK</span>
            </div>
            <div class="p-3.5 rounded-2xl bg-surfaceCard border border-white/10">
              <strong class="font-brand text-xl text-cyanCyber block">100%</strong>
              <span class="text-[9px] text-zinc-400 uppercase">VIP ACCESS</span>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-surfaceCard border border-white/10 space-y-2">
            <strong class="font-brand text-sm text-white block">Attendance History & Streak</strong>
            <p class="text-xs text-zinc-400 leading-relaxed">
              Every verified check-in at the Akash Fitness reception desk updates your training streak in real time.
            </p>
          </div>
        </div>

        <!-- TAB 3: REFERRAL SQUAD -->
        <div id="nexus-tab-referral" class="${activeTab === 'referral' ? 'block' : 'hidden'} space-y-4">
          <div class="flex items-center gap-2 pb-2">
            <button type="button" class="nexus-back-home w-8 h-8 rounded-xl bg-surfaceMuted flex items-center justify-center text-white cursor-pointer">‹</button>
            <h2 class="font-brand text-lg font-bold text-white">REFERRAL SQUAD</h2>
          </div>

          <div class="p-5 rounded-3xl bg-surfaceCard border border-cyberVolt/30 space-y-4 text-center">
            <span class="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">INVITE FRIENDS & EARN FREE DAYS</span>
            <div class="p-3.5 bg-black/60 rounded-2xl border border-cyberVolt/40 font-mono text-xl font-extrabold text-cyberVolt tracking-widest cursor-pointer select-all" id="nexus-referral-code-box">
              ${esc(m.referral_code || cleanPhone(m.phone) || 'NEXUS')}
            </div>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" id="nexus-btn-share-referral" class="py-3 bg-matrixGreen text-black font-brand font-bold text-xs rounded-xl uppercase hover:brightness-110 active:scale-95 transition-all cursor-pointer">
                SHARE WHATSAPP 🚀
              </button>
              <button type="button" id="nexus-btn-copy-referral" class="py-3 bg-surfaceMuted border border-white/15 text-white font-mono text-xs rounded-xl uppercase hover:bg-white/10 active:scale-95 transition-all cursor-pointer">
                COPY CODE 📋
              </button>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-surfaceCard border border-white/10 space-y-2">
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="text-zinc-400">Total Friends Credited:</span>
              <strong class="text-cyberVolt font-bold">${esc(m.referral_count || 0)} Athletes</strong>
            </div>
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="text-zinc-400">Bonus Days Earned:</span>
              <strong class="text-matrixGreen font-bold">+${esc(m.referral_free_days || (m.referral_count || 0) * 7)} Days</strong>
            </div>
          </div>
        </div>

        <!-- TAB 4: NUTRITION -->
        <div id="nexus-tab-nutrition" class="${activeTab === 'nutrition' ? 'block' : 'hidden'} space-y-4">
          <div class="flex items-center gap-2 pb-2">
            <button type="button" class="nexus-back-home w-8 h-8 rounded-xl bg-surfaceMuted flex items-center justify-center text-white cursor-pointer">‹</button>
            <h2 class="font-brand text-lg font-bold text-white">NUTRITION GUIDELINES</h2>
          </div>

          <div class="p-4 rounded-2xl bg-surfaceCard border border-white/10 flex items-center gap-3">
            <span class="text-2xl">🥣</span>
            <div>
              <strong class="font-brand text-sm text-white block">Breakfast Fuel</strong>
              <span class="text-xs text-zinc-400">High protein oats + 4 egg whites + almonds</span>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-surfaceCard border border-white/10 flex items-center gap-3">
            <span class="text-2xl">🍛</span>
            <div>
              <strong class="font-brand text-sm text-white block">Power Lunch</strong>
              <span class="text-xs text-zinc-400">200g grilled chicken / paneer + brown rice + dal</span>
            </div>
          </div>

          <div class="p-4 rounded-2xl bg-surfaceCard border border-white/10 flex items-center gap-3">
            <span class="text-2xl">🥗</span>
            <div>
              <strong class="font-brand text-sm text-white block">Post-Workout Recovery</strong>
              <span class="text-xs text-zinc-400">1 scoop whey protein + 1 banana within 30 min</span>
            </div>
          </div>
        </div>

        <!-- TAB 5: PASS (DIGITAL ACCESS KEY) -->
        <div id="nexus-tab-pass" class="${activeTab === 'pass' ? 'block' : 'hidden'} space-y-4">
          <div class="flex items-center gap-2 pb-2">
            <button type="button" class="nexus-back-home w-8 h-8 rounded-xl bg-surfaceMuted flex items-center justify-center text-white cursor-pointer">‹</button>
            <h2 class="font-brand text-lg font-bold text-white">MEMBERSHIP PASS</h2>
          </div>

          <div class="p-5 rounded-3xl bg-surfaceCard border border-cyberVolt/40 space-y-4">
            <span class="text-[10px] font-mono text-cyberVolt uppercase tracking-widest block">DIGITAL ACCESS KEY</span>
            <div>
              <h3 class="font-brand text-2xl font-bold text-white">${esc(m.full_name)}</h3>
              <p class="font-mono text-xs text-zinc-400">${esc(phoneDisplay)}</p>
            </div>
            <div class="flex items-center justify-between font-mono text-xs border-t border-white/10 pt-3">
              <span class="text-zinc-400">VALID UNTIL</span>
              <strong class="text-white">${esc(validUntilDate)}</strong>
            </div>
          </div>

          <button type="button" id="nexus-btn-pass-renew" class="w-full py-4 bg-gradient-to-r from-moltenGold via-[#ffc837] to-cyberVolt text-black font-brand font-extrabold text-sm rounded-2xl shadow-glow-gold uppercase cursor-pointer hover:brightness-110 active:scale-95 transition-all">
            RENEW MEMBERSHIP NOW ⚡
          </button>
        </div>

      </main>

      <!-- FIXED BOTTOM NAVIGATION BAR -->
      <nav class="fixed bottom-0 left-0 right-0 z-40 bg-black/90 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom,0px)]">
        <div class="max-w-[480px] mx-auto grid grid-cols-5 h-16 items-center px-2">
          
          <button type="button" data-nav="home" class="nexus-nav-btn flex flex-col items-center justify-center gap-1 ${activeTab === 'home' ? 'text-cyberVolt' : 'text-zinc-400 hover:text-white'} font-mono text-[10px] transition-colors cursor-pointer">
            <span class="text-lg leading-none">⌂</span>
            <span>HOME</span>
          </button>

          <button type="button" data-nav="progress" class="nexus-nav-btn flex flex-col items-center justify-center gap-1 ${activeTab === 'progress' ? 'text-cyberVolt' : 'text-zinc-400 hover:text-white'} font-mono text-[10px] transition-colors cursor-pointer">
            <span class="text-lg leading-none">↗</span>
            <span>PROGRESS</span>
          </button>

          <button type="button" data-nav="checkin" class="nexus-nav-btn flex flex-col items-center justify-center gap-1 text-cyberVolt font-mono text-[10px] cursor-pointer">
            <span class="w-9 h-9 rounded-2xl bg-cyberVolt/20 border border-cyberVolt text-cyberVolt flex items-center justify-center font-bold text-sm shadow-glow-volt">▣</span>
            <span>CHECK-IN</span>
          </button>

          <button type="button" data-nav="referral" class="nexus-nav-btn flex flex-col items-center justify-center gap-1 ${activeTab === 'referral' ? 'text-cyberVolt' : 'text-zinc-400 hover:text-white'} font-mono text-[10px] transition-colors cursor-pointer">
            <span class="text-lg leading-none">👥</span>
            <span>REFERRAL</span>
          </button>

          <button type="button" data-nav="nutrition" class="nexus-nav-btn flex flex-col items-center justify-center gap-1 ${activeTab === 'nutrition' ? 'text-cyberVolt' : 'text-zinc-400 hover:text-white'} font-mono text-[10px] transition-colors cursor-pointer">
            <span class="text-lg leading-none">🥗</span>
            <span>NUTRITION</span>
          </button>

        </div>
      </nav>

      <!-- SLIDE-OUT CONCIERGE DRAWER -->
      ${renderSlideDrawer()}

      <!-- VIP PASS RENEWAL MODAL -->
      ${renderRenewModal()}

      <!-- QR CODE CAMERA SCANNER MODAL -->
      ${renderQRScannerModal()}

      <!-- PWA INSTALL GUIDE MODAL -->
      ${renderInstallModal()}

      <!-- FLOATING TOAST CONTAINER -->
      <div id="nexus-toast-container" class="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col gap-2 max-w-sm w-11/12"></div>
    `;

    bindMemberHUDEvents(root);
  }

  // --------------------------------------------------------------------------
  // 12C. SUB-COMPONENTS RENDERERS
  // --------------------------------------------------------------------------
  function renderLiveOperationsBanner() {
    const t = state.tenant;
    const status = (t.status || 'OPEN').toUpperCase();
    const notice = t.notice_text || '';
    const delayedTime = t.delayed_time || '5:00 PM';
    const updatedAt = t.updated_at ? new Date(t.updated_at) : new Date();
    const updatedTimeStr = updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (status === 'OPEN') {
      return '';
    }

    if (status === 'DELAYED') {
      return `
        <div class="rounded-3xl p-4 transition-all duration-300 relative overflow-hidden shadow-2xl bg-gradient-to-r from-amber-950/85 via-amber-900/70 to-black border-2 border-moltenGold/80 space-y-2">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-brand text-xl shrink-0 shadow-lg bg-moltenGold/20 text-moltenGold border border-moltenGold/40">
              ⏳
            </div>
            <div class="space-y-1 min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-moltenGold/20 text-moltenGold border border-moltenGold/40 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-moltenGold animate-ping"></span> LATE OPENING
                </span>
                <span class="text-[9px] font-mono text-zinc-400">Updated ${esc(updatedTimeStr)}</span>
              </div>
              <h3 class="font-brand text-base tracking-wide text-moltenGold leading-tight">
                OPENING DELAYED — OPENS AT ${esc(delayedTime)}
              </h3>
              <p class="text-xs font-sans text-zinc-200 leading-relaxed">
                ${esc(notice || `Gym opening delayed today. Doors open at ${delayedTime}.`)}
              </p>
            </div>
          </div>
        </div>
      `;
    }

    if (status === 'CLOSED') {
      return `
        <div class="rounded-3xl p-4 transition-all duration-300 relative overflow-hidden shadow-2xl bg-gradient-to-r from-rose-950/85 via-rose-900/70 to-black border-2 border-crimsonAlert/80 space-y-2">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-brand text-xl shrink-0 shadow-lg bg-crimsonAlert/20 text-crimsonAlert border border-crimsonAlert/40">
              🚫
            </div>
            <div class="space-y-1 min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-crimsonAlert/20 text-crimsonAlert border border-crimsonAlert/40 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-crimsonAlert animate-ping"></span> CLOSED TODAY
                </span>
                <span class="text-[9px] font-mono text-zinc-400">Updated ${esc(updatedTimeStr)}</span>
              </div>
              <h3 class="font-brand text-base tracking-wide text-crimsonAlert leading-tight">
                GYM IS CLOSED TODAY
              </h3>
              <p class="text-xs font-sans text-zinc-200 leading-relaxed">
                ${esc(notice || 'Gym is closed today for facility maintenance. Regular timings resume tomorrow!')}
              </p>
            </div>
          </div>
        </div>
      `;
    }

    if (status === 'HOLIDAY') {
      return `
        <div class="rounded-3xl p-4 transition-all duration-300 relative overflow-hidden shadow-2xl bg-gradient-to-r from-sky-950/85 via-cyan-900/70 to-black border-2 border-cyanCyber/80 space-y-2">
          <div class="flex items-start gap-3">
            <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-brand text-xl shrink-0 shadow-lg bg-cyanCyber/20 text-cyanCyber border border-cyanCyber/40">
              🎉
            </div>
            <div class="space-y-1 min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <span class="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-cyanCyber/20 text-cyanCyber border border-cyanCyber/40 flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-cyanCyber animate-ping"></span> FESTIVAL HOLIDAY
                </span>
                <span class="text-[9px] font-mono text-zinc-400">Updated ${esc(updatedTimeStr)}</span>
              </div>
              <h3 class="font-brand text-base tracking-wide text-cyanCyber leading-tight">
                HOLIDAY — GYM CLOSED
              </h3>
              <p class="text-xs font-sans text-zinc-200 leading-relaxed">
                ${esc(notice || 'Happy festival holidays to all athletes! Regular timings resume tomorrow.')}
              </p>
            </div>
          </div>
        </div>
      `;
    }

    return '';
  }

  function renderSlideDrawer() {
    const t = state.tenant;
    const m = state.member;
    const isOpen = state.ui.drawerOpen;

    return `
      <div id="nexus-drawer-backdrop" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}"></div>
      
      <aside id="nexus-slide-drawer" class="fixed top-0 bottom-0 left-0 z-50 w-72 bg-surfaceCard border-r border-white/10 p-5 flex flex-col justify-between transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl">
        <div class="space-y-5">
          
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-cyberVolt/20 border border-cyberVolt/40 text-cyberVolt flex items-center justify-center font-bold text-xs">
                AF
              </div>
              <strong class="font-brand text-base text-white">${esc(t.name)}</strong>
            </div>
            <button type="button" id="nexus-btn-close-drawer" class="w-8 h-8 rounded-xl bg-surfaceMuted flex items-center justify-center text-zinc-400 hover:text-white cursor-pointer">
              ✕
            </button>
          </div>

          <div class="p-3.5 rounded-2xl bg-black/50 border border-white/10 space-y-1">
            <strong class="font-brand text-sm text-white block">${esc(m?.full_name)}</strong>
            <span class="text-[11px] font-mono text-zinc-400 block">${esc(m?.phone ? '+91 ' + cleanPhone(m.phone) : 'VIP Member')}</span>
          </div>

          <nav class="space-y-1 font-mono text-xs">
            <button type="button" data-drawer-nav="pass" class="nexus-drawer-link w-full p-3 rounded-xl hover:bg-white/10 text-left text-zinc-300 flex items-center gap-2.5 cursor-pointer">
              <span>💳</span> Membership Pass
            </button>
            <button type="button" data-drawer-nav="renew" class="nexus-drawer-link w-full p-3 rounded-xl hover:bg-white/10 text-left text-moltenGold flex items-center gap-2.5 cursor-pointer">
              <span>⚡</span> Renew Pass (UPI Instant)
            </button>
            <button type="button" data-drawer-nav="concierge" class="nexus-drawer-link w-full p-3 rounded-xl hover:bg-white/10 text-left text-matrixGreen flex items-center gap-2.5 cursor-pointer">
              <span>💬</span> WhatsApp Concierge
            </button>
            <button type="button" data-drawer-nav="referral" class="nexus-drawer-link w-full p-3 rounded-xl hover:bg-white/10 text-left text-zinc-300 flex items-center gap-2.5 cursor-pointer">
              <span>👥</span> Invite Friends / Squad
            </button>
            <button type="button" data-drawer-nav="install" class="nexus-drawer-link w-full p-3 rounded-xl hover:bg-white/10 text-left text-cyanCyber flex items-center gap-2.5 cursor-pointer">
              <span>⇩</span> Install App to Home Screen
            </button>
          </nav>

        </div>

        <div class="pt-4 border-t border-white/10">
          <button type="button" id="nexus-btn-drawer-logout" class="w-full py-3 bg-crimsonAlert/15 border border-crimsonAlert/30 hover:bg-crimsonAlert/25 text-crimsonAlert font-mono text-xs font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer">
            <span>⎋</span> Log Out Terminal
          </button>
        </div>
      </aside>
    `;
  }

  function renderRenewModal() {
    const t = state.tenant;
    const p = t.pricing;
    const sel = state.ui.selectedRenewalMonths;
    const isOpen = state.ui.renewModalOpen;
    const price = getSelectedRenewalPrice();
    const upiId = t.owner_upi || 'gymowner@okhdfcbank';
    const supportPhone = cleanPhone(t.owner_phone || '8467895365');
    const memberName = state.member?.full_name || 'Athlete';
    const memberPhone = cleanPhone(state.member?.phone || '');
    const waText = encodeURIComponent(`Hi ${t.name}, I have initiated my ${sel} Month(s) Pass renewal payment of ₹${price.toLocaleString('en-IN')} via UPI to ${upiId}.\n\nMember: ${memberName} (+91 ${memberPhone})\nPlease verify and update my VIP pass.`);

    return `
      <div id="nexus-renew-modal" class="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl ${isOpen ? 'flex' : 'hidden'} flex-col items-center justify-center p-4">
        <div class="w-full max-w-sm bg-surfaceCard rounded-3xl border border-moltenGold/50 shadow-2xl p-5 relative overflow-hidden space-y-4 text-center">
          
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-moltenGold/20 border border-moltenGold/40 text-moltenGold flex items-center justify-center font-bold text-sm">
                ⚡
              </div>
              <div class="text-left">
                <h3 class="font-brand text-base font-bold text-white leading-none">${esc(t.name)}</h3>
                <span class="text-[9px] font-mono text-moltenGold uppercase">Instant VIP Pass Renewal</span>
              </div>
            </div>
            <button type="button" id="nexus-btn-close-renew" class="w-8 h-8 rounded-full bg-surfaceMuted text-zinc-400 hover:text-white flex items-center justify-center font-mono cursor-pointer">
              ✕
            </button>
          </div>

          <!-- Plan Selection 4-Grid -->
          <div class="space-y-2 text-left">
            <label class="block font-mono text-[10px] uppercase tracking-wider text-zinc-400">Select Membership Duration</label>
            <div class="grid grid-cols-2 gap-2">
              <button type="button" data-plan="1" class="nexus-plan-btn p-3 rounded-2xl ${sel === 1 ? 'border-2 border-cyberVolt bg-cyberVolt/15 shadow-glow-volt' : 'border border-white/10 bg-surfaceMuted'} text-left transition-all cursor-pointer">
                <span class="text-[10px] font-mono text-zinc-400 block uppercase">1 Month Plan</span>
                <span class="font-brand text-base font-extrabold text-white">₹${(p.p1 || 1200).toLocaleString('en-IN')}</span>
                <span class="text-[9px] font-mono text-cyberVolt block">Starter Tier</span>
              </button>
              
              <button type="button" data-plan="3" class="nexus-plan-btn p-3 rounded-2xl ${sel === 3 ? 'border-2 border-cyberVolt bg-cyberVolt/15 shadow-glow-volt' : 'border border-white/10 bg-surfaceMuted'} text-left transition-all cursor-pointer">
                <span class="text-[10px] font-mono text-zinc-400 block uppercase">3 Months Plan</span>
                <span class="font-brand text-base font-extrabold text-white">₹${(p.p3 || 3200).toLocaleString('en-IN')}</span>
                <span class="text-[9px] font-mono text-moltenGold block">Save ~11%</span>
              </button>

              <button type="button" data-plan="6" class="nexus-plan-btn p-3 rounded-2xl ${sel === 6 ? 'border-2 border-cyberVolt bg-cyberVolt/15 shadow-glow-volt' : 'border border-white/10 bg-surfaceMuted'} text-left transition-all cursor-pointer">
                <span class="text-[10px] font-mono text-zinc-400 block uppercase">6 Months Plan</span>
                <span class="font-brand text-base font-extrabold text-white">₹${(p.p6 || 5800).toLocaleString('en-IN')}</span>
                <span class="text-[9px] font-mono text-cyanCyber block">Save ~20%</span>
              </button>

              <button type="button" data-plan="12" class="nexus-plan-btn p-3 rounded-2xl ${sel === 12 ? 'border-2 border-cyberVolt bg-cyberVolt/15 shadow-glow-volt' : 'border border-white/10 bg-surfaceMuted'} text-left transition-all cursor-pointer">
                <span class="text-[10px] font-mono text-zinc-400 block uppercase">12 Months (VIP)</span>
                <span class="font-brand text-base font-extrabold text-white">₹${(p.p12 || 10500).toLocaleString('en-IN')}</span>
                <span class="text-[9px] font-mono text-matrixGreen block">Best Value</span>
              </button>
            </div>
          </div>

          <!-- Official Gym UPI ID Target -->
          <div class="p-3.5 bg-black/60 rounded-2xl border border-white/10 space-y-1.5 text-left font-mono text-xs">
            <div class="flex items-center justify-between text-[11px] text-zinc-400">
              <span>Official Gym UPI ID:</span>
              <button type="button" id="nexus-btn-copy-upi" class="text-cyberVolt hover:underline flex items-center gap-1 cursor-pointer">
                <span>Copy ID</span> 📋
              </button>
            </div>
            <div class="p-2 bg-surfaceMuted rounded-xl border border-white/5 flex items-center justify-between">
              <span class="font-mono text-white font-bold text-xs truncate">${esc(upiId)}</span>
              <span class="text-[9px] text-matrixGreen px-1.5 py-0.5 rounded bg-matrixGreen/10">VERIFIED</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="space-y-2 pt-1">
            <button 
              type="button" 
              id="nexus-btn-trigger-upi"
              class="w-full py-3.5 bg-gradient-to-r from-moltenGold via-[#ffc837] to-cyberVolt text-black font-brand font-extrabold text-base tracking-wider rounded-2xl shadow-glow-gold hover:brightness-110 active:scale-95 transition-all uppercase flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>⚡</span>
              <span>PAY ₹${price.toLocaleString('en-IN')} VIA ANY UPI APP</span>
            </button>

            <a 
              href="https://wa.me/91${supportPhone}?text=${waText}" 
              target="_blank"
              class="w-full py-2.5 bg-matrixGreen/15 hover:bg-matrixGreen/25 border border-matrixGreen/30 text-matrixGreen font-mono text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all block"
            >
              <span>💬</span>
              <span>Send Payment Screenshot via WhatsApp</span>
            </a>
          </div>

          <div class="pt-1">
            <button type="button" id="nexus-btn-cancel-renew" class="w-full py-2.5 bg-surfaceMuted text-zinc-400 font-mono text-xs rounded-xl border border-white/5 cursor-pointer">
              Cancel
            </button>
          </div>

        </div>
      </div>
    `;
  }

  function renderQRScannerModal() {
    const isOpen = state.ui.qrModalOpen;
    return `
      <div id="nexus-qr-modal" class="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl ${isOpen ? 'flex' : 'hidden'} flex-col items-center justify-center p-4">
        <div class="w-full max-w-sm bg-surfaceCard rounded-3xl border border-matrixGreen/40 shadow-2xl p-5 relative overflow-hidden space-y-4 text-center">
          
          <div class="flex items-center justify-between pb-3 border-b border-white/10">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-matrixGreen/20 border border-matrixGreen/40 text-matrixGreen flex items-center justify-center font-bold text-sm">
                📷
              </div>
              <div class="text-left">
                <h3 class="font-brand text-base font-bold text-white leading-none">RECEPTION QR SCANNER</h3>
                <span class="text-[9px] font-mono text-matrixGreen uppercase">Daily Attendance Punch</span>
              </div>
            </div>
            <button type="button" id="nexus-btn-close-scanner" class="w-8 h-8 rounded-full bg-surfaceMuted text-zinc-400 hover:text-white flex items-center justify-center font-mono cursor-pointer">
              ✕
            </button>
          </div>

          <!-- Live Camera Viewport -->
          <div class="relative w-full aspect-square bg-black rounded-2xl overflow-hidden border border-white/20 shadow-inner">
            <div class="laser-scan-beam"></div>
            <div id="nexus-qr-reader" class="w-full h-full"></div>
          </div>

          <div class="space-y-1 font-mono text-xs">
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-matrixGreen/15 border border-matrixGreen/30 text-matrixGreen font-bold text-[10px]">
              <span class="w-1.5 h-1.5 rounded-full bg-matrixGreen animate-pulse"></span>
              <span id="nexus-scanner-status-text">ALIGN WITH RECEPTION DESK QR STANDEE</span>
            </div>
            <p class="text-[11px] text-zinc-400 font-sans">Point phone camera at the physical Standee placed at the Reception desk.</p>
          </div>

          <div class="pt-1">
            <button type="button" id="nexus-btn-cancel-scanner" class="w-full py-3 bg-surfaceMuted text-zinc-300 font-mono text-xs rounded-2xl border border-white/10 active:scale-95 transition-all cursor-pointer">
              Cancel Scanner
            </button>
          </div>

        </div>
      </div>
    `;
  }

  function renderInstallModal() {
    const isOpen = state.ui.installModalOpen;
    return `
      <div id="nexus-install-modal" class="fixed inset-0 z-50 bg-black/95 backdrop-blur-2xl ${isOpen ? 'flex' : 'hidden'} flex-col items-center justify-center p-4">
        <div class="w-full max-w-sm bg-surfaceCard rounded-3xl border border-cyanCyber/40 shadow-2xl p-6 relative overflow-hidden space-y-4 text-center">
          
          <div class="w-14 h-14 mx-auto rounded-2xl bg-cyanCyber/20 border border-cyanCyber/50 text-cyanCyber flex items-center justify-center font-brand font-extrabold text-2xl shadow-glow-cyan">
            ⇩
          </div>

          <div class="space-y-1">
            <h3 class="font-brand text-xl font-bold text-white">INSTALL AKASH FITNESS</h3>
            <p class="font-mono text-xs text-zinc-400">1-Tap Standalone App Experience</p>
          </div>

          <div class="p-4 rounded-2xl bg-black/60 border border-white/10 space-y-3 text-left font-sans text-xs text-zinc-300">
            <div class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-cyberVolt text-black font-mono font-bold text-[11px] flex items-center justify-center shrink-0">1</span>
              <span>Tap the <strong>Share</strong> button <span class="font-mono text-cyanCyber">⎋</span> at the bottom/top of your Safari or Chrome browser.</span>
            </div>
            <div class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-cyberVolt text-black font-mono font-bold text-[11px] flex items-center justify-center shrink-0">2</span>
              <span>Scroll down and tap <strong>"Add to Home Screen"</strong> <span class="font-mono text-cyberVolt">➕</span>.</span>
            </div>
            <div class="flex items-start gap-2.5">
              <span class="w-5 h-5 rounded-full bg-cyberVolt text-black font-mono font-bold text-[11px] flex items-center justify-center shrink-0">3</span>
              <span>Tap <strong>"Add"</strong> in the top right corner to launch directly from your home screen.</span>
            </div>
          </div>

          <button type="button" id="nexus-btn-close-install" class="w-full py-3.5 bg-cyanCyber text-black font-brand font-extrabold text-sm rounded-2xl uppercase shadow-glow-cyan cursor-pointer hover:brightness-110 active:scale-95 transition-all">
            GOT IT ✓
          </button>

        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // 12D. EVENT BINDINGS
  // --------------------------------------------------------------------------
  function bindMemberHUDEvents(root) {
    // Drawer triggers
    const openDrawerBtn = $('#nexus-btn-open-drawer', root);
    const userAvatarBtn = $('#nexus-btn-user-avatar', root);
    const closeDrawerBtn = $('#nexus-btn-close-drawer', root);
    const backdrop = $('#nexus-drawer-backdrop', root);

    if (openDrawerBtn) openDrawerBtn.addEventListener('click', () => { state.ui.drawerOpen = true; playCyberChime('tap'); renderApp(); });
    if (userAvatarBtn) userAvatarBtn.addEventListener('click', () => { state.ui.drawerOpen = true; playCyberChime('tap'); renderApp(); });
    if (closeDrawerBtn) closeDrawerBtn.addEventListener('click', () => { state.ui.drawerOpen = false; playCyberChime('tap'); renderApp(); });
    if (backdrop) backdrop.addEventListener('click', () => { state.ui.drawerOpen = false; renderApp(); });

    // Drawer links
    $$('.nexus-drawer-link', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.drawerNav;
        state.ui.drawerOpen = false;
        if (target === 'renew') openRenewModal();
        else if (target === 'concierge') openGymConcierge();
        else if (target === 'install') triggerPWAInstall();
        else if (target === 'referral') { state.ui.activeTab = 'referral'; renderApp(); }
        else if (target === 'pass') { state.ui.activeTab = 'pass'; renderApp(); }
      });
    });

    const drawerLogout = $('#nexus-btn-drawer-logout', root);
    if (drawerLogout) drawerLogout.addEventListener('click', handleLogout);

    // Bottom navigation
    $$('.nexus-nav-btn', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const nav = btn.dataset.nav;
        playCyberChime('tap');
        if (nav === 'checkin') {
          openQRScanner();
        } else {
          state.ui.activeTab = nav;
          renderApp();
        }
      });
    });

    // Back to home buttons
    $$('.nexus-back-home', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        playCyberChime('tap');
        state.ui.activeTab = 'home';
        renderApp();
      });
    });

    // Check-in CTA on Home
    const checkinCTA = $('#nexus-btn-checkin-cta', root);
    if (checkinCTA) checkinCTA.addEventListener('click', openQRScanner);

    // 3 Action Buttons on Home
    const renewAction = $('#nexus-btn-renew-action', root);
    const conciergeAction = $('#nexus-btn-concierge-action', root);
    const installAction = $('#nexus-btn-install-action', root);
    const passRenewBtn = $('#nexus-btn-pass-renew', root);

    if (renewAction) renewAction.addEventListener('click', openRenewModal);
    if (conciergeAction) conciergeAction.addEventListener('click', openGymConcierge);
    if (installAction) installAction.addEventListener('click', triggerPWAInstall);
    if (passRenewBtn) passRenewBtn.addEventListener('click', openRenewModal);

    // Renew Modal controls
    const closeRenewBtn = $('#nexus-btn-close-renew', root);
    const cancelRenewBtn = $('#nexus-btn-cancel-renew', root);
    const triggerUpiBtn = $('#nexus-btn-trigger-upi', root);
    const copyUpiBtn = $('#nexus-btn-copy-upi', root);

    if (closeRenewBtn) closeRenewBtn.addEventListener('click', closeRenewModal);
    if (cancelRenewBtn) cancelRenewBtn.addEventListener('click', closeRenewModal);
    if (triggerUpiBtn) triggerUpiBtn.addEventListener('click', executeUPIPayment);
    if (copyUpiBtn) copyUpiBtn.addEventListener('click', copyGymUPI);

    $$('.nexus-plan-btn', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        const m = Number(btn.dataset.plan);
        selectRenewalPlan(m);
      });
    });

    // Scanner Modal controls
    const closeScannerBtn = $('#nexus-btn-close-scanner', root);
    const cancelScannerBtn = $('#nexus-btn-cancel-scanner', root);
    if (closeScannerBtn) closeScannerBtn.addEventListener('click', closeQRScanner);
    if (cancelScannerBtn) cancelScannerBtn.addEventListener('click', closeQRScanner);

    // Install Modal controls
    const closeInstallBtn = $('#nexus-btn-close-install', root);
    if (closeInstallBtn) closeInstallBtn.addEventListener('click', closeInstallModal);

    // Referral Squad actions
    const shareRefBtn = $('#nexus-btn-share-referral', root);
    const copyRefBtn = $('#nexus-btn-copy-referral', root);
    const codeBox = $('#nexus-referral-code-box', root);

    if (shareRefBtn) shareRefBtn.addEventListener('click', shareReferralWhatsApp);
    if (copyRefBtn) copyRefBtn.addEventListener('click', copyReferralCode);
    if (codeBox) codeBox.addEventListener('click', copyReferralCode);
  }

  // --------------------------------------------------------------------------
  // 13. BOOTSTRAP INITIALIZATION
  // --------------------------------------------------------------------------
  async function initializePortal() {
    try {
      getSupabase();
      const slug = resolveCurrentGymSlug();
      const gymHydrated = await fetchAndHydrateGym(slug);
      if (!gymHydrated) return;

      // Check saved session with strict tenant isolation
      const savedSession = loadPersistedSession();
      if (savedSession && (savedSession.session_token || savedSession.phone)) {
        const sessionSlug = normalizeGymSlug(savedSession.gym_slug || '');
        if (sessionSlug && sessionSlug !== state.tenant.slug) {
          // Reject session from different tenant and require re-authentication
          clearLocalAttendanceLock(state.tenant.slug, savedSession.id || savedSession.member_id);
          localStorage.removeItem(MEMBER_SESSION_KEY);
          state.member = null;
          state.session.session_token = null;
          state.session.session_expires_at = null;
          showToast(`Active session was for another gym. Please authenticate for ${state.tenant.name}.`, 'warning');
        } else {
          state.member = savedSession;
          state.session.session_token = savedSession.session_token;
          state.session.session_expires_at = savedSession.session_expires_at;

          // Background sync
          refreshMemberSession();
          checkAttendanceStatus();
          startRealtimeSubscriptions();
        }
      }

      state.ui.isInitializing = false;
      renderApp();

      // Lifecycle reconciliation hooks
      const reconcile = () => {
        if (state.session.session_token) {
          refreshMemberSession();
          checkAttendanceStatus();
        }
        fetchAndHydrateGym(state.tenant.slug);
      };

      window.addEventListener('online', () => {
        showToast('⚡ Connection restored! Synchronizing data...', 'success');
        reconcile();
      });
      window.addEventListener('offline', () => {
        showToast('⚠️ Offline Mode — displaying cached pass.', 'warning');
      });
      window.addEventListener('focus', reconcile);
      window.addEventListener('pageshow', reconcile);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reconcile();
      });

    } catch (err) {
      console.error('[NEXUS STARTUP ERROR]', err);
      state.ui.gatekeeperError = {
        title: 'Initialization Error',
        message: 'A startup error occurred. Tap below to reload the application.',
        details: err?.message || 'Network Timeout',
        type: 'error'
      };
      state.ui.isInitializing = false;
      renderApp();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePortal, { once: true });
  } else {
    initializePortal();
  }

})();
