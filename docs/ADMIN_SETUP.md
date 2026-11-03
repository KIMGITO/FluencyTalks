# Admin accounts and MFA: setup and recovery

For whoever owns the Supabase project and the website deploy. Follow Part 1 from top to bottom the first time. Part 2 is for when something looks wrong.

**The rule behind this guide:** the admin system has three pieces, and they must all be live and from the same version: the **database**, the **edge functions** and the **website**. If only the database is updated, the old website still shows learner screens while the database refuses their admin calls. You'd see the normal profile setup page and a "Moderation" tab with no access.

## Who is who

| Account | How it's created | Can do | Who can manage it |
|---|---|---|---|
| **Super admin**: always `superadmin@thefluencytalks.com` | The owner script in step 7. Normal signup refuses this address. | Everything, including inviting and removing staff and resetting their MFA | Nobody |
| **Admin** | Invited by the super admin | Reports, decisions, people, health, logs. Manages moderators and learners. | Super admin |
| **Moderator** | Invited by the super admin | Reports, decisions and people. Manages learners. | Super admin and admins |
| **Learner** | Normal signup | The learning app only. Login is unchanged, with no MFA. | All staff |

All staff log in the same way, every time: **email + password, then a Google Authenticator code**. Google sign-in and email links can't open the admin area.

### What staff can see

Staff accounts run the app, they don't use it. Staff only get the admin area:

- **No profile setup, no learner pages.** Home, Messages, Library, Learning, Bounties, Search and Settings all send staff to `/admin`.
- **Only what's needed to make a decision.** Links to a reported person or post open a review page inside the admin area, at `/admin/people/<username>` and `/admin/posts/<id>`. These have no Message, Follow, Reply or Confirm buttons. Moderator decisions such as Accept and Decline stay.
- **Reports** show the report and its evidence, including the reported messages. Staff can't browse other conversations.
- **Staff are hidden from learners.** They don't appear in search, matching or the home feed.
- **Staff can't act as learners.** The database refuses staff who try to message, post, comment, follow or report, and refuses learners who try to start a chat with staff.

If a learner is invited to the team, their learner side is closed while they're staff. Their data is kept, and it comes back if they're removed from the team. Someone who wants to do both needs a separate learner account on another email address.

## Part 1: Set it up

### Step 1. What you need

| Thing | Where it comes from | Notes |
|---|---|---|
| **The mailbox** `superadmin@thefluencytalks.com` | Your email host | It must exist and you must control it, because password resets go there. Turn on its own 2-step verification. |
| **Google Authenticator** | App Store or Google Play, on your phone | That's all. **You don't create an app, a project or an API key in Google.** The QR code comes from Supabase and the phone app works without talking to Google. |
| **A second device** (recommended) | A tablet or old phone | Holds the backup authenticator. |
| **A password manager** | Your choice | For the password and the recovery codes. |
| **Supabase CLI login** | Run the commands below | Lets you push the database and functions. |
| **Cloudflare login** | Run `npx wrangler login` | Lets you deploy the website. |

```bash
npx supabase login
npx supabase link --project-ref pilgmyaocwebzajemrfq
npx wrangler login
```

### Step 2. Supabase dashboard settings

