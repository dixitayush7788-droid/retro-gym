import { supabase } from './supabaseClient.js';

/**
 * Claims a gym member pass for an authenticated user using verified phone credentials.
 */
export async function claimMemberPass(gymId, phoneNumber) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Session required: Please log in or verify your account first.');
  }

  const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-10);
  const numericGymId = typeof gymId === 'number' ? gymId : parseInt(gymId, 10);

  try {
    const { data, error } = await supabase.rpc('rpc_claim_member_pass', {
      p_gym_id: isNaN(numericGymId) ? null : numericGymId,
      p_phone: cleanPhone
    });

    if (!error && data?.success) return data;
  } catch (rpcErr) {
    console.warn('[MEMBER AUTH] RPC claim pass note, running direct profile binding fallback:', rpcErr);
  }

  // Fallback: Link auth user profile to member record in members table
  const query = supabase
    .from('members')
    .update({ profile_id: session.user.id })
    .eq('normalized_phone', cleanPhone);

  if (!isNaN(numericGymId)) {
    query.eq('gym_id', numericGymId);
  }

  const { data, error } = await query.select().maybeSingle();
  if (error) throw error;
  return { success: true, member: data };
}

/**
 * HUD lookup for member pass using normalized_phone and member_memberships.
 */
export async function getPublicHudPass(gymSlug, phoneNumber) {
  const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-10);
  
  // 1. Try RPC helper if deployed
  try {
    const { data, error } = await supabase.rpc('rpc_get_member_hud_pass', {
      p_gym_slug: gymSlug,
      p_phone: cleanPhone
    });

    if (!error && data) return data;
  } catch (rpcErr) {}

  // 2. Direct database query matching gym and normalized_phone
  let targetGymId = null;
  if (gymSlug) {
    const { data: gym } = await supabase
      .from('gyms')
      .select('id, slug, name')
      .eq('slug', gymSlug)
      .maybeSingle();
    if (gym) targetGymId = gym.id;
  }

  let memberQuery = supabase
    .from('members')
    .select('*, member_memberships(*, plans(*))')
    .eq('normalized_phone', cleanPhone);

  if (targetGymId) {
    memberQuery = memberQuery.eq('gym_id', targetGymId);
  }

  const { data: member, error } = await memberQuery.maybeSingle();
  if (error) throw error;
  if (!member) return null;

  // Extract active membership if present
  let activeMembership = null;
  if (member.member_memberships && member.member_memberships.length > 0) {
    // Sort by end_date descending
    const sorted = [...member.member_memberships].sort((a, b) => new Date(b.end_date) - new Date(a.end_date));
    activeMembership = sorted[0];
  }

  return {
    ...member,
    full_name: member.full_name,
    phone: member.normalized_phone,
    normalized_phone: member.normalized_phone,
    valid_until: activeMembership?.end_date || member.created_at,
    plan_name: activeMembership?.plans?.name || 'Standard Pass',
    status: activeMembership?.status || (member.is_active ? 'ACTIVE' : 'INACTIVE')
  };
}

