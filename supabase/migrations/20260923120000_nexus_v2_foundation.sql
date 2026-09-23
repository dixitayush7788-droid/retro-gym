-- NEXUS V2 foundation. Applied to Supabase project zfvkvrhuovvbfbrutpph.
create table if not exists public.nutrition_templates(
 id uuid primary key default gen_random_uuid(),gym_id integer not null references public.gyms(id) on delete cascade,
 name text not null,goal text,notes text,meals jsonb not null default '[]'::jsonb,is_active boolean not null default true,
 created_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists public.member_nutrition_assignments(
 id uuid primary key default gen_random_uuid(),gym_id integer not null references public.gyms(id) on delete cascade,
 member_id uuid not null references public.members(id) on delete cascade,template_id uuid references public.nutrition_templates(id) on delete set null,
 custom_plan jsonb not null default '{}'::jsonb,start_date date not null default current_date,end_date date,is_active boolean not null default true,
 assigned_by uuid references public.profiles(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint member_nutrition_assignment_dates check(end_date is null or end_date>=start_date)
);
create index if not exists nutrition_templates_gym_active_idx on public.nutrition_templates(gym_id,is_active);
create index if not exists member_nutrition_gym_member_idx on public.member_nutrition_assignments(gym_id,member_id,is_active);
alter table public.nutrition_templates enable row level security;
alter table public.member_nutrition_assignments enable row level security;
drop policy if exists nutrition_templates_select on public.nutrition_templates;
drop policy if exists nutrition_templates_manage on public.nutrition_templates;
drop policy if exists member_nutrition_select on public.member_nutrition_assignments;
drop policy if exists member_nutrition_manage on public.member_nutrition_assignments;
create policy nutrition_templates_select on public.nutrition_templates for select to authenticated using(has_gym_access(gym_id::bigint));
create policy nutrition_templates_manage on public.nutrition_templates for all to authenticated using(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[])) with check(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[]));
create policy member_nutrition_select on public.member_nutrition_assignments for select to authenticated using(has_gym_access(gym_id::bigint));
create policy member_nutrition_manage on public.member_nutrition_assignments for all to authenticated using(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[])) with check(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[]));

create or replace function public.rpc_nexus_onboard_member(p_gym_id integer,p_full_name text,p_phone text,p_age integer default null,p_address text default null,p_duration_days integer default null,p_amount numeric default null,p_payment_method text default 'cash',p_payment_status text default 'completed',p_nutrition jsonb default null,p_referred_by_member_id uuid default null)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','auth' as $$
declare v_member_id uuid;v_plan_id uuid;v_membership_id uuid;v_payment_id uuid;v_nutrition_id uuid;v_normalized text;v_referral_code text;v_existing_plan uuid;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501';end if;
 if not public.has_gym_role(p_gym_id::bigint,array['owner','manager','staff']::text[]) then raise exception 'MEMBER_MANAGEMENT_DENIED' using errcode='42501';end if;
 if nullif(btrim(p_full_name),'') is null then raise exception 'FULL_NAME_REQUIRED';end if;
 if nullif(btrim(p_phone),'') is null then raise exception 'PHONE_REQUIRED';end if;
 if p_duration_days is null or p_duration_days<=0 or p_duration_days>3650 then raise exception 'INVALID_DURATION';end if;
 if p_amount is null or p_amount<0 then raise exception 'INVALID_PAYMENT_AMOUNT';end if;
 v_normalized:=right(regexp_replace(coalesce(p_phone,''),'\\D','','g'),10);
 if length(v_normalized)<>10 then raise exception 'INVALID_PHONE';end if;
 if exists(select 1 from public.members where gym_id=p_gym_id and normalized_phone=v_normalized and deleted_at is null) then raise exception 'MEMBER_PHONE_ALREADY_EXISTS';end if;
 v_referral_code:=upper(substr(md5(p_gym_id::text||':'||v_normalized||':'||clock_timestamp()::text),1,10));
 insert into public.members(gym_id,full_name,phone,age,address,referral_code,referred_by_member_id,is_active) values(p_gym_id,btrim(p_full_name),btrim(p_phone),p_age,nullif(btrim(p_address),''),v_referral_code,p_referred_by_member_id,true) returning id into v_member_id;
 select id into v_existing_plan from public.plans where gym_id=p_gym_id and duration_days=p_duration_days and is_active=true and price=0 order by created_at limit 1;
 if v_existing_plan is null then insert into public.plans(gym_id,name,duration_days,price,description,is_active) values(p_gym_id,'Custom '||p_duration_days||' Day Pass',p_duration_days,0,'V2 generated plan; collected payment is stored separately.',true) returning id into v_plan_id; else v_plan_id:=v_existing_plan;end if;
 insert into public.member_memberships(gym_id,member_id,plan_id,start_date,end_date,status) values(p_gym_id,v_member_id,v_plan_id,current_date,current_date+p_duration_days-1,'active'::public.membership_status_type) returning id into v_membership_id;
 insert into public.payments(gym_id,member_id,membership_id,amount,payment_method,payment_status,recorded_by_user_id) values(p_gym_id,v_member_id,v_membership_id,p_amount,p_payment_method,p_payment_status,auth.uid()) returning id into v_payment_id;
 if p_nutrition is not null and jsonb_typeof(p_nutrition)='object' and p_nutrition<>'{}'::jsonb then insert into public.member_nutrition_assignments(gym_id,member_id,custom_plan,start_date,end_date,assigned_by) values(p_gym_id,v_member_id,p_nutrition,current_date,current_date+p_duration_days-1,auth.uid()) returning id into v_nutrition_id;end if;
 return jsonb_build_object('status','MEMBER_ONBOARDED','member_id',v_member_id,'membership_id',v_membership_id,'payment_id',v_payment_id,'nutrition_assignment_id',v_nutrition_id,'referral_code',v_referral_code,'full_name',btrim(p_full_name),'phone',v_normalized,'duration_days',p_duration_days,'amount',p_amount,'valid_until',current_date+p_duration_days-1);
