-- ============================================================================
-- MIGRATION: 20260825150000_align_gym_onboarding_rpc_with_live_schema.sql
-- DESCRIPTION: Align Super Admin gym provisioning with the current production schema
-- SAFETY: Atomic provisioning; no destructive schema/data changes.
-- ============================================================================

-- The earlier provisioning contract referenced a legacy gyms/plans schema
-- (owner_phone, owner_email, admin_pin, saas_fee, duration_months, etc.).
-- Production currently uses phone, email, admin_pin_hash, monthly_saas_fee,
-- duration_days, and the current app_role_type enum.
--
-- This replacement also hashes the owner PIN and password with pgcrypto,
-- matching the live security model used by the other RPCs.

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
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_is_super_admin boolean := false;
  v_gym_id integer;
  v_clean_slug text;
  v_auth_user_id uuid;
  v_encrypted_pw text;
  v_now timestamptz := now();
  v_gym_row record;
  v_email text := lower(btrim(p_owner_email));
  v_phone text := btrim(p_owner_phone);
  v_pin text := btrim(coalesce(p_admin_pin, '1234'));
BEGIN
  IF v_caller_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_caller_id AND role = 'super_admin'::public.app_role_type
    ) INTO v_is_super_admin;

    IF NOT v_is_super_admin THEN
      SELECT coalesce((u.raw_app_meta_data->>'is_super_admin')::boolean, false)
             OR (u.raw_app_meta_data->>'role' = 'SUPER_ADMIN')
      INTO v_is_super_admin
      FROM auth.users u
      WHERE u.id = v_caller_id;
    END IF;

    IF NOT v_is_super_admin THEN
      RAISE EXCEPTION 'Access Denied: Only SUPER_ADMIN accounts are authorized to provision new gym nodes.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_gym_name IS NULL OR length(btrim(p_gym_name)) < 2 OR length(btrim(p_gym_name)) > 120 THEN
    RAISE EXCEPTION 'Invalid gym name.' USING ERRCODE = '22023';
  END IF;

  v_clean_slug := lower(btrim(p_slug));
  v_clean_slug := regexp_replace(v_clean_slug, '[^a-z0-9-]+', '-', 'g');
  v_clean_slug := regexp_replace(v_clean_slug, '-+', '-', 'g');
  v_clean_slug := trim(both '-' from v_clean_slug);

  IF v_clean_slug = '' OR v_clean_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(v_clean_slug) > 80 THEN
    RAISE EXCEPTION 'Invalid gym slug.' USING ERRCODE = '22P02';
  END IF;

  IF v_email IS NULL OR v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'Invalid owner email.' USING ERRCODE = '22023';
  END IF;

  IF v_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Admin PIN must be exactly 4 digits.' USING ERRCODE = '22023';
  END IF;

  IF coalesce(p_saas_fee, 2499) < 0 THEN
    RAISE EXCEPTION 'Invalid SaaS fee.' USING ERRCODE = '22023';
  END IF;

  IF coalesce(p_validity_days, 365) <= 0 THEN
    RAISE EXCEPTION 'Invalid validity period.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (SELECT 1 FROM public.gyms WHERE slug = v_clean_slug AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Gym slug "%" is already registered.', v_clean_slug USING ERRCODE = '23505';
  END IF;

  SELECT u.id INTO v_auth_user_id
  FROM auth.users u
  WHERE lower(u.email) = v_email AND u.deleted_at IS NULL
  LIMIT 1;

  IF v_auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Owner email "%" is already registered. Use a unique owner email.', v_email USING ERRCODE = '23505';
  END IF;

  v_auth_user_id := extensions.gen_random_uuid();
  v_encrypted_pw := extensions.crypt(coalesce(p_owner_password, 'Nexus@2026!'), extensions.gen_salt('bf'));

  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_auth_user_id, 'authenticated', 'authenticated',
    v_email, v_encrypted_pw, v_now,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'GYM_OWNER', 'gym_slug', v_clean_slug),
    jsonb_build_object('role', 'GYM_OWNER', 'gym_slug', v_clean_slug, 'phone', v_phone, 'name', btrim(p_gym_name) || ' Owner'),
    v_now, v_now
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) VALUES (
    extensions.gen_random_uuid(), v_auth_user_id,
    jsonb_build_object('sub', v_auth_user_id::text, 'email', v_email),
    'email', v_email, v_now, v_now, v_now
  );

  INSERT INTO public.gyms (
    name, slug, phone, email, created_by, is_active, owner_upi_id, monthly_saas_fee,
    validity_days, pricing_plans, feature_gates, admin_pin_hash,
    pin_failed_attempts, pin_locked_until, deleted_at
  ) VALUES (
    btrim(p_gym_name), v_clean_slug, nullif(v_phone, ''), nullif(v_email, ''), v_auth_user_id, true,
    nullif(btrim(p_owner_upi_id), ''), coalesce(p_saas_fee, 2499), coalesce(p_validity_days, 365),
    coalesce(p_pricing, '{}'::jsonb), coalesce(p_feature_gates, '{}'::jsonb),
    extensions.crypt(v_pin, extensions.gen_salt('bf')), 0, NULL, NULL
  ) RETURNING id, name, slug, phone, email, is_active, owner_upi_id, monthly_saas_fee, validity_days INTO v_gym_row;

  v_gym_id := v_gym_row.id;

  INSERT INTO public.user_roles (user_id, gym_id, role)
  VALUES (v_auth_user_id, v_gym_id, 'owner'::public.app_role_type)
  ON CONFLICT (user_id, gym_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.plans (gym_id, name, duration_days, price, description, is_active)
  VALUES
    (v_gym_id, '1 Month Classic', 30, coalesce((p_pricing->>'plan_1m_price')::numeric, 1200), 'Classic 1-month membership', true),
    (v_gym_id, '3 Month Standard', 90, coalesce((p_pricing->>'plan_3m_price')::numeric, 3200), 'Standard 3-month membership', true),
    (v_gym_id, '6 Month Pro', 180, coalesce((p_pricing->>'plan_6m_price')::numeric, 5800), 'Pro 6-month membership', true),
    (v_gym_id, '12 Month VIP Elite', 365, coalesce((p_pricing->>'plan_12m_price')::numeric, 10500), 'VIP Elite 12-month membership', true);

  RETURN jsonb_build_object(
    'success', true, 'gym_id', v_gym_id, 'user_id', v_auth_user_id, 'auth_user_id', v_auth_user_id,
    'gym', jsonb_build_object(
      'id', v_gym_row.id, 'name', v_gym_row.name, 'slug', v_gym_row.slug,
      'phone', v_gym_row.phone, 'email', v_gym_row.email, 'is_active', v_gym_row.is_active,
      'owner_upi_id', v_gym_row.owner_upi_id, 'monthly_saas_fee', v_gym_row.monthly_saas_fee,
      'validity_days', v_gym_row.validity_days
    )
  )::json;
END;
$$;
