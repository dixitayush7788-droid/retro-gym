-- Stabilize tenant auth/admin compatibility and member transaction defaults.
-- Additive only; no destructive schema/data changes.

ALTER TABLE public.gyms
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN IF NOT EXISTS op_status text NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS notice_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delayed_time text NOT NULL DEFAULT '5:00 PM',
  ADD COLUMN IF NOT EXISTS logo_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gym_name text,
  ADD COLUMN IF NOT EXISTS gym_tagline text,
  ADD COLUMN IF NOT EXISTS upi_id text,
  ADD COLUMN IF NOT EXISTS owner_upi text,
  ADD COLUMN IF NOT EXISTS owner_phone text,
  ADD COLUMN IF NOT EXISTS support_phone text,
  ADD COLUMN IF NOT EXISTS plan_1m_price numeric NOT NULL DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS plan_3m_price numeric NOT NULL DEFAULT 3200,
  ADD COLUMN IF NOT EXISTS plan_6m_price numeric NOT NULL DEFAULT 5800,
  ADD COLUMN IF NOT EXISTS plan_12m_price numeric NOT NULL DEFAULT 10500,
  ADD COLUMN IF NOT EXISTS pricing jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{"workouts":true,"nutrition":true,"qr_attendance":true,"notices":true}'::jsonb,
  ADD COLUMN IF NOT EXISTS monthly_fee numeric,
  ADD COLUMN IF NOT EXISTS saas_fee numeric,
  ADD COLUMN IF NOT EXISTS monthly_fee_validity_days integer,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_expires_at timestamptz;

UPDATE public.gyms
SET gym_name = coalesce(gym_name, name),
    gym_tagline = coalesce(nullif(gym_tagline, ''), nullif(tagline, ''), name || ' • DIGITAL COMMAND DESK'),
    owner_phone = coalesce(owner_phone, phone),
    support_phone = coalesce(support_phone, phone),
    upi_id = coalesce(upi_id, owner_upi_id),
    owner_upi = coalesce(owner_upi, owner_upi_id),
    monthly_fee = coalesce(monthly_fee, monthly_saas_fee),
    saas_fee = coalesce(saas_fee, monthly_saas_fee),
    monthly_fee_validity_days = coalesce(monthly_fee_validity_days, validity_days),
    pricing = case when pricing = '{}'::jsonb then pricing_plans else pricing end,
    features = case when features = '{"workouts":true,"nutrition":true,"qr_attendance":true,"notices":true}'::jsonb then feature_gates else features end,
    plan_1m_price = coalesce(nullif((pricing_plans->>'plan_1m_price')::numeric, 0), plan_1m_price),
    plan_3m_price = coalesce(nullif((pricing_plans->>'plan_3m_price')::numeric, 0), plan_3m_price),
    plan_6m_price = coalesce(nullif((pricing_plans->>'plan_6m_price')::numeric, 0), plan_6m_price),
    plan_12m_price = coalesce(nullif((pricing_plans->>'plan_12m_price')::numeric, 0), plan_12m_price),
    status = case when is_active then 'ACTIVE' else 'INACTIVE' end,
    expires_at = coalesce(expires_at, now() + make_interval(days => validity_days)),
    subscription_expires_at = coalesce(subscription_expires_at, now() + make_interval(days => validity_days));

CREATE OR REPLACE FUNCTION public.trg_sync_gym_compat_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.gym_name := coalesce(nullif(NEW.gym_name, ''), NEW.name);
  NEW.gym_tagline := coalesce(nullif(NEW.gym_tagline, ''), nullif(NEW.tagline, ''), NEW.name || ' • DIGITAL COMMAND DESK');
  NEW.tagline := coalesce(nullif(NEW.tagline, ''), NEW.gym_tagline);
  NEW.owner_phone := coalesce(nullif(NEW.owner_phone, ''), NEW.phone);
  NEW.support_phone := coalesce(nullif(NEW.support_phone, ''), NEW.phone);
  NEW.upi_id := coalesce(nullif(NEW.upi_id, ''), NEW.owner_upi_id);
  NEW.owner_upi := coalesce(nullif(NEW.owner_upi, ''), NEW.owner_upi_id);
  NEW.monthly_fee := coalesce(NEW.monthly_fee, NEW.monthly_saas_fee);
  NEW.saas_fee := coalesce(NEW.saas_fee, NEW.monthly_saas_fee);
  NEW.monthly_fee_validity_days := coalesce(NEW.monthly_fee_validity_days, NEW.validity_days);
  NEW.pricing := coalesce(NEW.pricing, NEW.pricing_plans);
  NEW.features := coalesce(NEW.features, NEW.feature_gates);
  IF TG_OP = 'UPDATE' AND NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.status := CASE WHEN NEW.is_active THEN 'ACTIVE' ELSE 'INACTIVE' END;
  END IF;
  IF NEW.status = 'INACTIVE' THEN NEW.is_active := false; END IF;
  IF NEW.status = 'ACTIVE' THEN NEW.is_active := true; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_gyms_sync_compat_fields ON public.gyms;
