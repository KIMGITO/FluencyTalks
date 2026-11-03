# Security: what protects what, and what to do in an incident

## Taking the app down

**Admin → Overview → Site status → Pause the app.** Admins and the super admin can press it, with an authenticator code and a reason. Moderators see the banner but not the button.

While paused:

| | |
|---|---|
| API (tables and functions) | 503 for everyone but staff and the service role |
| Open tabs | Switch to the maintenance page; live messages stop arriving |
| Uploads, new accounts | Refused, except someone with an open staff invitation |
| Unsplash search, account deletion | Refused |
| Decision deadlines | Stop counting, and move forward by the time the app was down |
| Public website (landing, blog, legal) | Stays up: static files with no user data |
| Log in | Stays up, so staff can get in. Learners land on the maintenance page |
| Service role jobs (push, archive) | Keep running |

It stops people using the app. It doesn't stop traffic reaching Supabase, so for a flood of requests also use the Supabase dashboard's network restrictions.

**If you can't reach the admin area**, use the SQL editor:

```sql
update public.app_status set paused = true, paused_at = now(), message = 'Back soon.' where id;   -- pause
update public.app_status set paused = false, paused_at = null, message = null where id;            -- resume
```

Decision deadlines don't move, and there's no audit entry, when you do it this way.

**If `check_request()` itself is causing trouble**, this removes the pause and every rate limit at once. RLS and grants stay on:

```sql
alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';
```

Undo with `alter role authenticator set pgrst.db_pre_request = 'public.check_request'; notify pgrst, 'reload config';`. The Site status panel warns staff when this isn't set.

## Rate limits

`check_request()` runs before every API request and counts per user, using `public.rate_limit_rules`. A refusal is a 429. To change a limit, no deploy needed:

```sql
update public.rate_limit_rules set max_hits = 100 where path = '/rpc/follow_user';
insert into public.rate_limit_rules values ('/rpc/some_function', 30, 60);   -- 30 calls a minute
```

`*` is every write by one person. Some functions also have their own limits inside them (messages, new chats, posts, corrections, discussion).

Known limits:

- **Failed calls aren't counted.** The count is written in the request's own transaction, so an error rolls it back.
- **Plain reads aren't counted.** A read-only transaction can't write a counter. That covers table reads and `stable` functions. The search and profile functions are `volatile` so they do count. Blocking heavy read traffic needs a gateway in front of Supabase.
- **Signed-out traffic isn't counted**, since it can't reach anything but the language and country lists. Log in and sign up have Supabase Auth's own limits, set in the dashboard.

## Data access

- **New tables start closed.** Default privileges are revoked, so a new table needs its own `grant` and RLS in its migration. `supabase/tests/privileges.sql` fails the build otherwise.
- **Clients read through RLS and write through functions.** The only direct writes are deleting your own phrases and translations.
- **Profiles:** other members can read only `id, username, display_name, avatar_url` directly. The rest comes from `get_profile()`, which respects blocks. Your own row comes from `get_my_profile()`.
- **Notifications:** only their owner sees them. Staff and learners each get only their own kind, decided in `list_notifications()`. A staff member's name is never shown to a learner.
- **Typing indicators** use private Realtime channels, checked against conversation membership.

## Images

Only the `avatars` bucket holds user images. Post images are Unsplash links.

- Public by URL, but can't be listed.
- Writes only in your own folder: JPEG, PNG or WebP, up to 2 MB, at most 5 files.
- `profiles.avatar_url` only accepts your own folder or a Google photo, so a profile can't load a tracking image in other people's browsers.

## Checks

```bash
bash scripts/test-db.sh      # catalog checks and app flows
npm run test:security        # real API, Storage and Realtime on the local stack. Run it after any change to access rules
```
