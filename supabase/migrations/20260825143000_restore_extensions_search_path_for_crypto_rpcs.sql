-- ============================================================================
-- MIGRATION: 20260825143000_restore_extensions_search_path_for_crypto_rpcs.sql
-- DESCRIPTION: Restore pgcrypto extension resolution for SECURITY DEFINER RPCs
-- SAFETY: Non-destructive; changes function search_path only.
-- ============================================================================

-- The Super Admin security-hardening migration intentionally pinned SECURITY
-- DEFINER functions to trusted schemas, but omitted `extensions`. These RPCs
-- call pgcrypto functions (gen_salt/crypt), which live in the extensions schema
-- on this project. Omitting it causes:
--   function gen_salt(unknown) does not exist
-- during gym-owner provisioning.

ALTER FUNCTION public.rpc_create_gym_with_owner(
  text, text, text, text, text, text, text, numeric, integer, jsonb, jsonb
) SET search_path = pg_catalog, public, auth, extensions;

ALTER FUNCTION public.rpc_staff_quick_pin_unlock(integer, text)
  SET search_path = pg_catalog, public, auth, extensions;

ALTER FUNCTION public.secure_renew_pass(text, text, integer, text)
  SET search_path = pg_catalog, public, auth, extensions;
