-- Fix tenant RLS helper permissions used by member/membership/payment/referral policies.
-- Without these grants, authenticated owner/staff sessions receive:
--   permission denied for function has_gym_access
-- during athlete registration.

GRANT EXECUTE ON FUNCTION public.has_gym_access(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_gym_role(bigint, text[]) TO authenticated;

-- These helpers are tenant authorization helpers and must not be callable by anon.
REVOKE EXECUTE ON FUNCTION public.has_gym_access(bigint) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_gym_role(bigint, text[]) FROM anon;