Open your project at [supabase.com/dashboard](https://supabase.com/dashboard). Menu names can shift slightly between dashboard versions. `supabase/config.toml` only affects the local stack, so these must be set by hand on the hosted project.

| Where | Set this | What breaks without it |
|---|---|---|
| **Authentication → Multi-Factor** | **TOTP (Authenticator app):** enabled, for both enroll and verify. There is nothing to create and no key to paste. | The QR screen shows an error instead of a code. |
| **Authentication → URL Configuration** | **Site URL:** `https://thefluencytalks.com`. **Redirect URLs:** add `https://thefluencytalks.com/**`. | Invitation links land on the home page and lose their token. |
| **Authentication → Emails → SMTP Settings** | Turn on custom SMTP with a real provider such as Resend, Brevo or Postmark. | The built-in sender only mails your project's team members, about 2 emails an hour, so invitations fail. |
| **Authentication → Emails → Templates** | Leave **Invite user** and **Magic Link** using `{{ .ConfirmationURL }}`, as they are by default. | The invitation has no working link. |
| **Database → Extensions** | Enable `pg_cron` and `pg_net`. Then finish the setup in [DATA_RETENTION.md](DATA_RETENTION.md). | The uptime history on the Health page stays empty, and logs and records are never archived. |

### Step 3. Check what's on the database now

In **SQL Editor**, run this. It only reads.

```sql
select public.super_admin_email() as reserved_address;   -- errors if the first admin migration was never pushed

select u.email, p.role, a.tier as staff_tier, u.created_at
from auth.users u
join public.profiles p on p.id = u.id
left join public.admin_accounts a on a.user_id = u.id
where p.role <> 'user' or a.user_id is not null
   or lower(u.email) in ('admin@thefluencytalks.com', 'superadmin@thefluencytalks.com');
```

Find your situation:

| What you see | What it means | What to do |
|---|---|---|
| No row for either address | No super admin yet | Carry on. Step 7 creates it. |
| `admin@…` with tier `super`, and no `superadmin@…` row | Created on the old address | Carry on. Step 4 moves it to the new address and keeps its password and authenticators. **Skip step 7.** |
| `superadmin@…` with no tier | An ordinary learner account on that address, from a normal signup or a failed script run | Carry on. In step 7, use `--adopt-existing`. |
| `superadmin@…` with tier `super` | Already done | Carry on. **Skip step 7.** |
| `admin@…` with tier `super` **and** a `superadmin@…` row | Both exist, so step 4 stops with an error | See [The address is already taken](#the-address-is-already-taken). |
| `admin@…` with no tier | An ordinary learner account. That address is no longer special. | Delete it in **Authentication → Users** if it was only a test. |
| Any other account with a tier | Existing staff | They stay staff and lose their learner side. Remove anyone who shouldn't be there from **Team** later. |

### Step 4. Update the database

```bash
npx supabase db push
```

It lists the migrations it will apply. Learners aren't affected. Staff can't use the admin area until step 6 is finished, so keep the gap short.

### Step 5. Deploy the edge functions

```bash
npx supabase functions deploy admin-staff
npx supabase functions deploy delete-account
```

Check that `admin-staff` is listed with `npx supabase functions list`. The function already has the Supabase keys it needs. Only if your site isn't on `https://thefluencytalks.com`, also run `npx supabase secrets set SITE_URL=https://your-site`, or invitation links will point at the wrong place.

### Step 6. Deploy the website

```bash
npm run deploy
```

**Check it worked:** open `https://thefluencytalks.com/login` in a private window and log in as a learner. There should be **no "Moderation" or "Admin" item** in the sidebar. If you still see one, you're looking at the old website.

### Step 7. Create the super admin

Skip this if step 3 told you to.

Find the key under **Project Settings → API Keys**. Use the `service_role` key or a **secret** key. Treat it like the master password: never put it in `.env`, a `VITE_` variable, or a chat.

Run these from the project folder, one line at a time. You can copy them exactly as they are:

```bash
export SUPABASE_URL=https://pilgmyaocwebzajemrfq.supabase.co
read -rsp 'Paste the key, then press Enter: ' SUPABASE_SERVICE_ROLE_KEY; echo
export SUPABASE_SERVICE_ROLE_KEY
node scripts/admin-accounts.mjs create-super-admin
```

The second line waits for you to paste the key. **Nothing appears as you paste, and that's normal.** Press Enter once. This way the key doesn't end up in your shell history.

If step 3 showed a `superadmin@…` account with no tier, check who made it. To take it over, run the last line as `node scripts/admin-accounts.mjs create-super-admin --adopt-existing`, which replaces its password and removes any authenticators.

The script then asks for the new super admin password, at least 12 characters, and doesn't show that as you type either. It should end with `Super admin ready`. If it prints an error, nothing was set up: don't log in, see Part 2.

When you're done, remove the key from this terminal:

```bash
unset SUPABASE_SERVICE_ROLE_KEY
```

**Don't create this account any other way.** Not through `/signup`, and not with **Add user** in the dashboard. Either way you'd get an ordinary learner, or a refusal.

### Step 8. First login and Google Authenticator

Staff do this too, after accepting an invitation.

1. Go to `/login`, enter the email and password, and select **Log in**.
2. You should land on **Set up your authenticator**, showing a QR code. You should **not** see "Set up your profile". If you do, see Part 2.
3. In Google Authenticator, tap **+**, then **Scan a QR code**, and scan it. It's saved in the app as **FluencyTalks** with the first part of your email. If the camera doesn't pick it up, hold the phone 20–30 cm from the screen, turn the screen brightness up and zoom the page in. If you still can't scan, choose **Can't scan it?** on the page, then **Enter a setup key** in the app and type the key shown.
4. Type the 6-digit code and select **Turn on**. Nothing is switched on until a valid code is entered. If you leave before this, you get a new QR code next time.
5. **Save the 10 recovery codes** in your password manager, not on the phone. They're shown once.
6. You arrive at the admin **Overview**. The sidebar shows Reports, Decisions, People, Activity, Team, Health, Logs and Security.
7. Open **Security** and choose **Add a backup authenticator**. Scan it on your second device.
8. Sign out and log in again. It should ask for a code. That's how every login works from now on.

### Step 9. Invite staff

Only the super admin can do this.

1. Go to **Team**, enter the email, choose a role and select **Send invitation**.
2. The person opens the link in the email and sets a password of at least 12 characters. The link lasts 72 hours, works once, and only for the address it was sent to.
3. They log in and follow step 8.

## Part 2: If something looks wrong

### Symptoms

| What you see | Why | Fix |
|---|---|---|
| "Set up your profile" after logging in as admin | Either the website is the old version, or this account isn't staff | Do step 6, then run the step 3 query. If the account has no tier, do step 7. |
| A "Moderation" tab with no access | The old website is running against the new database | Do step 6. Reload, or use a private window. |
| "Couldn't check your access" | The database doesn't have the migrations yet | Do step 4. |
| `bash: key: No such file or directory` | A command was run with a `<key>` placeholder still in it | Use the commands in step 7, which have nothing to replace. |
| "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first." from the script | The key or URL isn't set in this terminal, for example in a new window | Run the `export` and `read` lines in step 7 again. |
| "Couldn't use that key" from the script | The key is wrong, or it's the public anon key | Copy the `service_role` or secret key again from **Project Settings → API Keys**, and run the `read` and `export` lines in step 7 again. |
| "This database isn't ready for staff accounts" from the script | The database doesn't have the migrations yet | Do step 4, then run the script again. |
| "No staff access" | The profile says staff but there's no staff record | Run the step 3 query. Remove and re-invite the person. |
| An error instead of the QR code | TOTP is turned off | See step 2, first row. |
| The phone won't detect a very dense QR code | The website is an older version | Do step 6 and reload. Until then, use **Can't scan it?** and enter the setup key by hand. |
| "This email address can't be used to sign up" | That's the reserved address working as intended | Use step 7. |
| "Invalid login" for `admin@…` | The account moved to the new address | Log in with `superadmin@…` and the same password. |
| Invitation fails or never arrives | Built-in email sender, or `admin-staff` isn't deployed | See steps 2 and 5. |
| The invitation opens the home page | The redirect URL is missing | See step 2. |
| Health shows no uptime | `pg_cron` is off | See step 2. |

**Don't try to fix access by editing the database by hand.** The role column refuses manual changes, and a role alone gives no power. Use the script and invitations.

### The address is already taken

The migration stopped because a super admin exists on `admin@…` and a different account is on `superadmin@…`. Nothing was changed. In **Authentication → Users**, look at the `superadmin@…` account. If it isn't in real use, delete it and run `npx supabase db push` again. If it is, tell whoever owns it before you delete it.

### Lost access

Always confirm who's asking through a channel other than email, such as a call or video. A compromised mailbox is exactly what an attacker would use to ask for a reset.

| What happened | What to do |
|---|---|
| Lost one device, backup still works | Log in with the backup, then remove the lost one under **Security** and add a new one. |
| **Staff:** lost every authenticator | At the code screen choose **Lost your authenticator?** and enter a recovery code. Or the super admin uses **Team → Reset MFA**. |
| **Super admin:** lost every authenticator | Use a recovery code, the same way. If those are gone too, use the owner script below. |
| Forgot password, still has authenticator | **Forgot password** on the login page. The reset page asks for the code first, then you log in again with the new password. |
| Forgot password and lost authenticator | Open the reset link from the email, choose **Lost your authenticator?**, enter a recovery code, and set the password. No code left: staff ask the super admin; the super admin uses the owner script. |
| Used most recovery codes | **Security → Make new codes**. The old set stops working. |
| Five wrong recovery codes | Recovery locks for an hour. |
| Suspect an account is compromised | Super admin: **Team → Reset MFA** or **Remove**. Both take effect immediately. Then change that person's password. |

**Owner script: the last resort.** It needs the service role key, and it's the only thing that can recover a super admin with no codes left:

```bash
export SUPABASE_URL=https://pilgmyaocwebzajemrfq.supabase.co
read -rsp 'Paste the key, then press Enter: ' SUPABASE_SERVICE_ROLE_KEY; echo
export SUPABASE_SERVICE_ROLE_KEY

node scripts/admin-accounts.mjs reset-mfa superadmin@thefluencytalks.com
node scripts/admin-accounts.mjs reset-password superadmin@thefluencytalks.com

unset SUPABASE_SERVICE_ROLE_KEY
```

Each MFA reset cuts off existing sessions at once and is written to the audit trail. Whoever holds the service role key can always get in, so keep it to as few people as possible and rotate it if it may have leaked.

**Super admin needs to change hands?** The address is fixed, so the account stays and the new owner takes over its mailbox. Then run `reset-password` and `reset-mfa`.

## Part 3: Reference

### What's enforced, and where

The dashboard only decides what to show. These rules live in the database, so calling the API directly doesn't get around them:

- **Admin powers need a full login.** Every admin database function and policy checks for a staff account *and* a token proving this login used a password and an authenticator code. Edge functions ask the database the same question.
- **Nobody can assign themselves a role.** A trigger refuses every change to `profiles.role` outside an accepted invitation, and even in the SQL console. Setting it by hand wouldn't help anyway: power comes from `admin_accounts`, which no client can write to.
- **Only staff can enroll in MFA**, and staff can't remove their last authenticator without a reset.
- **The reserved address** can't be signed up for, and the super admin account can't move off it.
- **A stolen password alone can't** use admin powers, change the password, or delete a staff account.
- **Staff can't act as learners**, and aren't listed to them. See [What staff can see](#what-staff-can-see).
- **The audit trail** can't be edited or deleted through the app.

### Known limits

- **Learner pages are closed to staff by the website, not the database.** Writing is refused by the database, but a staff member calling the API directly could still read what any signed-in learner can read, such as library posts. It gives them nothing a free learner account wouldn't, and private chats they aren't part of stay closed.
- **Chats from before someone joined staff stay open to the other person.** They can't start a new chat, but they can still send a message in an old one. The staff member won't see it unless they leave the team.
- A staff password without the code still works as a limited session on the server. It gives no admin power, and the website only shows the code screen.
- A person setting up for the first time has only a password until they scan the QR code. Have new staff finish setup straight after accepting.
- If a phone is stolen while unlocked with a session open, that session stays valid until it's reset. Use **Team → Reset MFA**.

### Watching the system

The **Health**, **Logs** and **Overview** pages show what the app can see for itself:

- **Uptime** comes from a once-a-minute database heartbeat, so it covers the database and its scheduler, not the website. Add an outside monitor (UptimeRobot, Better Stack) on `https://thefluencytalks.com` to catch the site going down, and to alert you when no one has the dashboard open.
- **Application logs** hold browser errors from signed-in people and edge function failures, kept for 30 days. Errors on public pages and from signed-out visitors aren't captured.
- **Sign-ins** come from Supabase Auth. Wrong passwords aren't in that table: see Logs → Auth in the Supabase dashboard.

All reports notify the super admin and every admin in the app, and appear under **Reports**. These are in-app and push notifications, not email.

### Changing this later

- **Never edit a migration that has been pushed.** `db push` skips it, so the change never reaches the live database. Add a new migration instead.
- **Deploy in this order:** database, functions, website.

### Testing

```bash
scripts/test-db.sh        # database rules, on a throwaway database
npm run test:auth         # login helpers
npm run test:admin        # real Auth, TOTP, edge function and email; local stack only
```

`test:admin` recreates its test accounts, including the super admin, and refuses to run anywhere but localhost. The command to set its variables is at the top of `scripts/test-admin-mfa.mjs`.
