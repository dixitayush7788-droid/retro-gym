import { supabase } from './supabaseClient.js';

/**
 * Claims a gym member pass for an authenticated user using verified phone credentials.
 */
export async function claimMemberPass(gymId, phoneNumber) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Session required: Please verify your phone via OTP first.');
  }

  const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-10);

  const { data, error } = await supabase.rpc('rpc_claim_member_pass', {
    p_gym_id: parseInt(gymId, 10),
    p_phone: cleanPhone
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Unable to claim member pass.');

  return data;
}

/**
 * Unauthenticated HUD lookup (Backward Compatibility).
 */
export async function getPublicHudPass(gymSlug, phoneNumber) {
  const cleanPhone = String(phoneNumber).replace(/\D/g, '').slice(-10);
  
  const { data, error } = await supabase.rpc('rpc_get_member_hud_pass', {
    p_gym_slug: gymSlug,
    p_phone: cleanPhone
  });

  if (error) throw error;
  return data;
}
