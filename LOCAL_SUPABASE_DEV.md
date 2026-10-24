# Local Supabase Development Guide

FluencyTalks now uses a **local Supabase stack** for development instead of the linked remote project. All Supabase CLI commands (`start`, `stop`, `db reset`, `db diff`, etc.) target the local Docker containers.

---

## 1. Start / Stop the Local Stack

### Start
```bash
supabase start --ignore-health-check
```

> The `--ignore-health-check` flag is needed because some auxiliary containers (realtime, storage, pg_meta, studio) report unhealthy in this environment, but the **core services (db, kong, gotrue, rest) all work correctly**.

Expected output: Kong API gateway on `http://127.0.0.1:54321`, Postgres on `127.0.0.1:54322`.

### Stop
```bash
supabase stop
```

### Status
```bash
supabase status
supabase status --output env   # prints connection strings & keys for copy/paste
```

---

## 2. Reset the Local Database

Reset wipes the local DB, re-applies all migrations, and runs `supabase/seed.sql`:

```bash
supabase db reset --yes
```

This is the fastest way to get a clean schema + seed data (e.g. 109 languages) during development.

---

## 3. How the App Connects

`src/lib/supabase.ts` reads from Vite env variables:

```ts
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

These are defined in `.env` (gitignored, local only):

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<local anon key from `supabase status --output env`>
```

No code changes are needed — the app already points to these env vars.

---

## 4. Creating a Test User (No Email Sending)

Local auth is configured with **auto-confirm** and **no confirmation required** (`mailer_autoconfirm: true`, `enable_confirmations: false`). You can create a test user in seconds without any SMTP setup.

### Option A: Sign up via the public API (simplest)

```bash
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"testuser@fluencytalks.dev","password":"testpass123","data":{"full_name":"Test User"}}'
```

Response includes `access_token`, `refresh_token`, and `user.id`.  
`email_confirmed_at` is set immediately — the user can sign in right away.

Then sign in:
```bash
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"testuser@fluencytalks.dev","password":"testpass123"}'
```

### Option B: Create via the service-role admin API (bypasses email entirely)

Useful if you want to create a user without even a signup record:

```bash
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"testuser@fluencytalks.dev","password":"testpass123","email_confirm":true,"user_metadata":{"full_name":"Test User"}}'
```

Get `$SERVICE_ROLE_KEY` from `supabase status --output env`.

### Option C: Create directly in the database

```bash
docker exec supabase_db_fluencytalks psql -U postgres -d postgres -c "
  INSERT INTO public.profiles (id, full_name, email)
  VALUES ('<user-id-from-auth>', 'Test User', 'testuser@fluencytalks.dev');
"
```

---

## 5. Common Developer Workflow

```bash
# 1. Start local Supabase
supabase start --ignore-health-check

# 2. (Optional) Reset DB to clean state with seed data
supabase db reset --yes

# 3. Start the Vite dev server
npm run dev

# 4. When done, stop Supabase
supabase stop
```

---

## 6. Useful Endpoints (local)

| Service | URL |
|---------|-----|
| REST/PostgREST API (via Kong) | `http://127.0.0.1:54321/rest/v1` |
| Auth (GoTrue) | `http://127.0.0.1:54321/auth/v1` |
| Storage | `http://127.0.0.1:54321/storage/v1` |
| Edge Functions | `http://127.0.0.1:54321/functions/v1` |
| Studio (web UI) | `http://127.0.0.1:54323` |
| Direct Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Example query with anon key:
```bash
curl -s -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  "http://127.0.0.1:54321/rest/v1/languages?select=id,english_name"
```

---

## 7. Files Changed

- `.env` — local Supabase URL + real local anon key (gitignored)
- `.env.example` — updated with local dev values & instructions
- `supabase/.temp/linked-project.json` → `.linked-project.json.bak` (CLI no longer targets remote project)

No application source files needed changes.

---

## 8. Notes

- The local anon key and service role key are **development-only** values that reset when you recreate the local stack. Re-run `supabase status --output env` and update `.env` if keys change after a full `supabase stop` + volume removal.
- `supabase.db` data persists in a Docker volume across `stop`/`start`. Use `supabase db reset --yes` to wipe and re-seed.
- To fully wipe local data: `supabase stop --delete-up` (removes the Docker volume), then `supabase start --ignore-health-check`.
