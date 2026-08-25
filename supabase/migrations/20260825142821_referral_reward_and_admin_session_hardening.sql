-- Referral rewards are enforced at the database boundary so every registration path
-- applies the same 7-day reward exactly once.

CREATE UNIQUE INDEX IF NOT EXISTS uq_referral_ledger_triplet
  ON public.referral_ledger (gym_id, referrer_member_id, referred_member_id);

CREATE OR REPLACE FUNCTION public.trg_apply_referral_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_referrer_id uuid;
  v_referrer_code text;
BEGIN
  SELECT m.referred_by_member_id
    INTO v_referrer_id
  FROM public.members m
  WHERE m.id = NEW.member_id
    AND m.gym_id = NEW.gym_id
    AND m.deleted_at IS NULL;

  IF v_referrer_id IS NULL OR v_referrer_id = NEW.member_id THEN
    RETURN NEW;
  END IF;

  SELECT m.id, m.referral_code
    INTO v_referrer_id, v_referrer_code
  FROM public.members m
  WHERE m.id = v_referrer_id
    AND m.gym_id = NEW.gym_id
    AND m.deleted_at IS NULL
  FOR UPDATE;

  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.referral_ledger rl
    WHERE rl.gym_id = NEW.gym_id
      AND rl.referrer_member_id = v_referrer_id
      AND rl.referred_member_id = NEW.member_id
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.member_memberships mm
  SET end_date = greatest(mm.end_date, CURRENT_DATE) + 7,
      updated_at = CURRENT_TIMESTAMP
  WHERE mm.id = (
    SELECT mm2.id
    FROM public.member_memberships mm2
    WHERE mm2.gym_id = NEW.gym_id
      AND mm2.member_id = v_referrer_id
    ORDER BY mm2.end_date DESC, mm2.created_at DESC
    LIMIT 1
  );

  INSERT INTO public.referral_ledger (
    gym_id, referrer_member_id, referred_member_id, referral_code,
    reward_amount, status, notes, created_at, updated_at
  ) VALUES (
    NEW.gym_id, v_referrer_id, NEW.member_id, coalesce(v_referrer_code, ''),
    7, 'credited'::public.referral_status_type,
    '7-day referral reward', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_member_memberships_apply_referral_reward ON public.member_memberships;
CREATE TRIGGER trg_member_memberships_apply_referral_reward
AFTER INSERT ON public.member_memberships
FOR EACH ROW EXECUTE FUNCTION public.trg_apply_referral_reward();

-- Keep the legacy RPC compatible with the trigger and retain atomic registration.
CREATE OR REPLACE FUNCTION public.register_member_with_referral(
  p_gym_slug text, p_name text, p_phone text, p_age integer, p_address text,
  p_photo_url text, p_plan_months integer, p_fees_paid numeric, p_referrer_phone text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_gym_id integer;
  v_clean text := right(regexp_replace(coalesce(p_phone,''),'\\D','','g'),10);
  v_ref text := right(regexp_replace(coalesce(p_referrer_phone,''),'\\D','','g'),10);
  v_member_id uuid;
  v_plan_id uuid;
  v_membership_id uuid;
  v_referrer_id uuid;
  v_referral_credited boolean := false;
  v_start date := CURRENT_DATE;
  v_end date;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  SELECT g.id INTO v_gym_id FROM public.gyms g
  WHERE g.slug=btrim(p_gym_slug) AND g.is_active=true AND g.deleted_at IS NULL;
  IF v_gym_id IS NULL THEN RAISE EXCEPTION 'GYM_NOT_FOUND'; END IF;
  IF NOT public.has_gym_role(v_gym_id::bigint,ARRAY['owner','manager','staff']::text[]) THEN
    RAISE EXCEPTION 'MEMBER_MANAGEMENT_DENIED';
  END IF;
  IF NULLIF(btrim(p_name),'') IS NULL THEN RAISE EXCEPTION 'FULL_NAME_REQUIRED'; END IF;
  IF length(v_clean) < 10 THEN RAISE EXCEPTION 'INVALID_PHONE'; END IF;
  IF p_plan_months IS NULL OR p_plan_months <= 0 OR p_plan_months > 120 THEN
    RAISE EXCEPTION 'INVALID_PLAN_DURATION';
  END IF;
  IF EXISTS (SELECT 1 FROM public.members m
             WHERE m.gym_id=v_gym_id AND m.normalized_phone=v_clean AND m.deleted_at IS NULL) THEN
    RAISE EXCEPTION 'MEMBER_PHONE_ALREADY_EXISTS';
  END IF;

  SELECT p.id INTO v_plan_id
  FROM public.plans p
  WHERE p.gym_id=v_gym_id AND p.is_active=true AND p.duration_days=p_plan_months*30
  ORDER BY p.price ASC,p.created_at ASC LIMIT 1;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'PLAN_NOT_FOUND_FOR_DURATION'; END IF;

  INSERT INTO public.members(
    gym_id,full_name,phone,age,address,baseline_photo_path,referral_code,
    referred_by_member_id,is_active,created_at,updated_at,deleted_at
  ) VALUES (
    v_gym_id,btrim(p_name),btrim(p_phone),p_age,NULLIF(btrim(p_address),''),
    NULLIF(btrim(p_photo_url),''),
    upper(substr(md5(v_gym_id::text||':'||v_clean||':'||clock_timestamp()::text),1,10)),
    NULL,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,NULL
  ) RETURNING id INTO v_member_id;

  IF length(v_ref)=10 THEN
    SELECT m.id INTO v_referrer_id
    FROM public.members m
    WHERE m.gym_id=v_gym_id AND m.normalized_phone=v_ref AND m.deleted_at IS NULL;
    IF v_referrer_id IS NOT NULL AND v_referrer_id <> v_member_id THEN
      UPDATE public.members SET referred_by_member_id=v_referrer_id WHERE id=v_member_id;
    END IF;
  END IF;

  v_end := v_start + (p_plan_months*30) - 1;
  INSERT INTO public.member_memberships(
    gym_id,member_id,plan_id,start_date,end_date,status,created_at,updated_at
  ) VALUES (
    v_gym_id,v_member_id,v_plan_id,v_start,v_end,'active'::public.membership_status_type,
    CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
  ) RETURNING id INTO v_membership_id;

  IF coalesce(p_fees_paid,0) > 0 THEN
    INSERT INTO public.payments(
      gym_id,member_id,membership_id,amount,payment_method,payment_status,
      transaction_ref,recorded_by_user_id,notes,created_at
    ) VALUES (
      v_gym_id,v_member_id,v_membership_id,p_fees_paid,'other'::public.payment_method_type,
      'completed'::public.payment_status_type,NULL,v_uid,'Legacy registration payment',CURRENT_TIMESTAMP
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.referral_ledger rl
    WHERE rl.gym_id=v_gym_id AND rl.referred_member_id=v_member_id
  ) INTO v_referral_credited;

  RETURN jsonb_build_object(
    'success',true,'member_id',v_member_id,'membership_id',v_membership_id,
    'referrer_credited',v_referral_credited
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_member_with_referral(
  text,text,text,integer,text,text,integer,numeric,text
) TO authenticated;
