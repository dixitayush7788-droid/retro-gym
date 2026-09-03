import { withSupabase } from 'npm:@supabase/server@^1';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

const APP_ORIGIN = 'https://dixitayush7788-droid.github.io/retro-gym';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ success: false, error: 'METHOD_NOT_ALLOWED' }, 405);

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ success: false, error: 'INVALID_JSON' }, 400); }

    const ownerEmail = typeof body.owner_email === 'string' ? body.owner_email.trim().toLowerCase() : '';
    const ownerPhone = typeof body.owner_phone === 'string' ? body.owner_phone.trim() : '';
    const ownerName = typeof body.owner_name === 'string' ? body.owner_name.trim() : '';
    const gymName = typeof body.gym_name === 'string' ? body.gym_name.trim() : '';
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : '';
    const ownerUpi = typeof body.owner_upi_id === 'string' ? body.owner_upi_id.trim() : '';
    const adminPin = typeof body.admin_pin === 'string' ? body.admin_pin.trim() : '';
    const saasFee = Number(body.saas_fee ?? 2499);
    const validityDays = Number(body.validity_days ?? 365);
    const pricing = body.pricing && typeof body.pricing === 'object' ? body.pricing : {};
    const featureGates = body.feature_gates && typeof body.feature_gates === 'object' ? body.feature_gates : {};

    if (!ownerEmail || !/^\S+@\S+\.\S+$/.test(ownerEmail)) return json({ success: false, error: 'INVALID_OWNER_EMAIL' }, 400);
    if (ownerName.length < 2 || ownerName.length > 120) return json({ success: false, error: 'INVALID_OWNER_NAME' }, 400);
    if (gymName.length < 2 || gymName.length > 120) return json({ success: false, error: 'INVALID_GYM_NAME' }, 400);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return json({ success: false, error: 'INVALID_GYM_SLUG' }, 400);
    if (!/^\d{4}$/.test(adminPin || '1234')) return json({ success: false, error: 'INVALID_ADMIN_PIN' }, 400);
    if (!Number.isFinite(saasFee) || saasFee < 0) return json({ success: false, error: 'INVALID_SAAS_FEE' }, 400);
    if (!Number.isInteger(validityDays) || validityDays <= 0) return json({ success: false, error: 'INVALID_VALIDITY_DAYS' }, 400);

    const { data: callerContext, error: callerContextError } = await ctx.supabase.rpc('rpc_get_current_user_context');
    if (callerContextError || !callerContext?.is_super_admin) return json({ success: false, error: 'SUPER_ADMIN_REQUIRED' }, 403);

    const redirectTo = `${APP_ORIGIN}/reset-password.html?redirect=admin.html&gym=${encodeURIComponent(slug)}`;
    const { data: invited, error: inviteError } = await ctx.supabaseAdmin.auth.admin.inviteUserByEmail(ownerEmail, {
      data: { full_name: ownerName, phone: ownerPhone, role: 'GYM_OWNER', gym_slug: slug },
      redirectTo,
    });
    if (inviteError || !invited?.user) {
      const message = inviteError?.message ?? 'OWNER_INVITATION_FAILED';
      return json({ success: false, error: message }, /already.*registered|already.*exists/i.test(message) ? 409 : 400);
    }

    const ownerUserId = invited.user.id;
    const { data: result, error: rpcError } = await ctx.supabase.rpc('rpc_nexus_create_gym_for_owner', {
      p_owner_user_id: ownerUserId,
      p_gym_name: gymName,
      p_slug: slug,
      p_owner_phone: ownerPhone,
      p_owner_email: ownerEmail,
      p_owner_upi_id: ownerUpi,
      p_saas_fee: saasFee,
      p_validity_days: validityDays,
      p_pricing: pricing,
      p_feature_gates: featureGates,
      p_admin_pin_hash: adminPin || '1234',
    });

    if (rpcError || !result?.success) {
      try { await ctx.supabaseAdmin.auth.admin.deleteUser(ownerUserId); } catch (cleanupError) { console.error('[OWNER_ONBOARDING] Auth cleanup failed', cleanupError); }
      return json({ success: false, error: rpcError?.message ?? result?.error ?? 'GYM_PROVISIONING_FAILED' }, 400);
    }

    return json({ ...result, success: true, owner_email: ownerEmail, owner_user_id: ownerUserId, invitation_sent: true, auth_notice: 'Invitation email sent. Owner must open the email and set a password before first login.' });
  }),
};
