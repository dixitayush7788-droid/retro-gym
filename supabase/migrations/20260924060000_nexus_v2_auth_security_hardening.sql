-- NEXUS V2 auth security hardening / replayable source-of-truth
create table if not exists public.member_auth_security (
  id uuid primary key default gen_random_uuid(),
  gym_id integer not null references public.gyms(id) on delete cascade,
  member_id uuid references public.members(id) on delete cascade,
  normalized_phone text not null,
  event text not null,
  success boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists member_auth_security_lookup_idx on public.member_auth_security(gym_id,normalized_phone,created_at desc);
create index if not exists member_auth_security_member_idx on public.member_auth_security(member_id,created_at desc);
alter table public.member_auth_security enable row level security;
revoke all on public.member_auth_security from anon,authenticated,public;

alter table public.members add column if not exists pin_failed_attempts integer not null default 0;
alter table public.members add column if not exists pin_locked_until timestamptz;
alter table public.members add column if not exists pin_must_change boolean not null default false;
create index if not exists members_pin_lock_idx on public.members(gym_id,pin_locked_until) where pin_locked_until is not null;

create or replace function public.rpc_member_auth_start(p_gym_slug text,p_phone text) returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','extensions' as $function$
declare v_gym_id integer; v_member public.members%rowtype; v_phone text;
begin
 v_phone:=right(regexp_replace(coalesce(p_phone,''),'\\D','','g'),10);
 if length(v_phone)<>10 then return jsonb_build_object('success',false,'error','Enter a valid 10-digit mobile number'); end if;
 select id into v_gym_id from public.gyms where lower(slug)=lower(btrim(p_gym_slug)) and is_active and deleted_at is null limit 1;
 if v_gym_id is null then return jsonb_build_object('success',false,'error','Gym not found'); end if;
 select * into v_member from public.members where gym_id=v_gym_id and normalized_phone=v_phone and is_active and deleted_at is null limit 1;
 insert into public.member_auth_security(gym_id,member_id,normalized_phone,event,success) values(v_gym_id,v_member.id,v_phone,'AUTH_START',v_member.id is not null);
 if v_member.id is null then return jsonb_build_object('success',false,'error','Athlete not found'); end if;
 if v_member.pin_locked_until is not null and v_member.pin_locked_until>now() then return jsonb_build_object('success',false,'error','Too many attempts. Try again later.','locked_until',v_member.pin_locked_until); end if;
 return jsonb_build_object('success',true,'member_id',v_member.id,'gym_id',v_member.gym_id,'full_name',v_member.full_name,'phone',v_member.normalized_phone,'has_pin',v_member.pin_hash is not null,'pin_must_change',v_member.pin_must_change);
end $function$;

create or replace function public.rpc_member_set_pin(p_gym_slug text,p_phone text,p_pin text) returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','extensions' as $function$
declare v_gym_id integer; v_member public.members%rowtype; v_phone text;
begin
 v_phone:=right(regexp_replace(coalesce(p_phone,''),'\\D','','g'),10);
 if p_pin !~ '^[0-9]{4}$' then return jsonb_build_object('success',false,'error','PIN must be exactly 4 digits'); end if;
 select id into v_gym_id from public.gyms where lower(slug)=lower(btrim(p_gym_slug)) and is_active and deleted_at is null limit 1;
 if v_gym_id is null then return jsonb_build_object('success',false,'error','Gym not found'); end if;
 select * into v_member from public.members where gym_id=v_gym_id and normalized_phone=v_phone and is_active and deleted_at is null limit 1;
 if v_member.id is null then return jsonb_build_object('success',false,'error','Athlete not found'); end if;
 if v_member.pin_locked_until is not null and v_member.pin_locked_until>now() then return jsonb_build_object('success',false,'error','Too many attempts. Try again later.'); end if;
 if v_member.pin_hash is not null then return jsonb_build_object('success',false,'error','PIN already set'); end if;
 update public.members set pin_hash=extensions.crypt(p_pin,extensions.gen_salt('bf')),pin_failed_attempts=0,pin_locked_until=null,pin_must_change=true,updated_at=now() where id=v_member.id;
 insert into public.member_auth_security(gym_id,member_id,normalized_phone,event,success) values(v_gym_id,v_member.id,v_phone,'PIN_SET',true);
 return jsonb_build_object('success',true,'member_id',v_member.id,'pin_must_change',true);
end $function$;

create or replace function public.rpc_member_verify_pin(p_gym_slug text,p_phone text,p_pin text) returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','extensions' as $function$
declare v_gym_id integer; v_member public.members%rowtype; v_phone text; v_mm record; v_token text; v_session_id uuid;
begin
 v_phone:=right(regexp_replace(coalesce(p_phone,''),'\\D','','g'),10);
 if p_pin !~ '^[0-9]{4}$' then return jsonb_build_object('success',false,'error','PIN must be exactly 4 digits'); end if;
 select id into v_gym_id from public.gyms where lower(slug)=lower(btrim(p_gym_slug)) and is_active and deleted_at is null limit 1;
 if v_gym_id is null then return jsonb_build_object('success',false,'error','Gym not found'); end if;
 select * into v_member from public.members where gym_id=v_gym_id and normalized_phone=v_phone and is_active and deleted_at is null limit 1;
 if v_member.id is null then return jsonb_build_object('success',false,'error','Athlete not found'); end if;
 if v_member.pin_locked_until is not null and v_member.pin_locked_until>now() then return jsonb_build_object('success',false,'error','Too many attempts. Try again later.','locked_until',v_member.pin_locked_until); end if;
 if v_member.pin_hash is null then return jsonb_build_object('success',false,'error','PIN setup required'); end if;
 if extensions.crypt(p_pin,v_member.pin_hash)<>v_member.pin_hash then
   update public.members set pin_failed_attempts=pin_failed_attempts+1,pin_locked_until=case when pin_failed_attempts+1>=5 then now()+interval '15 minutes' else pin_locked_until end,updated_at=now() where id=v_member.id;
   insert into public.member_auth_security(gym_id,member_id,normalized_phone,event,success) values(v_gym_id,v_member.id,v_phone,'PIN_VERIFY',false);
   return jsonb_build_object('success',false,'error',case when v_member.pin_failed_attempts+1>=5 then 'Too many incorrect PIN attempts. Try again in 15 minutes.' else 'Incorrect Security PIN' end);
 end if;
 update public.members set pin_failed_attempts=0,pin_locked_until=null,updated_at=now() where id=v_member.id;
 v_token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.member_portal_sessions(member_id,gym_id,token_hash,expires_at,created_at,last_seen_at) values(v_member.id,v_gym_id,encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '30 days',now(),now()) returning id into v_session_id;
 insert into public.member_auth_security(gym_id,member_id,normalized_phone,event,success) values(v_gym_id,v_member.id,v_phone,'PIN_VERIFY',true);
 select mm.end_date,p.name,mm.status::text into v_mm from public.member_memberships mm join public.plans p on p.id=mm.plan_id where mm.member_id=v_member.id and mm.gym_id=v_gym_id order by mm.end_date desc,mm.created_at desc limit 1;
 return jsonb_build_object('success',true,'member_id',v_member.id,'full_name',v_member.full_name,'phone',v_member.normalized_phone,'referral_code',v_member.referral_code,'is_active',v_member.is_active,'valid_until',v_mm.end_date,'days_remaining',case when v_mm.end_date is null then 0 else greatest(0,v_mm.end_date-current_date) end,'plan_name',coalesce(v_mm.name,'Standard Pass'),'membership_status',coalesce(v_mm.status,'ACTIVE'),'session_token',v_token,'session_expires_at',now()+interval '30 days','pin_must_change',v_member.pin_must_change);
end $function$;

create or replace function public.rpc_member_change_pin(p_gym_slug text,p_member_id uuid,p_session_token text,p_current_pin text,p_new_pin text) returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','extensions' as $function$
declare v_gym_id integer; v_hash text; v_member public.members%rowtype;
begin
 if p_new_pin !~ '^[0-9]{4}$' or p_current_pin !~ '^[0-9]{4}$' then return jsonb_build_object('success',false,'error','PIN must be exactly 4 digits'); end if;
 select id into v_gym_id from public.gyms where lower(slug)=lower(btrim(p_gym_slug)) and is_active and deleted_at is null limit 1;
 if v_gym_id is null then return jsonb_build_object('success',false,'error','Gym not found'); end if;
 v_hash:=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex');
 select m.* into v_member from public.member_portal_sessions s join public.members m on m.id=s.member_id and m.gym_id=s.gym_id where s.token_hash=v_hash and s.member_id=p_member_id and s.gym_id=v_gym_id and s.expires_at>now() and m.deleted_at is null and m.is_active limit 1;
 if v_member.id is null then return jsonb_build_object('success',false,'error','Session expired'); end if;
 if v_member.pin_hash is null or extensions.crypt(p_current_pin,v_member.pin_hash)<>v_member.pin_hash then
   insert into public.member_auth_security(gym_id,member_id,normalized_phone,event,success) values(v_gym_id,v_member.id,v_member.normalized_phone,'PIN_CHANGE',false);
   return jsonb_build_object('success',false,'error','Current PIN is incorrect');
 end if;
 if p_new_pin=p_current_pin then return jsonb_build_object('success',false,'error','New PIN must be different'); end if;
 update public.members set pin_hash=extensions.crypt(p_new_pin,extensions.gen_salt('bf')),pin_must_change=false,pin_failed_attempts=0,pin_locked_until=null,updated_at=now() where id=v_member.id;
 insert into public.member_auth_security(gym_id,member_id,normalized_phone,event,success) values(v_gym_id,v_member.id,v_member.normalized_phone,'PIN_CHANGE',true);
 return jsonb_build_object('success',true);
end $function$;

create or replace function public.rpc_nexus_onboard_member(p_gym_id integer,p_full_name text,p_phone text,p_age integer default null,p_address text default null,p_duration_days integer default null,p_amount numeric default null,p_payment_method text default 'cash',p_payment_status text default 'completed',p_nutrition jsonb default null,p_referred_by_member_id uuid default null) returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','auth','extensions' as $function$
declare v_member_id uuid;v_plan_id uuid;v_membership_id uuid;v_payment_id uuid;v_nutrition_id uuid;v_normalized text;v_referral_code text;v_existing_plan uuid;v_initial_pin text;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if not public.has_gym_role(p_gym_id::bigint,array['owner','manager','staff']::text[]) then raise exception 'MEMBER_MANAGEMENT_DENIED' using errcode='42501'; end if;
 if nullif(btrim(p_full_name),'') is null then raise exception 'FULL_NAME_REQUIRED'; end if;
 if nullif(btrim(p_phone),'') is null then raise exception 'PHONE_REQUIRED'; end if;
 if p_duration_days is null or p_duration_days<=0 or p_duration_days>3650 then raise exception 'INVALID_DURATION'; end if;
 if p_amount is null or p_amount<0 or p_amount>100000000 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
 v_normalized:=right(regexp_replace(coalesce(p_phone,''),'\\D','','g'),10);
 if length(v_normalized)<>10 then raise exception 'INVALID_PHONE'; end if;
 if exists(select 1 from public.members m where m.gym_id=p_gym_id and m.normalized_phone=v_normalized and m.deleted_at is null) then raise exception 'MEMBER_PHONE_ALREADY_EXISTS'; end if;
 v_referral_code:=upper(substr(md5(p_gym_id::text||':'||v_normalized||':'||clock_timestamp()::text),1,10));
 v_initial_pin:=lpad((floor(random()*10000))::int::text,4,'0'); if v_initial_pin='0000' then v_initial_pin='4827'; end if;
 insert into public.members(gym_id,full_name,phone,age,address,referral_code,referred_by_member_id,is_active,pin_hash,pin_must_change,created_at,updated_at) values(p_gym_id,btrim(p_full_name),btrim(p_phone),p_age,nullif(btrim(p_address),''),v_referral_code,p_referred_by_member_id,true,extensions.crypt(v_initial_pin,extensions.gen_salt('bf')),true,now(),now()) returning id into v_member_id;
 select id into v_existing_plan from public.plans where gym_id=p_gym_id and duration_days=p_duration_days and is_active and price=0 order by created_at asc limit 1;
 if v_existing_plan is null then insert into public.plans(gym_id,name,duration_days,price,description,is_active,created_at,updated_at) values(p_gym_id,'Custom '||p_duration_days||' Day Pass',p_duration_days,0,'V2 generated plan; collected payment is stored separately.',true,now(),now()) returning id into v_plan_id; else v_plan_id:=v_existing_plan; end if;
 insert into public.member_memberships(gym_id,member_id,plan_id,start_date,end_date,status,created_at,updated_at) values(p_gym_id,v_member_id,v_plan_id,current_date,current_date+p_duration_days-1,'active'::public.membership_status_type,now(),now()) returning id into v_membership_id;
 insert into public.payments(gym_id,member_id,membership_id,amount,payment_method,payment_status,recorded_by_user_id,created_at) values(p_gym_id,v_member_id,v_membership_id,p_amount,p_payment_method,p_payment_status,auth.uid(),now()) returning id into v_payment_id;
 if p_nutrition is not null and jsonb_typeof(p_nutrition)='object' and p_nutrition<>'{}'::jsonb then insert into public.member_nutrition_assignments(gym_id,member_id,custom_plan,start_date,end_date,is_active,assigned_by,created_at,updated_at) values(p_gym_id,v_member_id,p_nutrition,current_date,current_date+p_duration_days-1,true,auth.uid(),now(),now()) returning id into v_nutrition_id; end if;
 return jsonb_build_object('status','MEMBER_ONBOARDED','member_id',v_member_id,'membership_id',v_membership_id,'payment_id',v_payment_id,'nutrition_assignment_id',v_nutrition_id,'referral_code',v_referral_code,'full_name',btrim(p_full_name),'phone',v_normalized,'duration_days',p_duration_days,'amount',p_amount,'valid_until',current_date+p_duration_days-1,'initial_pin',v_initial_pin);
end $function$;

create or replace function public.rpc_nexus_onboard_member_with_referral(p_gym_id integer,p_full_name text,p_phone text,p_age integer default null,p_address text default null,p_duration_days integer default null,p_amount numeric default null,p_payment_method text default 'cash',p_payment_status text default 'completed',p_nutrition jsonb default null,p_referral_code text default null) returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','auth','extensions' as $function$
declare v_uid uuid:=auth.uid();v_referrer uuid;
begin
 if v_uid is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if not public.has_gym_role(p_gym_id::bigint,array['owner','manager','staff']::text[]) then raise exception 'MEMBER_MANAGEMENT_DENIED' using errcode='42501'; end if;
 if nullif(btrim(coalesce(p_referral_code,'')),'') is not null then select id into v_referrer from public.members where gym_id=p_gym_id and upper(referral_code)=upper(btrim(p_referral_code)) and deleted_at is null limit 1; if v_referrer is null then raise exception 'REFERRAL_CODE_NOT_FOUND'; end if; end if;
 return public.rpc_nexus_onboard_member(p_gym_id,p_full_name,p_phone,p_age,p_address,p_duration_days,p_amount,p_payment_method,p_payment_status,p_nutrition,v_referrer);
end $function$;

revoke execute on function public.rpc_member_set_pin(text,text,text) from anon,authenticated,public;
revoke execute on function public.rpc_member_auth_start(text,text) from authenticated;
revoke execute on function public.rpc_member_verify_pin(text,text,text) from authenticated;
revoke execute on function public.rpc_member_change_pin(text,uuid,text,text,text) from authenticated;
revoke execute on function public.rpc_member_attendance_status(text,uuid,text) from authenticated;
revoke execute on function public.rpc_member_check_in(text,uuid,text,text) from authenticated;
revoke execute on function public.rpc_member_logout(text) from authenticated;
revoke execute on function public.rpc_member_refresh_session(text,text) from authenticated;
revoke execute on function public.rpc_nexus_member_portal(text,uuid,text) from authenticated;
revoke execute on function public.rpc_get_public_gym_by_slug(text) from anon,authenticated;
revoke execute on function public.rpc_get_member_hud_pass(text,text) from authenticated;
revoke execute on function public.register_member_with_referral(text,text,text,integer,text,text,integer,numeric,text) from authenticated;
revoke execute on function public.rpc_get_admin_pin_state(integer) from authenticated;
revoke execute on function public.rpc_get_admin_tenant(text) from authenticated;
revoke execute on function public.rpc_nexus_create_member(integer,text,text,integer,text,text,uuid) from authenticated;
revoke execute on function public.rpc_nexus_create_membership(integer,uuid,uuid,date,date,text) from authenticated;
revoke execute on function public.rpc_nexus_create_plan(integer,text,integer,numeric,text) from authenticated;
revoke execute on function public.rpc_set_admin_pin(integer,text) from authenticated;
revoke execute on function public.rpc_staff_quick_pin_unlock(integer,text) from authenticated;
revoke execute on function public.secure_renew_pass(text,text,integer,text) from authenticated;
revoke execute on function public.rpc_claim_member_pass(integer,text) from authenticated;
revoke execute on function public.trg_apply_referral_reward() from anon,authenticated;
revoke execute on function public.sync_gym_operational_status() from anon,authenticated;
revoke execute on function public.rpc_nexus_superadmin_list_gyms(text) from anon;
revoke execute on function public.rpc_nexus_superadmin_set_gym_active(integer,boolean) from anon;
revoke execute on function public.rpc_nexus_create_gym_for_owner(uuid,text,text,text,text,text,numeric,integer,jsonb,jsonb,text) from anon;