end;$$;
revoke execute on function public.rpc_nexus_onboard_member(integer,text,text,integer,text,integer,numeric,text,text,jsonb,uuid) from public,anon;
grant execute on function public.rpc_nexus_onboard_member(integer,text,text,integer,text,integer,numeric,text,text,jsonb,uuid) to authenticated;

create or replace function public.rpc_nexus_member_portal(p_gym_slug text,p_member_id uuid,p_session_token text)
returns jsonb language plpgsql security definer set search_path to 'pg_catalog','public','auth','extensions' as $$
declare v_gym_id integer;v_hash text;v_session_id uuid;v_member record;v_membership record;
begin
 select id into v_gym_id from public.gyms where lower(slug)=lower(btrim(p_gym_slug)) and is_active and deleted_at is null limit 1;
 if v_gym_id is null then return jsonb_build_object('success',false,'error','Gym not found');end if;
 v_hash:=encode(extensions.digest(p_session_token,'sha256'),'hex');
 select id into v_session_id from public.member_portal_sessions where token_hash=v_hash and member_id=p_member_id and gym_id=v_gym_id and expires_at>now() limit 1;
 if v_session_id is null then return jsonb_build_object('success',false,'error','Session expired');end if;
 select id,full_name,phone,referral_code,is_active into v_member from public.members where id=p_member_id and gym_id=v_gym_id and deleted_at is null;
 select mm.id,mm.start_date,mm.end_date,mm.status::text status,p.name plan_name into v_membership from public.member_memberships mm join public.plans p on p.id=mm.plan_id where mm.member_id=p_member_id and mm.gym_id=v_gym_id order by mm.end_date desc,mm.created_at desc limit 1;
 update public.member_portal_sessions set last_seen_at=now(),expires_at=greatest(expires_at,now()+interval '30 days') where id=v_session_id;
 return jsonb_build_object('success',true,'member',jsonb_build_object('id',v_member.id,'full_name',v_member.full_name,'phone',v_member.phone,'referral_code',v_member.referral_code,'is_active',v_member.is_active),'membership',coalesce(to_jsonb(v_membership),'{}'::jsonb),'attendance',coalesce((select jsonb_agg(jsonb_build_object('date',a.attendance_date,'check_in',a.check_in,'check_out',a.check_out) order by a.attendance_date desc) from(select * from public.attendance where gym_id=v_gym_id and member_id=p_member_id order by attendance_date desc limit 60)a),'[]'::jsonb),'nutrition',coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'plan',n.custom_plan,'start_date',n.start_date,'end_date',n.end_date) order by n.created_at desc) from public.member_nutrition_assignments n where n.gym_id=v_gym_id and n.member_id=p_member_id and n.is_active),'[]'::jsonb));
end;$$;
revoke execute on function public.rpc_nexus_member_portal(text,uuid,text) from public;
grant execute on function public.rpc_nexus_member_portal(text,uuid,text) to anon,authenticated;