CREATE TRIGGER trg_gyms_sync_compat_fields BEFORE INSERT OR UPDATE ON public.gyms
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_gym_compat_fields();

ALTER TABLE public.attendance ALTER COLUMN attendance_date SET DEFAULT CURRENT_DATE;
ALTER TABLE public.payments ALTER COLUMN payment_status SET DEFAULT 'completed'::public.payment_status_type;

CREATE OR REPLACE FUNCTION public.trg_normalize_membership_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_duration integer;
BEGIN
  NEW.status := lower(NEW.status::text)::public.membership_status_type;
  IF NEW.plan_id IS NULL THEN
    v_duration := greatest(1, (NEW.end_date - NEW.start_date));
    SELECT p.id INTO NEW.plan_id FROM public.plans p
    WHERE p.gym_id = NEW.gym_id AND p.is_active = true
      AND p.duration_days BETWEEN greatest(1, v_duration - 2) AND v_duration + 2
    ORDER BY abs(p.duration_days - v_duration), p.price LIMIT 1;
    IF NEW.plan_id IS NULL THEN
      SELECT p.id INTO NEW.plan_id FROM public.plans p
      WHERE p.gym_id = NEW.gym_id AND p.is_active = true
      ORDER BY p.duration_days LIMIT 1;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_member_memberships_normalize_insert ON public.member_memberships;
CREATE TRIGGER trg_member_memberships_normalize_insert BEFORE INSERT ON public.member_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_membership_insert();

CREATE OR REPLACE FUNCTION public.trg_normalize_payment_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  NEW.payment_method := lower(NEW.payment_method::text)::public.payment_method_type;
  IF NEW.payment_status IS NULL THEN NEW.payment_status := 'completed'::public.payment_status_type; END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_payments_normalize_insert ON public.payments;
CREATE TRIGGER trg_payments_normalize_insert BEFORE INSERT ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_payment_insert();

CREATE OR REPLACE FUNCTION public.rpc_get_current_user_context()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, auth AS $$
DECLARE v_uid uuid := auth.uid(); v_roles json; v_primary_role text; v_primary_gym_id integer; v_primary_slug text;
BEGIN
  IF v_uid IS NULL THEN RETURN json_build_object('authenticated', false); END IF;
  SELECT coalesce(json_agg(json_build_object('gym_id', ur.gym_id,
    'role', CASE ur.role::text WHEN 'owner' THEN 'GYM_OWNER' WHEN 'manager' THEN 'MANAGER' WHEN 'staff' THEN 'STAFF' WHEN 'trainer' THEN 'TRAINER' WHEN 'super_admin' THEN 'SUPER_ADMIN' ELSE upper(ur.role::text) END,
    'gym_slug', g.slug, 'gym_name', g.name) ORDER BY (ur.gym_id IS NULL) DESC, ur.gym_id), '[]'::json)
  INTO v_roles FROM public.user_roles ur LEFT JOIN public.gyms g ON g.id = ur.gym_id WHERE ur.user_id = v_uid;
  SELECT CASE ur.role::text WHEN 'owner' THEN 'GYM_OWNER' WHEN 'manager' THEN 'MANAGER' WHEN 'staff' THEN 'STAFF' WHEN 'trainer' THEN 'TRAINER' WHEN 'super_admin' THEN 'SUPER_ADMIN' ELSE upper(ur.role::text) END, ur.gym_id, g.slug
  INTO v_primary_role, v_primary_gym_id, v_primary_slug FROM public.user_roles ur LEFT JOIN public.gyms g ON g.id = ur.gym_id
  WHERE ur.user_id = v_uid ORDER BY (ur.role::text = 'super_admin') DESC, (ur.gym_id IS NULL) DESC, ur.gym_id LIMIT 1;
  RETURN json_build_object('authenticated', true, 'user_id', v_uid, 'role', coalesce(v_primary_role, 'GYM_OWNER'), 'gym_id', v_primary_gym_id, 'gym_slug', v_primary_slug, 'is_super_admin', public.is_super_admin(), 'roles', v_roles);
END; $$;
