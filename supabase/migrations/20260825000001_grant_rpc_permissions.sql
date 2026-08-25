-- ============================================================================
-- MIGRATION: 20260825000001_grant_rpc_permissions.sql
-- DESCRIPTION: Authoritative Security-Definer RPC Contracts and Grants
-- TARGET: Supabase PostgreSQL (PostgREST API)
-- SAFETY: Idempotent, non-destructive, does not drop tables, alters no business data
-- ============================================================================

-- 1. Authoritative Super Admin Gym & Owner Provisioning Engine
CREATE OR REPLACE FUNCTION public.rpc_create_gym_with_owner(
  p_gym_name text,
  p_slug text,
  p_owner_phone text,
  p_owner_email text,
  p_owner_password text,
  p_admin_pin text DEFAULT '1234',
  p_owner_upi_id text DEFAULT NULL,
  p_saas_fee numeric DEFAULT 2499,
  p_validity_days integer DEFAULT 365,
  p_pricing jsonb DEFAULT '{"plan_1m_price": 1200, "plan_3m_price": 3200, "plan_6m_price": 5800, "plan_12m_price": 10500}'::jsonb,
  p_feature_gates jsonb DEFAULT '{"workouts": true, "nutrition": true, "qr_attendance": true, "notices": true}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_id uuid;
  v_is_super_admin boolean := false;
  v_gym_id bigint;
  v_clean_slug text;
  v_auth_user_id uuid;
  v_encrypted_pw text;
  v_now timestamptz := now();
  v_expiry timestamptz;
  v_gym_row record;
BEGIN
  -- A. Verify caller authorization: MUST be SUPER_ADMIN
  v_caller_id := auth.uid();
  
  IF v_caller_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = v_caller_id 
        AND (role ILIKE '%SUPER_ADMIN%' OR role = 'SUPER_ADMIN')
    ) INTO v_is_super_admin;

    IF NOT v_is_super_admin THEN
      SELECT COALESCE((raw_app_meta_data->>'is_super_admin')::boolean, false) OR (raw_app_meta_data->>'role' = 'SUPER_ADMIN')
      INTO v_is_super_admin
      FROM auth.users
      WHERE id = v_caller_id;
    END IF;
  END IF;

  -- Service role or bootstrap bypass allowed if caller is super_admin or internal
  IF v_caller_id IS NOT NULL AND NOT v_is_super_admin THEN
    RAISE EXCEPTION 'Access Denied: Only SUPER_ADMIN accounts are authorized to provision new gym nodes.'
      USING ERRCODE = '42501';
  END IF;

  -- B. Sanitize Slug
  v_clean_slug := lower(regexp_replace(p_slug, '[^a-zA-Z0-9\-]+', '-', 'g'));
  v_clean_slug := trim(both '-' from v_clean_slug);
  IF v_clean_slug = '' THEN
    v_clean_slug := 'gym-' || substr(md5(random()::text), 1, 6);
  END IF;

  -- Check slug uniqueness
  IF EXISTS (SELECT 1 FROM public.gyms WHERE slug = v_clean_slug) THEN
    RAISE EXCEPTION 'Gym slug "%" is already registered.', v_clean_slug
      USING ERRCODE = '23505';
  END IF;

  v_expiry := v_now + (COALESCE(p_validity_days, 365) || ' days')::interval;

  -- C. Provision Auth User for Owner if not exists
  SELECT id INTO v_auth_user_id FROM auth.users WHERE email = lower(trim(p_owner_email));

  IF v_auth_user_id IS NULL THEN
    v_auth_user_id := extensions.gen_random_uuid();
    v_encrypted_pw := crypt(COALESCE(p_owner_password, 'Nexus@2026!'), gen_salt('bf'));

    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_auth_user_id,
      'authenticated',
      'authenticated',
      lower(trim(p_owner_email)),
      v_encrypted_pw,
      v_now,
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'GYM_OWNER', 'gym_slug', v_clean_slug),
      jsonb_build_object('role', 'GYM_OWNER', 'gym_slug', v_clean_slug, 'phone', p_owner_phone, 'name', p_gym_name || ' Owner'),
      v_now,
      v_now
    );

    -- Also insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      extensions.gen_random_uuid(),
      v_auth_user_id,
      jsonb_build_object('sub', v_auth_user_id::text, 'email', lower(trim(p_owner_email))),
      'email',
      lower(trim(p_owner_email)),
      v_now,
      v_now,
      v_now
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- D. Insert Gym Record
  INSERT INTO public.gyms (
    name,
    slug,
    owner_phone,
    owner_email,
    admin_pin,
    owner_upi_id,
    saas_fee,
    valid_until,
    pricing,
    features,
    status,
    op_status,
    created_at,
    updated_at
  ) VALUES (
    p_gym_name,
    v_clean_slug,
    p_owner_phone,
    lower(trim(p_owner_email)),
    COALESCE(p_admin_pin, '1234'),
    p_owner_upi_id,
    COALESCE(p_saas_fee, 2499),
    v_expiry,
    COALESCE(p_pricing, '{"plan_1m_price": 1200, "plan_3m_price": 3200, "plan_6m_price": 5800, "plan_12m_price": 10500}'::jsonb),
    COALESCE(p_feature_gates, '{"workouts": true, "nutrition": true, "qr_attendance": true, "notices": true}'::jsonb),
    'ACTIVE',
    'OPEN',
    v_now,
    v_now
  )
  RETURNING id, name, slug, owner_phone, owner_email, admin_pin, status INTO v_gym_row;

  v_gym_id := v_gym_row.id;

  -- E. Link User Role
  INSERT INTO public.user_roles (
    user_id,
    gym_id,
    role,
    created_at
  ) VALUES (
    v_auth_user_id,
    v_gym_id,
    'GYM_OWNER',
    v_now
  ) ON CONFLICT DO NOTHING;

  -- F. Create Default Membership Plans for this gym if plans table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'plans') THEN
    INSERT INTO public.plans (gym_id, name, duration_months, price, is_active, created_at)
    VALUES
      (v_gym_id, '1 Month Classic', 1, COALESCE((p_pricing->>'plan_1m_price')::numeric, 1200), true, v_now),
      (v_gym_id, '3 Month Standard', 3, COALESCE((p_pricing->>'plan_3m_price')::numeric, 3200), true, v_now),
      (v_gym_id, '6 Month Pro', 6, COALESCE((p_pricing->>'plan_6m_price')::numeric, 5800), true, v_now),
      (v_gym_id, '12 Month VIP Elite', 12, COALESCE((p_pricing->>'plan_12m_price')::numeric, 10500), true, v_now)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'gym_id', v_gym_id,
    'user_id', v_auth_user_id,
    'auth_user_id', v_auth_user_id,
    'gym', jsonb_build_object(
      'id', v_gym_id,
      'name', v_gym_row.name,
      'slug', v_gym_row.slug,
      'owner_phone', v_gym_row.owner_phone,
      'owner_email', v_gym_row.owner_email,
      'admin_pin', v_gym_row.admin_pin,
      'status', v_gym_row.status
    )
  );
