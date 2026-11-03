# Local development

## The most important thing to know

**This repo is linked to the production project, and `.env` points at production.** Local commands need `--local`, and running the app against the local stack needs overrides. The app itself needs no code changes.

| Command | Touches |
|---|---|
| `npm run dev` with the normal `.env` | **Production data** |
| `supabase db push` | **Production** |
| `supabase config push` | **Production.** It has no dry run and ignores a piped "no". It has overwritten production auth settings before, so never run it just to look at differences |
| `supabase db reset --local`, `supabase migration up --local` | The local stack |

## Requirements

Node 22, Docker, and the Supabase CLI.

## Run the app

```bash
npm install
cp .env.example .env        # add your Supabase URL and anon key
npm run dev
```

`src/lib/supabase.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. `.env` is gitignored, and `.env.example` lists every variable.

## Start and stop the local stack

```bash
supabase start --ignore-health-check
supabase status
supabase status --output env     # connection strings and keys
supabase stop
```

`--ignore-health-check` is needed when auxiliary containers (realtime, storage, pg_meta, studio) report unhealthy in some environments. The core services (database, kong, gotrue, rest) work correctly.

After `supabase start`, give storage up to a minute before `supabase migration up --local`, because its tables must exist before the migrations run.

## Run the app against the local stack

Pass the values for that run instead of editing `.env`:

```bash
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<local anon key> npx vite
```

`wrangler deploy` and `wrangler dev` run `npm run build` themselves, so those variables must be set for those commands too.

## Reset the local database

This wipes the local database, applies all migrations and runs `supabase/seed.sql`, giving 109 languages:

```bash
supabase db reset --local --yes
```

## Local addresses

| Service | Address |
|---|---|
| REST API (through Kong) | `http://127.0.0.1:54321/rest/v1` |
| Auth (GoTrue) | `http://127.0.0.1:54321/auth/v1` |
| Storage | `http://127.0.0.1:54321/storage/v1` |
| Edge Functions | `http://127.0.0.1:54321/functions/v1` |
| Studio (web UI) | `http://127.0.0.1:54323` |
| Direct Postgres | `postgresql://postgres:postgres@127.0.0.1:54322/postgres` |

Example query:

```bash
curl -s -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  "http://127.0.0.1:54321/rest/v1/languages?select=id,english_name"
```

## Create a test user

Local auth confirms email automatically, so this needs no SMTP. The easiest way is to sign up on the app's own `/signup` page. To do it from the command line:

**Option A: the public API**

```bash
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/signup' \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"testuser@example.com","password":"testpass123","data":{"full_name":"Test User"}}'
```

The response includes `access_token`, `refresh_token` and `user.id`. Then sign in:

```bash
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/token?grant_type=password' \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"testuser@example.com","password":"testpass123"}'
```

**Option B: the admin API**

Get `$SERVICE_ROLE_KEY` from `supabase status --output env`.

```bash
curl -s -X POST 'http://127.0.0.1:54321/auth/v1/admin/users' \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"testuser@example.com","password":"testpass123","email_confirm":true,"user_metadata":{"full_name":"Test User"}}'
```

Either way, `handle_new_user` creates the profile row, so there's no need to insert it by hand.

## Notes

- Local keys are development-only values that reset when you recreate the stack. Run `supabase status --output env` again if they change.
- Local data persists in a Docker volume across `stop` and `start`. To remove it completely, run `supabase stop --no-backup`, then start again.
- Edge Functions use their own secrets locally. Don't start a second `supabase functions serve`: see [Testing](TESTING.md#things-that-catch-people-out).

## A typical session

```bash
supabase start --ignore-health-check
supabase db reset --local --yes                 # optional: clean state
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<local anon key> npx vite
supabase stop                                   # when done
```

Tests are in [Testing](TESTING.md).
