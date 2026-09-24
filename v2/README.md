# NEXUS V2 — Clean Rebuild

This directory is the clean production rebuild of the gym SaaS.

## Architecture rules
- One runtime and one render path.
- One Supabase client per surface.
- Tenant is resolved from authenticated role/context, never by email matching.
- Owner/member sessions are isolated.
- No MutationObservers, polling loops, runtime cleanup, CSS hacks, or wrapper chains.
- Membership duration and actual collected amount are independent.
- Payment writes are server-authorized and tenant-scoped.
- Owner onboarding creates/invites the owner through Supabase Auth server-side.
- Member onboarding creates membership, payment, nutrition assignment, and WhatsApp handoff as one explicit workflow.
- PWA uses the same application runtime as web.

## Delivery order
1. Auth + tenant boundary
2. Owner console + onboarding
3. Member app
4. Attendance + payments + nutrition
5. PWA + reports + WhatsApp
6. Device smoke test and production promotion

The existing V1 remains untouched while V2 is built and tested.
