# Deployment

**Live site: [thefluencytalks.com](https://thefluencytalks.com).** It's the Cloudflare Worker `thefluencytalks` with static assets.

**The order always matters: database, then functions, then website.** The frontend needs the database changes first, and the Worker returns 503 for posts until their table exists.

## Normal deploy

```bash
npx supabase migration list --linked     # what's applied and what isn't
npx supabase db push --dry-run           # what would run
npx supabase db push
npx supabase functions deploy <name>     # only functions that changed
npm run deploy                           # runs wrangler deploy, which runs npm run build
npm run indexnow                         # optional: ask Bing and others to recrawl
```

`public/_redirects` and `public/_headers` are copied into `dist/` automatically.

After a deploy, run the [live checks](INDEXING_CHECKLIST.md#check-the-live-site-once-after-each-deploy).

## First-time setup

1. Install dependencies and create `.env` from `.env.example`, with the Supabase URL and anon key.
2. Log in and link:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx wrangler login
   ```
3. Push the database, deploy the functions and deploy the website, as above.
4. Follow [Admin setup](ADMIN_SETUP.md) for dashboard settings and the super admin.
5. In Cloudflare, add the [domains](#domains).
6. Set the variables below where the frontend is built.
7. In Supabase, go to **Authentication → Providers** and enable **Email** and **Google**.
8. In **Authentication → URL Configuration**, set the Site URL to `https://thefluencytalks.com`. Under Redirect URLs, allow `https://thefluencytalks.com/**` and `http://localhost:5173/**`. If the list still points at `localhost:3000`, production logins bounce there instead of the app.
9. In Google Cloud Console → Credentials, the OAuth client's **Authorized redirect URIs** must include `https://<project-ref>.supabase.co/auth/v1/callback`.

**Careful with `supabase config push`.** It's a production deploy with no dry run, and it ignores a piped "no". Production's values live under `[remotes.production]` in `supabase/config.toml`, so check any new auth setting against that block first. To read live values, use `GET /auth/v1/settings`.

## Environment variables

**Client (`VITE_*`).** These are public, built into the site, and listed in `.env.example`.

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | The backend |
| `VITE_TRANSLATE_EMAIL` | Optional. Raises the MyMemory quota |
| `VITE_VAPID_PUBLIC_KEY` | Public half of the web push key |
| `VITE_EMAIL_INFO`, `_SUPPORT`, `_SECURITY`, `_REPORT`, `_TERMS`, `_PRIVACY` | Contact inboxes, all `@thefluencytalks.com` |

**Server secrets.** Set these with `supabase secrets set`, and never in `.env` or a `VITE_` variable.

| Secret | Used by |
|---|---|
| `UNSPLASH_ACCESS_KEY` | `unsplash-proxy` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_WEBHOOK_SECRET` | `send-push` |
| `ARCHIVE_WEBHOOK_SECRET`, `ARCHIVE_WORM_ENDPOINT`, `ARCHIVE_WORM_REGION`, `ARCHIVE_WORM_BUCKET`, `ARCHIVE_WORM_ACCESS_KEY_ID`, `ARCHIVE_WORM_SECRET_ACCESS_KEY` | `archive-run` |
| `SITE_URL` | `admin-staff`, only if the site isn't on `https://thefluencytalks.com` |

## Domains

| Address | Should do | State on 3 November 2026 |
|---|---|---|
| `thefluencytalks.com` | The site | **Working** |
| `www.thefluencytalks.com` | 301 to the main domain | **Doesn't resolve.** Add a DNS record, plus a Cloudflare redirect rule from `www.thefluencytalks.com/*` to `https://thefluencytalks.com/$1` |
| `fluencytalks.com`, `www.fluencytalks.com` | 301 to the main domain | **Redirect to `fluencytalks-com.l.ink`.** Check who controls these |
| `fluency-talks.vercel.app` | Nothing | **Still answers.** Take it down, or redirect it, so there's one copy of the site |

`public/_redirects` handles paths only, not hosts, and Cloudflare ignores `vercel.json`, so host redirects have to be Cloudflare redirect rules.

Also set the **GitHub repository's Website field** to `https://thefluencytalks.com`. It currently points at the Vercel address.

## One-time migration history repair

The migrations were consolidated on 3 November 2026. `db push` works by version number, so a hosted database with the old history won't line up until it's repaired. Check first:

```bash
npx supabase migration list --linked
```

If it still shows the old versions, the rehearsed path that keeps data is:

1. `npx supabase migration repair --status reverted <each of the 31 old versions>`
2. `npx supabase migration repair --status applied <20261103100000 to 20261103101700>`
3. `npx supabase db push`, which then applies only the two FAQ files.

`db reset --linked` also works, but it **deletes everything**.

## Scheduled jobs

Enable **pg_cron** and **pg_net** under Database → Extensions, then confirm:

```sql
select jobname, schedule from cron.job;
select extname from pg_extension where extname in ('pg_cron', 'pg_net');
```

If `cron.job` doesn't exist, enable pg_cron and run the `cron.schedule` line from `20261103100700_moderation.sql`, and the two from `20261103101300_data_archive.sql`. Without it, the accountability sweep still runs from app activity, but only when people use the app.

## Web push

This is optional and safe to do later. Reviews and in-app notifications work without it. `scripts/setup-push.sh` does steps 1 and 2 in one go, and it touches production.

1. Create the keys and deploy the function:
   ```bash
   npx web-push generate-vapid-keys
   supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:<support address> PUSH_WEBHOOK_SECRET=<long random string>
   supabase functions deploy send-push --no-verify-jwt
   ```
2. Tell the database where to call, in the SQL editor:
   ```sql
   insert into public.push_settings (function_url, webhook_secret)
   values ('https://<project-ref>.supabase.co/functions/v1/send-push', '<same PUSH_WEBHOOK_SECRET>');
   ```
3. Set `VITE_VAPID_PUBLIC_KEY=<public>` where the frontend is built, and deploy the website again. The setting appears under Notifications, behind the sliders icon.
4. Check with two accounts. Propose a correction from one account to the other's post, with the second account's app closed. It should get a banner that opens the exact correction. Check that typing and read ticks work in a chat too.

## Other functions

```bash
supabase functions deploy admin-staff
supabase functions deploy delete-account
supabase secrets set UNSPLASH_ACCESS_KEY=<key>
supabase functions deploy unsplash-proxy
supabase functions deploy archive-run --no-verify-jwt     # setup in DATA_RETENTION.md
```

When notification text changes, deploy `send-push` too, because it shares that text. The order is database, then `send-push`, then the website.

## Changing the legal pages

CI fails until the new version is recorded. See [Legal compliance](LEGAL_COMPLIANCE.md#changing-the-privacy-policy-or-terms).
