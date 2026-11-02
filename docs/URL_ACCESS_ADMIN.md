# URL Access & Admin Setup

This document describes how users and staff reach the app through URLs. To create or recover staff accounts, see [ADMIN_SETUP.md](./ADMIN_SETUP.md).

---

## 1. How users access the app by URL

### Public pages (no login required)

| URL | Page | Notes |
|---|---|---|
| `https://thefluencytalks.com/` | Landing | Marketing + sign-in entry |
| `https://thefluencytalks.com/login` | Login | Email / OAuth (Google, Apple, Facebook) |
| `https://thefluencytalks.com/signup` | Signup | Creates a new account |
| `https://thefluencytalks.com/forgot-password` | Forgot password | Sends reset email |
| `https://thefluencytalks.com/reset-password` | Reset password | Activated via the email link (Supabase adds `code` / `access_token`) |
| `https://thefluencytalks.com/privacy` | Privacy policy | Public legal page |
| `https://thefluencytalks.com/terms` | Terms of service | Public legal page |
| `https://thefluencytalks.com/data-deletion` | Data deletion | Request account deletion |
| `https://thefluencytalks.com/admin/accept-invite` | Accept a staff invitation | Opened from the invitation email |

### Authenticated app pages (require a session + onboarding)

All app screens are protected by `ProtectedRoute` (`src/router/ProtectedRoute.tsx`). The route chain:

1. **Auth required** — a valid Supabase session must exist, otherwise the user is redirected to `/login`.
2. **Onboarding required** — after login, a brand-new user is redirected to `/onboarding` until `profiles.onboarding_done = true` **and** `profiles.native_language_id` is set. Once onboarding is complete, the following routes become available:

| URL | Page |
|---|---|
| `/home` | Home feed / suggestions |
| `/search` | People search (filters live in the URL: `?q=&tab=&lang=&role=&level=&scope=`) |
| `/discover` | Redirects to `/search` |
| `/messages` | Conversation list |
| `/messages/:id` | Single conversation |
| `/profile` | Own profile |
| `/profile/edit` | Edit your profile |
| `/u/:username` | Another user's public profile |
| `/settings` | Settings / moderation |
| `/learning` | Learning hub (also reachable via `/phrasebook`) |
| `/library` | Saved study partners library |
| `/library/contribute` | Contribute to the community library |
| `/partners` | Partner pages |
| `/bounty-queue` | Open priority bounties |

---

## 2. How staff reach the admin area

`/admin` is guarded by `AdminRoute` (`src/router/AdminRoute.tsx`). Staff log in at `/login` like anyone else, then go through the gate: a QR code the first time, an authenticator code after that. Anyone who isn't staff is sent to `/home`.

| URL | Section | Who |
|---|---|---|
| `/admin` | Overview | All staff |
| `/admin/reports` | Reports | All staff |
| `/admin/decisions` | Appeals, escalations, restrictions, policy | All staff (policy: admins) |
| `/admin/people` | Suspend, ban, reinstate | All staff |
| `/admin/activity` | Moderation history | All staff |
| `/admin/team` | Staff and invitations | Admins (invite and remove: super admin) |
| `/admin/health` | Services, database, uptime, security | Admins |
| `/admin/logs` | Application logs, staff audit, sign-ins | Admins |
| `/admin/security` | Own authenticators, recovery codes, password | All staff |

The gate is only a convenience: the database refuses every admin call from a session without a password and an authenticator code.

## 3. Roles

Setting `profiles.role` by hand no longer works: a trigger refuses it, and power comes from `admin_accounts` and the login itself. See [ADMIN_SETUP.md](./ADMIN_SETUP.md) for how accounts are created, what each role can do, and recovery.
