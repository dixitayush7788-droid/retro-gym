import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { supabase } from './supabaseClient.js';

const SUPABASE_URL = (typeof window !== 'undefined' && window.NEXUS_CONFIG?.SUPABASE_URL) || 'https://zfvkvrhuovvbfbrutpph.supabase.co';
const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.NEXUS_CONFIG?.SUPABASE_ANON_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmdmt2cmh1b3Z2YmZicnV0cHBoIiwiaWF0IjoxNzg3MTMyMjg0LCJleHAiOjIxMDI3MDgyODR9.M-WK1bgZDLXcuMTldMSwptx5XRpRnLAi-BxMFEoph4U';

let cachedSuperAdminContext = null;
let bootstrapPromise = null;

export function withTimeout(promise, timeoutMs = 7000, operationName = 'Operation') {
  let timer;
  const timeoutPromise = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`[TIMEOUT] ${operationName} timed out after ${timeoutMs}ms`)), timeoutMs); });
  return Promise.race([promise, timeoutPromise]).finally(() => { if (timer) clearTimeout(timer); });
}

export function createIsolatedAuthClient() {
  const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  if (typeof window !== 'undefined' && window.supabase?.createClient) return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, opts);
}

export function generateGymSlug(name = '', phone = '') {
  const cleanName = (name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const last4 = cleanPhone.length >= 4 ? cleanPhone.slice(-4) : (cleanPhone.length > 0 ? cleanPhone : '');
  if (!cleanName) return last4 ? `gym-${last4}` : '';
  return last4 ? `${cleanName}-${last4}` : cleanName;
}

export function generateDefaultEmail(slug = '', phone = '') {
  const cleanSlug = (slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (cleanSlug) return `owner@${cleanSlug}.nexusgym.io`;
  const cleanPhone = (phone || '').replace(/\D/g, '');
  if (cleanPhone) return `owner.${cleanPhone.slice(-4)}@nexusgym.io`;
  return 'owner@gym.nexusgym.io';
}

export async function onboardGymNode({ gymName, slug, phone, email, adminPin = '1234', upi, saasFee = 2499, validityDays = 365, p1 = 1200, p3 = 3200, p6 = 5800, p12 = 10500, features = { workouts: true, nutrition: true, qr_attendance: true, notices: true }, ownerName = null }) {
  if (!gymName || !slug || !phone || !email || !upi) throw new Error('All required onboarding fields (Gym Name, Slug, Phone, Email, UPI) must be filled.');
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const session = sessionData?.session;
  if (sessionError || !session?.user) throw new Error('Authentication Required: Your Super Admin session is missing or expired. Please sign in again.');
  let isSuperAdmin = checkIsSuperAdmin(session.user, cachedSuperAdminContext);
  try { const { data: rpcContext, error: contextErr } = await supabase.rpc('rpc_get_current_user_context'); if (!contextErr && rpcContext) isSuperAdmin = isSuperAdmin || checkIsSuperAdmin(session.user, rpcContext); } catch (ctxErr) { console.warn('[ONBOARDING] User context RPC check note:', ctxErr); }
  if (!isSuperAdmin) throw new Error('Access Denied: Current user does not hold the SUPER_ADMIN role required to onboard new gym nodes.');

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const pricingPayload = { plan_1m_price: Number(p1), plan_3m_price: Number(p3), plan_6m_price: Number(p6), plan_12m_price: Number(p12) };
  const resolvedOwnerName = String(ownerName || `${gymName} Owner`).trim();

  // Auth provisioning is server-side only. The browser never receives or stores an owner password.
  const { data, error } = await supabase.functions.invoke('nexus-create-gym-owner', { body: { gym_name: gymName, slug: cleanSlug, owner_phone: phone, owner_email: email, owner_name: resolvedOwnerName, owner_upi_id: upi, admin_pin: String(adminPin || '1234'), saas_fee: Number(saasFee), validity_days: Number(validityDays), pricing: pricingPayload, feature_gates: features } });
  if (error) {
    let message = error.message || 'Owner onboarding failed.';
    try { const body = typeof error.context?.json === 'function' ? await error.context.json() : null; if (body?.error) message = body.error; } catch (_) {}
    if (/already.*registered|already.*exists/i.test(message)) message = `Owner email "${email}" is already registered. Use a unique owner email.`;
    throw new Error(message);
  }
  if (!data?.success) throw new Error(data?.error || 'Owner onboarding failed.');

  return { success: true, gym: data.gym || { id: data.gym_id, name: gymName, slug: cleanSlug, phone, email }, gymId: data.gym_id, authUserId: data.owner_user_id || null, email, password: 'Set via secure email invitation', adminPin: String(adminPin || '1234'), slug: cleanSlug, gymName, phone, authNotice: data.auth_notice || 'Invitation email sent. Owner must open the email and set a password before first login.', invitationSent: data.invitation_sent === true };
}

export function checkIsSuperAdmin(user, context) {
  if (!user && !context) return false;
  if (context) {
    if (context.is_super_admin === true) return true;
    if (context.role && String(context.role).toUpperCase() === 'SUPER_ADMIN') return true;
    if (Array.isArray(context.roles)) return context.roles.some(r => { if (typeof r === 'string') return r.toUpperCase() === 'SUPER_ADMIN'; if (typeof r === 'object' && r !== null) { const roleStr = r.role || r.role_name || r.name; return roleStr && String(roleStr).toUpperCase() === 'SUPER_ADMIN'; } return false; });
  }
  if (user?.app_metadata) { const appMeta = user.app_metadata; if (appMeta.is_super_admin === true) return true; if (String(appMeta.role || '').toUpperCase() === 'SUPER_ADMIN') return true; if (Array.isArray(appMeta.roles) && appMeta.roles.some(r => String(r).toUpperCase() === 'SUPER_ADMIN')) return true; }
  return false;
}

export async function initSuperAdmin() {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = (async () => {
    try {
      if (!supabase?.auth) return { error: 'BOOT_ERROR', message: 'Supabase client could not be initialized.' };
      const sessionResult = await withTimeout(supabase.auth.getSession(), 6000, 'supabase.auth.getSession()');
      const session = sessionResult?.data?.session;
      if (sessionResult?.error) return { error: 'SESSION_ERROR', message: sessionResult.error.message || 'Session verification error' };
      if (!session?.user || !session.access_token) return { error: 'NO_SESSION' };
      const user = session.user; let context = null;
      try { const { data: rpcContext, error: rpcErr } = await withTimeout(supabase.rpc('rpc_get_current_user_context'), 5000, 'rpc_get_current_user_context'); if (rpcErr) return { error: 'SESSION_ERROR', message: `Unable to verify Super Admin role: ${rpcErr.message || 'role context RPC failed'}` }; context = rpcContext; } catch (rpcErr) { return { error: rpcErr?.message?.includes('TIMEOUT') ? 'TIMEOUT' : 'SESSION_ERROR', message: rpcErr?.message || 'Unable to verify Super Admin role.' }; }
      if (!checkIsSuperAdmin(user, context)) return { error: 'ACCESS_DENIED', user, email: user.email };
      try { if (typeof db !== 'undefined') db = supabase; } catch (_) {}
      if (typeof window !== 'undefined') { window.db = supabase; window.supabaseClient = supabase; }
      cachedSuperAdminContext = { authenticated: true, is_super_admin: true, user, email: user.email, session, ...(context || {}) };
      setupSuperAdminAuthListener(); return cachedSuperAdminContext;
    } catch (error) { console.error('[BOOT_FAILED] Bootstrap exception:', error); return { error: error.message?.includes('TIMEOUT') ? 'TIMEOUT' : 'BOOT_ERROR', message: error.message || 'Authentication initialization error' }; }
    finally { bootstrapPromise = null; }
  })();
  return bootstrapPromise;
}

let superAdminAuthSubscription = null;
function setupSuperAdminAuthListener() { if (superAdminAuthSubscription) return; const { data } = supabase.auth.onAuthStateChange((event, session) => { if (event === 'SIGNED_OUT' || (!session && event !== 'INITIAL_SESSION')) { cachedSuperAdminContext = null; sessionStorage.removeItem('nexus_master_auth'); window.location.href = './admin-login.html?redirect=super-admin.html'; } }); superAdminAuthSubscription = data?.subscription; }

export async function handleSignOut() { cachedSuperAdminContext = null; sessionStorage.removeItem('nexus_master_auth'); localStorage.removeItem('nexus_desk_unlocked'); await supabase.auth.signOut(); window.location.href = './admin-login.html?redirect=super-admin.html'; }
export function getCurrentContext() { return cachedSuperAdminContext; }
if (typeof window !== 'undefined') window.onboardGymNode = onboardGymNode;
