create or replace function public.nexus_broadcast_member_portal_sync()
returns trigger
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'extensions'
as $$
declare
  v_member_id uuid;
  v_gym_id integer;
  v_topic text;
begin
  if tg_table_name = 'gyms' then
    v_gym_id := coalesce(new.id, old.id);
    if v_gym_id is not null then
      perform realtime.send(
        jsonb_build_object('v', 1),
        'gym_sync',
        'nexus:gym-sync:' || encode(extensions.digest(v_gym_id::text, 'sha256'), 'hex'),
        false
      );
    end if;
    return coalesce(new, old);
  end if;

  if tg_table_name = 'members' then
    v_member_id := coalesce(new.id, old.id);
    v_gym_id := coalesce(new.gym_id, old.gym_id);
  elsif tg_table_name = 'member_memberships' then
    v_member_id := coalesce(new.member_id, old.member_id);
    v_gym_id := coalesce(new.gym_id, old.gym_id);
  elsif tg_table_name = 'referral_ledger' then
    v_member_id := coalesce(new.referrer_member_id, old.referrer_member_id);
    v_gym_id := coalesce(new.gym_id, old.gym_id);
  elsif tg_table_name = 'attendance' then
    v_member_id := coalesce(new.member_id, old.member_id);
    v_gym_id := coalesce(new.gym_id, old.gym_id);
  elsif tg_table_name = 'payments' then
    v_member_id := coalesce(new.member_id, old.member_id);
    v_gym_id := coalesce(new.gym_id, old.gym_id);
  end if;

  if v_member_id is not null then
    v_topic := 'nexus:member-sync:' || encode(extensions.digest(v_member_id::text, 'sha256'), 'hex');
    perform realtime.send(jsonb_build_object('v', 1), 'member_sync', v_topic, false);
  elsif v_gym_id is not null then
    perform realtime.send(
      jsonb_build_object('v', 1),
      'gym_sync',
      'nexus:gym-sync:' || encode(extensions.digest(v_gym_id::text, 'sha256'), 'hex'),
      false
    );
  end if;

  return coalesce(new, old);
exception when others then
  -- Realtime must never break the underlying membership transaction.
  return coalesce(new, old);
end;
$$;

drop trigger if exists nexus_member_portal_sync_members on public.members;
create trigger nexus_member_portal_sync_members
after insert or update or delete on public.members
for each row execute function public.nexus_broadcast_member_portal_sync();

drop trigger if exists nexus_member_portal_sync_memberships on public.member_memberships;
create trigger nexus_member_portal_sync_memberships
after insert or update or delete on public.member_memberships
for each row execute function public.nexus_broadcast_member_portal_sync();

drop trigger if exists nexus_member_portal_sync_referrals on public.referral_ledger;
create trigger nexus_member_portal_sync_referrals
after insert or update or delete on public.referral_ledger
for each row execute function public.nexus_broadcast_member_portal_sync();

drop trigger if exists nexus_member_portal_sync_attendance on public.attendance;
create trigger nexus_member_portal_sync_attendance
after insert or update or delete on public.attendance
for each row execute function public.nexus_broadcast_member_portal_sync();

drop trigger if exists nexus_member_portal_sync_payments on public.payments;
create trigger nexus_member_portal_sync_payments
after insert or update or delete on public.payments
for each row execute function public.nexus_broadcast_member_portal_sync();

drop trigger if exists nexus_member_portal_sync_gyms on public.gyms;
create trigger nexus_member_portal_sync_gyms
after update or delete on public.gyms
for each row execute function public.nexus_broadcast_member_portal_sync();

revoke all on function public.nexus_broadcast_member_portal_sync() from public, anon, authenticated;
grant execute on function public.nexus_broadcast_member_portal_sync() to postgres;
