# URL Access & Admin Setup

This document describes how users and admins reach the app through URLs, and how to grant admin access **without changing any application code or migrations**.

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

---

## 3. How to become an admin without changing anything

Admin is a single column on `profiles`. Making yourself one is a **one-line SQL update on the database** — no code, no migration, no build required.

### The exact command

```sql
UPDATE profiles
SET role = 'admin'
WHERE id = '<your-user-id>';
```

Replace `<your-user-id>` with your Supabase user ID. You can find it from your logged-in session (e.g. `supabase.auth.getUser()` in the browser console) or from the `id` column in the `auth.users` table.

### Version 2 check

Some local setups use the archive schema where the column was originally named with a different check constraint. The **current, shipped migration** (`supabase/migrations/20261024000000_baseline.sql`) defines:

```sql
role text not null default 'user' check (role in ('user','moderator','admin'))
```

So the set of valid roles is: `user`, `moderator`, `admin`.

### Step-by-step

#### Option A — Local development (Supabase SQL editor)

1. Start the local stack if you haven't already:

   ```bash
   supabase start --ignore-health-check
   ```

2. Open the local Supabase Studio at `http://127.0.0.1:54323` (or via `supabase status`).
3. Go to **SQL Editor**.
4. Run:

   ```sql
   UPDATE profiles
   SET role = 'admin'
   WHERE id = '00000000-0000-0000-0000-000000000000';  -- replace with your user id
   ```

5. Your next refresh of `/admin` will show the Moderation tabs.

#### Option B — Local development (Admin API, no email)

GoTrue's admin endpoint creates a user directly in the database, bypassing signup/email entirely:

```bash
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "me@fluencytalks.dev",
    "password": "testpass123",
    "email_confirm": true,
    "user_metadata": { "full_name": "Me" }
  }'
```

- Get `$SERVICE_ROLE_KEY` from `supabase status --output env`.
- This is **completely local** (`LOCAL_SUPABASE_DEV.md` documents it). It does not touch production.

#### Option C — Direct database insert

If you only need a user row plus a profile row:

```sql
-- Insert the auth user (needs the UUID from your auth flow, or generate one)
INSERT INTO public.profiles (id, username, display_name, email, role, status)
VALUES ('<your-user-id>', 'me', 'My Display Name', 'me@fluencytalks.dev', 'admin', 'active');
```

> Note: the app only grants admin access through `profiles.role`. There is no separate "admin user" table, no API route, and no admin-only login flow.

---

| `/library` | Saved study partners library |
| `/library/contribute` | Contribute to the community library |
| `/partners` | Partner pages |
| `/bounty-queue` | Open priority bounties |

### The `/admin` route

Only **admins and moderators** can reach `/admin`. It is guarded by `AdminRoute` (`src/router/AdminRoute.tsx`), which checks `profiles.role`:

```ts
role === 'admin' || role === 'moderator' ? <Outlet /> : <Navigate to="/home" replace />;
```

Non-admin users who guess `/admin` are silently sent to `/home` — the UI never shows them the admin screens.

---

## 2. How admins access admin features

Once a user has `role = 'admin'` (or `'moderator'`), they can:

1. Sign in / log in normally.
2. Visit `/admin`.
3. See the **Moderation** screen with tabs:
   - **Reports** — review report queue with message evidence, filter by status.
   - **People** — search users, view role/status, manage accounts.
   - **Activity** — see recent moderation and system activity.

**Authorization is enforced two ways, and both are server-side:**

- **Frontend guard** — `AdminRoute` hides the `/admin` UI from non-admin users.
- **Backend SQL enforcement** — every admin function checks `is_admin()`:

```sql
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin','moderator') and status = 'active'
  );
$$;
```

So even if someone bypasses the UI, a non-admin user's RPC call to an admin function raises `forbidden`.

### Admin actions

- **Suspend / ban / reinstate** — always requires a reason. Only admins can act on staff (`role <> 'user'`); moderators can manage regular users.
- **Dismiss a report** — marks the report `dismissed` and writes a `moderation_actions` entry.
- **Activity log** — `admin_recent_actions` records every moderation action.

---
## 4. What does NOT need to change

| Thing | Status |
|---|---|
| Application source code (`src/`) | **Unchanged** — no new component, route, or store is required. |
| Migrations (`supabase/migrations/`) | **Unchanged** — no new migration needed. |
| Build / deploy | **Unchanged** — you never rebuild or redeploy. |
| `AdminRoute` (`src/router/AdminRoute.tsx`) | Already permits `admin` **and** `moderator`. |
| Backend SQL functions | Already check `is_admin()` for every admin action. |
| `AdminUsers`/`AdminActivity`/`AdminReports` screens | Already read `profiles.role` from `me`. |

The only change is the data in the database: `profiles.role`.

---

## 5. Roles and what they can do

| Role | Can access `/admin` | Can act on regular users | Can act on staff |
|---|---|---|---|
| `user` | No | — | — |
| `moderator` | Yes | Yes | No |
| `admin` | Yes | Yes | Yes |

> **Why `moderator` matters:** the guard and the SQL both include `moderator`, so you can give someone moderation rights without giving them full admin.

---

## 6. Important notes & warnings

- **This is deliberately server-side protected.** `profiles.role` cannot be edited from the client because `protect_profile_columns()` triggers and rejects changes to `role`, `status`, and counters unless `is_admin()` is true **and** `app.bypass_protect` is set.
- **The role is trusted by the SQL layer**, so it is the single source of truth. Treat it like a database-level permission, not just a UI flag.
- **On production**, use the Supabase dashboard SQL editor (or the `supabase` CLI) to run the `UPDATE` above. The `service_role` key can do this directly, but the SQL editor is safer for one-off changes.
- **After changing your role**, sign out and sign back in (or refresh the app) so `useProfileStore` re-loads `me`. The app re-validates the session on every navigation too.
- **To revoke admin access**, run:

  ```sql
  UPDATE profiles SET role = 'user' WHERE id = '<your-user-id>';
  ```

- **The app never exposes `role` to the client except through the logged-in `me` object**, and the JSON API strips it from public profile responses.

---

## 7. Quick reference

### URL access summary

- **Everyone**: `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/data-deletion`
- **Authenticated**: `/home`, `/search`, `/discover`, `/messages`, `/messages/:id`, `/profile`, `/profile/edit`, `/u/:username`, `/settings`, `/learning`, `/phrasebook`, `/library`, `/library/contribute`, `/partners`, `/bounty-queue`
- **Admin/moderator only**: `/admin`

### Command to become admin

```sql
UPDATE profiles SET role = 'admin' WHERE id = '<your-user-id>';
```

### Command to become moderator

```sql
UPDATE profiles SET role = 'moderator' WHERE id = '<your-user-id>';
```

### Verify your role

```sql
SELECT id, username, role, status FROM profiles WHERE id = '<your-user-id>';
```

### Revoke admin

```sql
UPDATE profiles SET role = 'user' WHERE id = '<your-user-id>';
```

