import { supabase } from './supabaseClient.js';

(() => {
  'use strict';

  if (window.__nexusOwnerWhatsAppCanonicalInstalled) return;
  window.__nexusOwnerWhatsAppCanonicalInstalled = true;

  const cleanPhone = (value) => String(value || '').replace(/\D/g, '').slice(-10);
  const getSlug = () => (new URLSearchParams(window.location.search).get('gym') || '').trim().toLowerCase();

  function formatDate(value) {
    if (!value) return 'Active membership period';
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function getAthleteLink(slug) {
    const basePath = window.location.pathname.replace(/\/[^/]*$/, '/');
    return `${window.location.origin}${basePath}index.html?gym=${encodeURIComponent(slug)}`;
  }

  function buildWelcomeMessage({ gymName, memberName, phone, endDate, athleteLink, supportPhone }) {
    return `*${gymName} — OFFICIAL MEMBERSHIP WELCOME*\n\nDear ${memberName},\n\nWelcome to ${gymName}. Your membership has been successfully activated and your athlete profile is now ready.\n\n*MEMBERSHIP DETAILS*\n• Athlete: ${memberName}\n• Registered Mobile: +91 ${phone}\n• Valid Until: ${formatDate(endDate)}\n\n*ATHLETE PORTAL*\n${athleteLink}\n\n*FIRST-TIME LOGIN*\n1. Open the Athlete Portal link above.\n2. Enter your registered mobile number: +91 ${phone}\n3. On your first login, create your private 4-digit PIN.\n4. Use this PIN for secure access to your personal dashboard.\n\n*IMPORTANT SECURITY NOTE*\nPlease keep your 4-digit PIN private and do not share it with anyone. The gym team will never ask you to disclose your PIN.\n\nYour dashboard gives you access to your membership status, attendance, progress, nutrition and other services enabled by ${gymName}.\n\nFor any assistance, please contact the gym reception: +91 ${supportPhone || '—'}\n\nWe are glad to have you with us. Train consistently, stay disciplined and make every session count.\n\n*Team ${gymName}*`; 
  }

  async function resolveWelcomeData(phone) {
    const slug = getSlug();
    const normalizedPhone = cleanPhone(phone);
    if (!slug || !/^\d{10}$/.test(normalizedPhone)) return null;

    const client = window.__NEXUS_CANONICAL_SUPABASE_CLIENT__ || window.supabaseClient || window.db || supabase;
    if (!client) return null;

    const { data: gym, error: gymError } = await client
      .from('gyms')
      .select('id,name,gym_name,phone,owner_phone,support_phone,slug')
      .eq('slug', slug)
      .maybeSingle();
    if (gymError || !gym?.id) return null;

    const { data: member, error: memberError } = await client
      .from('members')
      .select('id,full_name,normalized_phone,gym_id')
      .eq('gym_id', gym.id)
      .eq('normalized_phone', normalizedPhone)
      .maybeSingle();
    if (memberError || !member) return null;

    const { data: memberships, error: membershipError } = await client
      .from('member_memberships')
      .select('id,end_date,status')
      .eq('gym_id', gym.id)
      .eq('member_id', member.id)
      .order('end_date', { ascending: false })
      .limit(1);
    if (membershipError || !memberships?.[0]) return null;

    const supportPhone = cleanPhone(gym.support_phone || gym.phone || gym.owner_phone || '');
    const gymName = gym.name || gym.gym_name || 'Your Gym';
    const message = buildWelcomeMessage({
      gymName,
      memberName: member.full_name || 'Athlete',
      phone: normalizedPhone,
      endDate: memberships[0].end_date,
      athleteLink: getAthleteLink(slug),
      supportPhone
    });

    return {
      phone: normalizedPhone,
      message,
      url: `https://wa.me/91${normalizedPhone}?text=${encodeURIComponent(message)}`
    };
  }

  window.__nexusBuildMemberWelcomeMessage = buildWelcomeMessage;
  window.__nexusOpenMemberWhatsApp = async (phone) => {
    const data = await resolveWelcomeData(phone);
    if (!data) return false;
    window.location.assign(data.url);
    return true;
  };

  function installOnboardingHandoff() {
    if (window.__nexusOwnerWhatsAppOnboardingWrapped || typeof window.handleCreateMember !== 'function') return;
    const original = window.handleCreateMember;
    window.__nexusOwnerWhatsAppOnboardingWrapped = true;

    window.handleCreateMember = async function nexusCanonicalOnboardingWithWhatsApp(event) {
      const phone = cleanPhone(document.getElementById('new-member-phone')?.value);
      if (!/^\d{10}$/.test(phone)) return original.call(this, event);

      const slug = getSlug();
      const client = window.__NEXUS_CANONICAL_SUPABASE_CLIENT__ || window.supabaseClient || window.db || supabase;
      let beforeId = null;
      let preflightOk = false;

      if (client && slug) {
        try {
          const { data: gym } = await client.from('gyms').select('id').eq('slug', slug).maybeSingle();
          if (gym?.id) {
            const { data: existing } = await client.from('members').select('id').eq('gym_id', gym.id).eq('normalized_phone', phone).maybeSingle();
            beforeId = existing?.id || null;
            preflightOk = true;
          }
        } catch (error) {
          console.warn('[NEXUS WHATSAPP] Onboarding preflight unavailable:', error);
        }
      }

      const result = await original.call(this, event);

      if (!preflightOk || beforeId) return result;

      try {
        const welcome = await resolveWelcomeData(phone);
        if (welcome) {
          // Navigate directly after the successful user action. The WhatsApp composer is
          // pre-filled; the gym owner still presses Send manually.
          window.location.assign(welcome.url);
        }
      } catch (error) {
        console.warn('[NEXUS WHATSAPP] Welcome handoff failed:', error);
      }

      return result;
    };
  }

  function installDossierWhatsApp() {
    if (window.__nexusOwnerWhatsAppDossierWrapped || typeof window.openAthleteDossier !== 'function') return;
    const original = window.openAthleteDossier;
    window.__nexusOwnerWhatsAppDossierWrapped = true;

    window.openAthleteDossier = async function nexusDossierWithCanonicalWhatsApp(phone, animate = true) {
      const result = await original.call(this, phone, animate);
      try {
        const data = await resolveWelcomeData(phone);
        const button = document.getElementById('dossier-wa-btn');
        if (data && button) {
          button.href = data.url;
          button.target = '_blank';
          button.rel = 'noopener noreferrer';
          button.title = 'Open WhatsApp with the official athlete welcome / access message';
        }
      } catch (error) {
        console.warn('[NEXUS WHATSAPP] Dossier link update failed:', error);
      }
      return result;
    };
  }

  function init() {
    installOnboardingHandoff();
    installDossierWhatsApp();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
