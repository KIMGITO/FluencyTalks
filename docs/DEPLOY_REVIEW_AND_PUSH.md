# Deploying the review workflow and push

Order matters: the frontend needs the database changes first.

## 1. Database

```bash
supabase db push --dry-run   # lists what will run. Expect the 20261102 migrations.
supabase db push
```

Then confirm the sweep is scheduled. If `cron.job` doesn't exist, enable pg_cron in the dashboard and run the
`cron.schedule` line from `20261103100700_moderation.sql`. Without it the sweep still runs from app
activity, but only when people use the app.

```sql
select jobname, schedule from cron.job;
select extname from pg_extension where extname in ('pg_cron', 'pg_net');
```

## 2. Frontend

Deploy as usual. Reviews and in-app notifications work from here. Push stays off until step 3.

## 3. Push (optional, and safe to do later)

```bash
npx web-push generate-vapid-keys
supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:<support address> PUSH_WEBHOOK_SECRET=<long random string>
supabase functions deploy send-push --no-verify-jwt
```

Tell the database where to call, in the SQL editor:

```sql
insert into public.push_settings (function_url, webhook_secret)
values ('https://<project-ref>.supabase.co/functions/v1/send-push', '<same PUSH_WEBHOOK_SECRET>');
```

Set `VITE_VAPID_PUBLIC_KEY=<public>` where the frontend is built, and deploy the frontend again. The setting
appears under Notifications, the sliders icon.

## 4. Check with two accounts

Propose a correction from one account to the other's post, with the second account's app closed. It should get
a banner that opens the exact correction. Check that typing and read ticks work in a chat too.
