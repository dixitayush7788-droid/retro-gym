# PRODUCTION ARCHITECTURE BASELINE & SECURITY FREEZE
Repository: `dixitayush7788-droid/retro-gym`
Branch: `main`

## 1. Executive Summary & Production Baseline

This document defines the canonical architecture and security boundaries for Retro Gym (Akash Fitness).
The production version is stable, verified, and locked. All future features must integrate into these established boundaries without introducing parallel architectures, duplicate runtimes, or unvalidated client trust assumptions.

---

## 2. Canonical Frontend Runtimes & Entries

| Surface | Entry Point | Canonical Runtime Script | Purpose |
| :--- | :--- | :--- | :--- |
| **Member HUD (PWA)** | `index.html` | `nexus-member-ui.js` | Single-page high-performance dark cyber HUD for athlete pass, attendance QR scan, pass renewal, referral squad, and daily workouts. |
| **Admin / Owner Portal** | `admin.html`, `admin-core.html` | `assets/js/adminAuth.js` | Operational dashboard for gym owners/admins: attendance logs, athlete registration, pass renewals, and telemetry. |
| **Admin Authentication Gate** | `admin-login.html` | `assets/js/authGuard.js` | Role-verified authentication gatekeeper. Resolves user roles via backend context. |
| **Super Admin Console** | `super-admin.html` | `assets/js/superAdmin.js` | Multi-tenant gym onboarding, global tenant provisioning, and platform governance. |

---

## 3. Role & Authentication Boundaries

The platform strictly separates roles into four tiers:
1. `SUPER_ADMIN`: Global platform administrator. Verified exclusively via backend RPC (`rpc_get_current_user_context`) or server-controlled `app_metadata.is_super_admin`. Never trusted from client-writable `user_metadata`.
2. `GYM_OWNER`: Owner of a single tenant gym. Authenticated via Supabase Auth (email credentials). Bound strictly to a single `gym_id` / `gym_slug`.
3. `GYM_ADMIN`: Gym desk manager/staff. Authorized for daily operations under an authorized tenant.
4. `MEMBER`: Athlete authenticated via phone + 4-digit PIN against `rpc_member_login_with_pin`. Receives a cryptographically validated session token scoped to that gym tenant.

### Security Guarantees:
- **Client Metadata Immunity**: `user_metadata` is never used for privilege escalation.
- **Credential Protection**: Service-role keys and master database secrets are strictly forbidden from frontend bundles.
- **Zero Console Leaks**: No PINs, session tokens, passwords, or PII are logged to browser consoles.

---

## 4. Tenant Resolution & Isolation Service

Tenant isolation follows strict hierarchical rules:
1. **Authoritative Selector**: Explicit URL parameter `?gym=<slug>` selects the target tenant.
2. **Slug Normalization**: Slugs must be valid strings (`normalizeGymSlug`). Numeric IDs (`gym_id`) are never used as slugs, nor accepted as fallbacks (`saved.gym_slug || saved.gym_id` is banned).
3. **Tenant Mismatch Invalidation**: If an active member session belongs to tenant A, but the user opens tenant B via URL, the session is invalidated immediately, local cache is purged, and the user is prompted to authenticate for tenant B. Sessions never jump across gyms.
4. **Default Station**: Canonical production default resolves to `akash-fitness-2343`.

---

## 5. Supabase RPC Contracts

All sensitive operations are delegated to authoritative database procedures:
- `rpc_get_public_gym_by_slug`: Returns public gym profile and operational status without exposing private keys.
- `rpc_member_login_with_pin`: Verifies athlete phone + PIN hash, returns scoped session token.
- `rpc_member_refresh_session`: Validates session expiration and active pass status.
- `rpc_member_attendance_status`: Checks whether member has checked in today.
- `rpc_member_quick_punch`: Server-validated check-in with streak calculation.
- `rpc_get_current_user_context`: Authoritative role and tenant resolution for staff/admins.

---

## 6. Realtime Lifecycle

- Realtime subscriptions use Supabase Realtime Postgres Changes.
- Channels are strictly filtered to the current tenant:
  - `gyms`: Filtered by `slug=eq.<tenant.slug>`.
  - `members`: Scoped to the authenticated athlete ID.
- Channels are cleaned up on teardown (`removeChannel`) and re-authenticated on reconnection.

---

## 7. PWA & Service Worker Cache Policy

The Service Worker (`sw.js`) adheres to strict data-protection rules:
- **Never Caches**: Dynamic API requests, Supabase calls (`/rest/`, `/rpc/`, `/auth/`, `supabase.co`), WebSockets, session tokens, or athlete records.
- **Static Assets Only**: Pre-caches HTML app shell, stylesheets, icons, fonts, and client scripts.
- **Network-First**: HTML navigation requests use a network-first strategy with offline shell fallback.

---

## 8. Financial & Report Security

- **UPI Intents**: UPI deep links (`upi://pay`) provide client convenience for initiating payments; they are never treated as confirmation of payment. Membership extensions require owner verification.
- **Pricing Authority**: Plan prices are loaded from the tenant database record; client modifications cannot override server validation.
- **Roster Exports**: CSV reports are scoped to the authenticated gym ID retrieved from server context, preventing cross-tenant data leaks.

---

## 9. The 12 Architecture Freeze Rules

For all future development on `retro-gym`:

1. **RULE 1: One canonical member runtime.** All member portal functionality lives in `nexus-member-ui.js`.
2. **RULE 2: One canonical admin/owner runtime.** All admin logic lives in `admin-core.html` and `assets/js/adminAuth.js`.
3. **RULE 3: One authentication boundary per role.** Roles are isolated and validated server-side.
4. **RULE 4: One tenant-resolution service.** All tenant parsing routes through `normalizeGymSlug` and `resolveCurrentGymSlug`.
5. **RULE 5: One realtime lifecycle.** Centralized channel subscription and teardown.
6. **RULE 6: One PWA lifecycle.** Single service worker cache strategy in `sw.js`.
7. **RULE 7: No MutationObserver cleanup architecture.** Do not create DOM watchdogs to patch broken HTML.
8. **RULE 8: No monkey-patching.** Never hijack native browser prototypes or libraries.
9. **RULE 9: No duplicate event systems.** Use standard window and custom events cleanly without competing buses.
10. **RULE 10: No CSS hacks used to hide broken functionality.** Fix root-cause logic rather than applying `display: none !important`.
11. **RULE 11: No duplicate UI implementations.** Do not build parallel HUDs or secondary views.
12. **RULE 12: Future features must be modular and isolated.** New capabilities must plug into existing state and event hooks.
