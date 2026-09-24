-- NEXUS V2 auth security hardening
-- Applied to Supabase migration: nexus_v2_auth_security_hardening
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

-- Internal trigger helpers are not exposed through PostgREST.
revoke execute on function public.trg_apply_referral_reward() from anon,authenticated;
revoke execute on function public.sync_gym_operational_status() from anon,authenticated;
revoke execute on function public.rpc_claim_member_pass(integer,text) from authenticated;
revoke execute on function public.rpc_nexus_superadmin_list_gyms(text) from anon;
revoke execute on function public.rpc_nexus_superadmin_set_gym_active(integer,boolean) from anon;
revoke execute on function public.rpc_nexus_create_gym_for_owner(uuid,text,text,text,text,text,numeric,integer,jsonb,jsonb,text) from anon;