END;
$$;

-- 2. Authoritative Current User Context Resolution
CREATE OR REPLACE FUNCTION public.rpc_get_current_user_context()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_user record;
  v_roles jsonb := '[]'::jsonb;
  v_is_super boolean := false;
  v_primary_gym_id bigint;
  v_primary_gym_slug text;
  v_primary_role text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'authenticated', false,
      'error', 'Not authenticated'
    );
  END IF;

  SELECT * INTO v_user FROM auth.users WHERE id = v_user_id;
  
  -- Check user_roles
  SELECT 
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'gym_id', ur.gym_id,
          'gym_slug', g.slug,
          'gym_name', g.name,
          'role', ur.role
        )
      ), 
      '[]'::jsonb
    )
  INTO v_roles
  FROM public.user_roles ur
  LEFT JOIN public.gyms g ON g.id = ur.gym_id
  WHERE ur.user_id = v_user_id;

  -- Determine Super Admin status
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = v_user_id AND (role ILIKE '%SUPER_ADMIN%' OR role = 'SUPER_ADMIN')
  ) INTO v_is_super;

  IF NOT v_is_super AND v_user.raw_app_meta_data IS NOT NULL THEN
    v_is_super := COALESCE((v_user.raw_app_meta_data->>'is_super_admin')::boolean, false) OR 
                  (v_user.raw_app_meta_data->>'role' = 'SUPER_ADMIN') OR
                  (v_user.raw_user_meta_data->>'is_super_admin')::boolean;
  END IF;

  -- Pick primary role
  IF jsonb_array_length(v_roles) > 0 THEN
    v_primary_role := v_roles->0->>'role';
    v_primary_gym_id := (v_roles->0->>'gym_id')::bigint;
    v_primary_gym_slug := v_roles->0->>'gym_slug';
  ELSE
    v_primary_role := COALESCE(v_user.raw_app_meta_data->>'role', v_user.raw_user_meta_data->>'role', 'MEMBER');
    v_primary_gym_slug := COALESCE(v_user.raw_app_meta_data->>'gym_slug', v_user.raw_user_meta_data->>'gym_slug');
  END IF;

  IF v_is_super THEN
    v_primary_role := 'SUPER_ADMIN';
  END IF;

  RETURN jsonb_build_object(
    'authenticated', true,
    'user_id', v_user_id,
    'email', v_user.email,
    'role', v_primary_role,
    'is_super_admin', v_is_super,
    'gym_id', v_primary_gym_id,
    'gym_slug', v_primary_gym_slug,
    'roles', v_roles
  );
END;
$$;

