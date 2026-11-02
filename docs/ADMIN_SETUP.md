# Admin accounts and MFA: setup and recovery

For whoever owns the Supabase project. It covers going live, creating the super admin, setting up Google Authenticator, inviting staff, and getting back in after a lost phone.

## Who is who

| Account | How it's created | Can do | Who can manage it |
|---|---|---|---|
| **Super admin**: always `admin@thefluencytalks.com` | The owner script below. Normal signup refuses this address. | Everything, including inviting and removing staff and resetting their MFA | Nobody |
| **Admin** | Invited by the super admin | Reports, decisions, people, health, logs. Manages moderators and learners. | Super admin |
| **Moderator** | Invited by the super admin | Reports, decisions and people. Manages learners. | Super admin and admins |
| **Learner** | Normal signup | Nothing here. Login is unchanged, with no MFA. | All staff |

All staff log in the same way, every time: **email + password, then a Google Authenticator code**. Google sign-in and email links can't open the admin area.

## 1. Go live

Do these in order. Between step 2 and step 4 the admin area is unavailable, so keep that gap short. Learners aren't affected.

**1. Prepare Supabase (Dashboard).**

- **Authentication → Multi-Factor:** TOTP must be enabled.
- **Authentication → URL Configuration:** Redirect URLs must include `https://thefluencytalks.com/**`, or invitation links lose their token.
- **Authentication → Emails → SMTP:** set up a real provider. The built-in sender only mails your project's team members and allows about 2 emails an hour, so invitations to anyone else will fail.
- **Database → Extensions:** enable `pg_cron`. Without it the uptime history stays empty.

**2. Check who holds staff roles today**, then apply the migration:

```sql
select p.username, p.role, u.email from profiles p join auth.users u on u.id = p.id where p.role <> 'user';
select id, email, created_at from auth.users where lower(email) = 'admin@thefluencytalks.com';
```

```bash
supabase db push
```

Anyone already marked admin or moderator stays staff, and must set up an authenticator at their next login. Remove anyone who shouldn't be there from the Team page later.

**3. Deploy the edge functions:**

```bash
supabase functions deploy admin-staff
supabase functions deploy delete-account
```

**4. Deploy the frontend** (`npm run deploy`).

## 2. Create the super admin

First make sure the `admin@thefluencytalks.com` mailbox exists and that you control it. Password resets go there. Protect it with its own 2-step verification, because it is part of how this account recovers.

Find the service role key under Dashboard → Project Settings → API. Treat it like the master password: never put it in `.env`, a `VITE_` variable, or a chat.

```bash
SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> \
  node scripts/admin-accounts.mjs create-super-admin
```

It asks for a password of at least 12 characters and doesn't echo it. Use a long one from a password manager.

If the query in step 1.2 showed someone already signed up with that address, the script stops. Check who it was. To take the account over, run it again with `--adopt-existing`, which replaces its password and removes any authenticators.

## 3. Set up Google Authenticator

Do this on your first login. Staff do the same after accepting an invitation.

1. Install **Google Authenticator** on your phone.
2. Log in at `/login` with the email and password. You're taken to a setup screen with a QR code.
3. In the app, tap **+**, then **Scan a QR code**, and scan it.
4. Type the 6-digit code. Nothing is switched on until a valid code is entered.
5. **Save the 10 recovery codes** in your password manager, not on the phone. They're shown once and the database keeps only their hashes.
6. Open **Security** and choose **Add a backup authenticator**. Scan it on a second device, such as a tablet or an old phone kept somewhere safe.

## 4. Invite staff

Go to **Team**, enter the email, choose a role and select **Send invitation**. Only the super admin can do this.

The person gets an email and sets a password (at least 12 characters), then logs in and goes through section 3. The link lasts 72 hours, works once, and only for the address it was sent to. Someone who already has a learner account can be invited too. They keep their learner profile, and if they're removed later they go back to being a learner.

## 5. If something is lost

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
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/admin-accounts.mjs reset-mfa admin@thefluencytalks.com
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/admin-accounts.mjs reset-password admin@thefluencytalks.com
```

Each MFA reset cuts off existing sessions at once and is written to the audit trail. Whoever holds the service role key can always get in, so keep it to as few people as possible and rotate it if it may have leaked.

**Super admin needs to change hands?** The address is fixed, so the account stays and the new owner takes over its mailbox. Then run `reset-password` and `reset-mfa`.

## 6. What's enforced, and where

The dashboard only decides what to show. These rules live in the database, so calling the API directly doesn't get around them:

- **Admin powers need a full login.** Every admin database function and policy checks for a staff account *and* a token proving this login used a password and an authenticator code. Edge functions ask the database the same question.
- **Nobody can assign themselves a role.** A trigger refuses every change to `profiles.role` outside an accepted invitation, and even in the SQL console. Setting it by hand wouldn't help anyway: power comes from `admin_accounts`, which no client can write to.
- **Only staff can enroll in MFA**, and staff can't remove their last authenticator without a reset.
- **The reserved address** can't be signed up for, and the super admin account can't move off it.
- **A stolen password alone can't** use admin powers, change the password, or delete a staff account.
- **The audit trail** can't be edited or deleted through the app.

### Known limits

- A staff password without the code still works as an ordinary learner session on the server, for example reading that person's own messages. The app sends them to the code screen, but it isn't a server-side block. It gives no admin power.
- A person setting up for the first time has only a password until they scan the QR code. Have new staff finish setup straight after accepting.
- If a phone is stolen while unlocked with a session open, that session stays valid until it's reset. Use **Team → Reset MFA**.

## 7. Watching the system

The **Health**, **Logs** and **Overview** pages show what the app can see for itself:

- **Uptime** comes from a once-a-minute database heartbeat, so it covers the database and its scheduler, not the website. Add an outside monitor (UptimeRobot, Better Stack) on `https://thefluencytalks.com` to catch the site going down, and to alert you when no one has the dashboard open.
- **Application logs** hold browser errors from signed-in people and edge function failures, kept for 30 days. Errors on public pages and from signed-out visitors aren't captured.
- **Sign-ins** come from Supabase Auth. Wrong passwords aren't in that table: see Logs → Auth in the Supabase dashboard.

All reports notify the super admin and every admin in the app, and appear under **Reports**. These are in-app and push notifications, not email.

## 8. Testing

```bash
scripts/test-db.sh        # database rules, on a throwaway database
npm run test:auth         # login helpers
npm run test:admin        # real Auth, TOTP, edge function and email; local stack only
```

`test:admin` recreates its test accounts, including the super admin, and refuses to run anywhere but localhost. The command to set its variables is at the top of `scripts/test-admin-mfa.mjs`.
