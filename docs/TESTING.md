# Testing

## What to run, and when

| Command | Checks | Needs | When |
|---|---|---|---|
| `npx tsc --noEmit` | Types | Nothing | Always |
| `npm run test:unit` | Pure helpers: feed mix, post types, sentence splitting, validation, keyboard, blog HTML, composer languages, archive files, write-once rules, and no browser validation | Node 22 | After changing `src/lib` or forms |
| `npm run test:auth` | Password reset and auth helpers | Node 22 | After changing sign-in |
| `npm run test:db` | Builds the database from scratch and replays the app's flows | A throwaway Postgres 15+ | After any migration or `src/services/*` change |
| `npm run test:security` | Real API, Storage and Realtime access | The local stack | After any change to access rules |
| `npm run test:admin` | Staff accounts and MFA: real Auth, TOTP, edge function and email | The local stack | After changing staff or login code |
| `npm run build && npm run check:seo` | What a crawler sees on every public page | A build | After changing public pages or routes |
| `npm run check:legal` | Published legal text matches its version | A build | After changing the privacy page or terms |

## What CI runs

`.github/workflows/check.yml` runs on every push and pull request:

- **App job:** `tsc`, `test:auth`, `build`, `check:seo`, `check:legal`
- **Database job:** `scripts/test-db.sh` against Postgres 16

`test:unit`, `test:security` and `test:admin` don't run in CI, so run them by hand.

## The database test

`supabase/tests/app_flow.sql`, run by `scripts/test-db.sh`, replays the exact RPC calls the app makes, with the same function and parameter names as `src/services`:

- onboarding (language profile, profile, consents) and the language rules
- profiles and the feed
- messaging, corrections and points
- reports, blocking and admin access
- bounties, retention, archiving and tamper detection

`scripts/check-rpc-contract.py` also checks that every `rpc()` call in `src/` matches a real function and its parameter names. `supabase/tests/privileges.sql` checks that each table and function has the right grants.

```bash
# any throwaway Postgres 15+ you can create databases on (never a real project):
ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db
```

It prints `ALL APP-FLOW CHECKS PASSED` and `OK: database matches the app`, or stops at the first broken step with a non-zero exit. It would have caught every migration failure in this project's history.

**Against the local stack,** use `ADMIN_URL=postgresql://postgres:postgres@localhost:54322/postgres`. That also turns on Supabase's rule refusing an UPDATE or DELETE with no WHERE.

**If your machine has no `psql`,** run the suite through a small shim that forwards to the psql in the `supabase_db_fluencytalks` container, rewriting `localhost:54322` to `localhost:5432` and streaming `-f` files over stdin. The test creates and drops a throwaway `ft_test_*` database, so your local data is untouched.

## The local stack tests

`test:security` and `test:admin` refuse to run on anything but localhost, because they recreate their own test accounts and flip the pause switch.

- Get the variables with `supabase status -o env`. The command to set them is at the top of `scripts/test-admin-mfa.mjs`.
- **Each needs a clean database.** On a second run, GoTrue answers success for an existing address, so the "refused" checks fail falsely. Run `supabase db reset --local` first.
- Realtime joins can take 20 seconds from cold.

## Browser checks

There's no browser suite in the repo. The design and keyboard checks so far were run by hand:

- **Contrast audit:** every piece of text meets WCAG AA. See [Design system](DESIGN_SYSTEM.md#checks-that-keep-the-design-honest).
- **App-wide rules:** phone-sized Chrome against the local stack, with a simulated keyboard. See [App-wide rules](APP_WIDE_RULES.md).

## Things that catch people out

- The dev server's `.env` usually points at **production**. A new function or migration breaks the running app until it's pushed there. Deploy the database before the frontend.
- `supabase db reset` can fail at "Initialising schema" and work on a retry.
- If `supabase migration up --local` says files would be "inserted before the last migration", the local database is just behind. Add `--include-all`.
- Don't start a second `supabase functions serve`. A running one usually exists, they share one container, and a second one kills the first.