-- 3. Pass Claiming Function
CREATE OR REPLACE FUNCTION public.rpc_claim_member_pass(
  p_gym_id bigint,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_clean_phone text;
  v_member record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_clean_phone := right(regexp_replace(p_phone, '\D', '', 'g'), 10);

  UPDATE public.members
  SET profile_id = v_user_id
  WHERE (phone = v_clean_phone OR phone = ('+91' || v_clean_phone) OR normalized_phone = v_clean_phone)
    AND gym_id = p_gym_id
  RETURNING * INTO v_member;

  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No matching athlete record found for this phone number.');
  END IF;

  RETURN jsonb_build_object('success', true, 'member', row_to_json(v_member));
END;
$$;

-- 4. Public Athlete Pass HUD Retrieval
CREATE OR REPLACE FUNCTION public.rpc_get_member_hud_pass(
  p_gym_slug text,
  p_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gym_id bigint;
  v_clean_phone text;
  v_member record;
  v_active_membership record;
  v_plan_name text := 'Standard Pass';
  v_status text := 'ACTIVE';
  v_valid_until timestamptz;
BEGIN
  SELECT id INTO v_gym_id FROM public.gyms WHERE slug = p_gym_slug;
  IF v_gym_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_clean_phone := right(regexp_replace(p_phone, '\D', '', 'g'), 10);

  SELECT * INTO v_member FROM public.members
  WHERE (phone = v_clean_phone OR phone = ('+91' || v_clean_phone) OR normalized_phone = v_clean_phone)
    AND gym_id = v_gym_id
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT mm.*, p.name as p_name INTO v_active_membership
  FROM public.member_memberships mm
  LEFT JOIN public.plans p ON p.id = mm.plan_id
  WHERE mm.member_id = v_member.id
  ORDER BY mm.end_date DESC
  LIMIT 1;

  IF v_active_membership.id IS NOT NULL THEN
    v_plan_name := COALESCE(v_active_membership.p_name, 'Standard Pass');
    v_valid_until := v_active_membership.end_date;
    v_status := COALESCE(v_active_membership.status, 'ACTIVE');
  ELSE
    v_valid_until := COALESCE(v_member.valid_until, v_member.expiry_date, v_member.created_at);
    v_status := CASE WHEN v_member.is_active = false THEN 'INACTIVE' ELSE 'ACTIVE' END;
  END IF;

  RETURN jsonb_build_object(
    'id', v_member.id,
    'full_name', v_member.full_name,
    'phone', v_clean_phone,
    'normalized_phone', v_clean_phone,
    'gender', v_member.gender,
    'photo_url', v_member.photo_url,
    'streak_count', COALESCE(v_member.streak_count, 0),
    'valid_until', v_valid_until,
    'plan_name', v_plan_name,
    'status', v_status,
    'referral_code', v_member.referral_code
  );
END;
$$;

-- 5. Staff Quick PIN Unlock
CREATE OR REPLACE FUNCTION public.rpc_staff_quick_pin_unlock(
  p_gym_id bigint,
  p_pin text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored_pin text;
BEGIN
  SELECT admin_pin INTO v_stored_pin FROM public.gyms WHERE id = p_gym_id;
  
  IF v_stored_pin IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Gym not found.');
  END IF;

  IF v_stored_pin = trim(p_pin) THEN
    RETURN jsonb_build_object('success', true, 'gym_id', p_gym_id);
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect PIN code.');
  END IF;
END;
$$;

-- 6. Secure Pass Renewal
CREATE OR REPLACE FUNCTION public.secure_renew_pass(
  p_member_id bigint,
  p_months integer,
  p_amount numeric DEFAULT 0,
  p_payment_method text DEFAULT 'CASH'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_member record;
  v_curr_expiry timestamptz;
  v_new_expiry timestamptz;
  v_now timestamptz := now();
BEGIN
  SELECT * INTO v_member FROM public.members WHERE id = p_member_id;
  IF v_member.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found.');
  END IF;

  v_curr_expiry := COALESCE(v_member.valid_until, v_member.expiry_date, v_now);
  IF v_curr_expiry < v_now THEN
    v_curr_expiry := v_now;
  END IF;

  v_new_expiry := v_curr_expiry + (COALESCE(p_months, 1) || ' months')::interval;

  UPDATE public.members
  SET valid_until = v_new_expiry,
      expiry_date = v_new_expiry,
      is_active = true,
      updated_at = v_now
  WHERE id = p_member_id;

  -- Record payment if amount > 0
  IF COALESCE(p_amount, 0) > 0 THEN
    INSERT INTO public.payments (
      gym_id,
      member_id,
      amount,
      payment_method,
      payment_date,
      status,
      created_at
    ) VALUES (
      v_member.gym_id,
      p_member_id,
      p_amount,
      COALESCE(p_payment_method, 'CASH'),
      v_now,
      'COMPLETED',
      v_now
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'member_id', p_member_id,
    'new_expiry', v_new_expiry
  );
END;
$$;

-- ============================================================================
-- EXPLICIT GRANT STATEMENTS FOR POSTGREST & SUPABASE AUTH ROLES
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.rpc_create_gym_with_owner(text, text, text, text, text, text, text, numeric, integer, jsonb, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_current_user_context() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_claim_member_pass(bigint, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_get_member_hud_pass(text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_staff_quick_pin_unlock(bigint, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.secure_renew_pass(bigint, integer, numeric, text) TO authenticated, service_role;
