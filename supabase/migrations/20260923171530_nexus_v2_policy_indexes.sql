-- NEXUS V2 follow-up: RLS policy consolidation and FK indexes.
drop policy if exists nutrition_templates_manage on public.nutrition_templates;
drop policy if exists member_nutrition_manage on public.member_nutrition_assignments;
create policy nutrition_templates_insert on public.nutrition_templates for insert to authenticated with check(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[]));
create policy nutrition_templates_update on public.nutrition_templates for update to authenticated using(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[])) with check(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[]));
create policy nutrition_templates_delete on public.nutrition_templates for delete to authenticated using(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[]));
create policy member_nutrition_insert on public.member_nutrition_assignments for insert to authenticated with check(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[]));
create policy member_nutrition_update on public.member_nutrition_assignments for update to authenticated using(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[])) with check(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[]));
create policy member_nutrition_delete on public.member_nutrition_assignments for delete to authenticated using(has_gym_role(gym_id::bigint,array['owner','manager','trainer']::text[]));
create index if not exists member_nutrition_assigned_by_idx on public.member_nutrition_assignments(assigned_by);
create index if not exists member_nutrition_template_idx on public.member_nutrition_assignments(template_id);
create index if not exists nutrition_templates_created_by_idx on public.nutrition_templates(created_by);
create index if not exists member_portal_sessions_gym_idx on public.member_portal_sessions(gym_id);