create table if not exists public.member_portal_sessions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  gym_id integer not null references public.gyms(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_member_portal_sessions_token_hash on public.member_portal_sessions(token_hash);
create index if not exists idx_member_portal_sessions_member on public.member_portal_sessions(member_id, gym_id);

alter table public.member_portal_sessions enable row level security;
drop policy if exists member_portal_sessions_no_client_access on public.member_portal_sessions;
create policy member_portal_sessions_no_client_access on public.member_portal_sessions for all to anon, authenticated using (false) with check (false);

create or replace function public.rpc_member_verify_pin(p_gym_slug text, p_phone text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_gym_id integer;
  v_member public.members%rowtype;
  v_phone text;
  v_mm record;
  v_token text;
  v_session_id uuid;
begin
  v_phone := right(regexp_replace(coalesce(p_phone,''),'\\D','','g'),10);
  if p_pin !~ '^[0-9]{4}$' then return jsonb_build_object('success',false,'error','PIN must be exactly 4 digits'); end if;
  select id into v_gym_id from public.gyms where lower(slug)=lower(btrim(p_gym_slug)) and is_active=true and deleted_at is null limit 1;
  if v_gym_id is null then return jsonb_build_object('success',false,'error','Gym not found'); end if;
  select * into v_member from public.members where gym_id=v_gym_id and normalized_phone=v_phone and is_active=true and deleted_at is null limit 1;
  if v_member.id is null then return jsonb_build_object('success',false,'error','Athlete not found'); end if;
  if v_member.pin_hash is null or extensions.crypt(p_pin, v_member.pin_hash) <> v_member.pin_hash then return jsonb_build_object('success',false,'error','Incorrect Security PIN'); end if;

  v_token := encode(extensions.gen_random_bytes(32),'hex');
  insert into public.member_portal_sessions(member_id,gym_id,token_hash,expires_at,created_at,last_seen_at)
  values(v_member.id,v_gym_id,encode(extensions.digest(v_token,'sha256'),'hex'),now()+interval '30 days',now(),now())
  returning id into v_session_id;

  select mm.end_date, p.name, mm.status::text into v_mm
  from public.member_memberships mm join public.plans p on p.id=mm.plan_id
  where mm.member_id=v_member.id and mm.gym_id=v_gym_id
  order by mm.end_date desc, mm.created_at desc limit 1;

  return jsonb_build_object('success',true,'member_id',v_member.id,'full_name',v_member.full_name,'phone',v_member.normalized_phone,'referral_code',v_member.referral_code,'is_active',v_member.is_active,'valid_until',v_mm.end_date,'days_remaining',case when v_mm.end_date is null then 0 else greatest(0,v_mm.end_date-current_date) end,'plan_name',coalesce(v_mm.name,'Standard Pass'),'membership_status',coalesce(v_mm.status,'ACTIVE'),'session_token',v_token,'session_expires_at',now()+interval '30 days');
end;
$function$;

create or replace function public.rpc_member_refresh_session(p_gym_slug text, p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
declare
  v_hash text;
  v_session record;
  v_result jsonb;
begin
  if nullif(btrim(p_session_token),'') is null then return jsonb_build_object('success',false,'error','Session missing'); end if;
  v_hash := encode(extensions.digest(p_session_token,'sha256'),'hex');
  select s.id,s.member_id,s.gym_id,s.expires_at into v_session
  from public.member_portal_sessions s join public.gyms g on g.id=s.gym_id
  where s.token_hash=v_hash and lower(g.slug)=lower(btrim(p_gym_slug)) and g.is_active=true and g.deleted_at is null and s.expires_at>now() limit 1;
  if v_session.id is null then return jsonb_build_object('success',false,'error','Session expired'); end if;
  update public.member_portal_sessions set last_seen_at=now(),expires_at=greatest(expires_at,now()+interval '30 days') where id=v_session.id;

  select jsonb_build_object('success',true,'member_id',m.id,'full_name',m.full_name,'phone',m.normalized_phone,'referral_code',m.referral_code,'is_active',m.is_active,'valid_until',mm.end_date,'days_remaining',case when mm.end_date is null then 0 else greatest(0,mm.end_date-current_date) end,'plan_name',coalesce(p.name,'Standard Pass'),'membership_status',coalesce(mm.status::text,'ACTIVE'),'referral_count',(select count(*) from public.referral_ledger rl where rl.gym_id=m.gym_id and rl.referrer_member_id=m.id and rl.status='credited'),'referral_free_days',((select count(*) from public.referral_ledger rl where rl.gym_id=m.gym_id and rl.referrer_member_id=m.id and rl.status='credited')*7),'referral_money_saved',round(((select count(*) from public.referral_ledger rl where rl.gym_id=m.gym_id and rl.referrer_member_id=m.id and rl.status='credited')*7.0/30.0)*coalesce(g.plan_1m_price,1200)),'referrals',coalesce((select jsonb_agg(jsonb_build_object('full_name',rm.full_name,'phone',rm.normalized_phone,'created_at',rl.created_at,'status',rl.status::text,'reward_days',7) order by rl.created_at desc) from public.referral_ledger rl join public.members rm on rm.id=rl.referred_member_id where rl.gym_id=m.gym_id and rl.referrer_member_id=m.id),'[]'::jsonb)) into v_result
  from public.members m join public.gyms g on g.id=m.gym_id
  left join lateral (select mm2.* from public.member_memberships mm2 where mm2.member_id=m.id and mm2.gym_id=m.gym_id order by mm2.end_date desc,mm2.created_at desc limit 1) mm on true
  left join public.plans p on p.id=mm.plan_id
  where m.id=v_session.member_id and m.gym_id=v_session.gym_id and m.deleted_at is null;

  return coalesce(v_result,jsonb_build_object('success',false,'error','Member not found'));
end;
$function$;

create or replace function public.rpc_member_logout(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'extensions'
as $function$
begin
  delete from public.member_portal_sessions where token_hash=encode(extensions.digest(coalesce(p_session_token,''),'sha256'),'hex');
  return jsonb_build_object('success',true);
end;
$function$;

revoke all on table public.member_portal_sessions from anon, authenticated;
grant execute on function public.rpc_member_refresh_session(text,text) to anon, authenticated;
grant execute on function public.rpc_member_logout(text) to anon, authenticated;
grant execute on function public.rpc_member_verify_pin(text,text,text) to anon, authenticated;

delete from public.member_portal_sessions where expires_at < now();
