-- Security hardening for the current production RPC contracts.
-- No tables, columns, rows, sequences, or RLS policies are modified.
-- Verified against the live Supabase database on 2026-08-25.

REVOKE ALL ON FUNCTION public.rpc_create_gym_with_owner(text,text,text,text,text,text,text,numeric,integer,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_create_gym_with_owner(text,text,text,text,text,text,text,numeric,integer,jsonb,jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_gym_access(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_gym_role(bigint,text[]) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.rpc_staff_quick_pin_unlock(integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_staff_quick_pin_unlock(integer,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_get_member_hud_pass(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_get_member_hud_pass(text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_claim_member_pass(integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_claim_member_pass(integer,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.secure_renew_pass(text,text,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.secure_renew_pass(text,text,integer,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_get_current_user_context() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_get_current_user_context() TO anon, authenticated, service_role;

ALTER FUNCTION public.rpc_create_gym_with_owner(text,text,text,text,text,text,text,numeric,integer,jsonb,jsonb) SET search_path = pg_catalog, public, auth;
ALTER FUNCTION public.rpc_get_current_user_context() SET search_path = pg_catalog, public, auth;
ALTER FUNCTION public.rpc_staff_quick_pin_unlock(integer,text) SET search_path = pg_catalog, public, auth;
ALTER FUNCTION public.rpc_claim_member_pass(integer,text) SET search_path = pg_catalog, public, auth;
ALTER FUNCTION public.rpc_get_member_hud_pass(text,text) SET search_path = pg_catalog, public, auth;
ALTER FUNCTION public.secure_renew_pass(text,text,integer, text) SET search_path = pg_catalog, public, auth;
