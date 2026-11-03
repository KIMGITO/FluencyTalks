# URLs and access

How people and staff reach each part of [thefluencytalks.com](https://thefluencytalks.com). To create or recover staff accounts, see [Admin setup](ADMIN_SETUP.md). Routes are defined in `src/router/index.tsx`.

## Public pages (no login needed)

| URL | Page | Notes |
|---|---|---|
| `https://thefluencytalks.com/` | Landing | What it is, with a way into sign-up |
| `/languages` | All 40 languages | |
| `/languages/:slug` | One language page | For example `/languages/vietnamese` |
| `/blog` | Blog index | From the database |
| `/blog/:slug` | One article | From the database |
| `/faq` | Questions and answers | From the database. `/how-it-works` redirects here |
| `/about` | About | |
| `/privacy` | Privacy policy | |
| `/terms` | Terms of service | |
| `/data-deletion` | Delete your account | Deletes for real when you're logged in |
| `/login` | Log in | Email and password, or Google |
| `/signup` | Sign up | Closed while the app is paused |
| `/forgot-password` | Forgot password | Sends the reset email |
| `/reset-password` | Reset password | Opened from the email link, which Supabase adds `code` or `access_token` to |
| `/admin/accept-invite` | Accept a staff invitation | Opened from the invitation email |

## Member pages (need a session and onboarding)

All app screens go through `ProtectedRoute` (`src/router/ProtectedRoute.tsx`):

1. **Auth required.** Without a valid Supabase session, the user goes to `/login`.
2. **Onboarding required.** A new user goes to `/onboarding` until `profiles.onboarding_done` is true **and** `profiles.native_language_id` is set.

| URL | Page |
|---|---|
| `/onboarding` | First-time setup |
| `/home` | Mixed feed of posts and people |
| `/search` | Search people and messages. Filters live in the URL: `?q=&tab=&lang=&role=&level=&scope=` |
| `/discover` | Redirects to `/search` |
| `/messages` | Conversation list |
| `/messages/:id` | One conversation |
| `/profile` | Your profile |
| `/profile/edit` | Edit your profile |
| `/u/:username` | Someone else's profile |
| `/settings` | Account, privacy and appearance |
| `/learning` | Phrases, corrections and translations |
| `/phrasebook` | Redirects to `/learning` |
| `/library` | Community library. `?tab=practice` and `?tab=saved` open those tabs |
| `/library/contribute` | Write a post |
| `/library/post/:id` | One post, with its review thread |
| `/partners` | Saved partners |
| `/bounty-queue` | Bounties: "I can answer" and "My answers" |
| `/points-history` | Points ledger |
| `/notifications` | All notifications |

**Navigation on phones.** The bottom tabs are Home, Messages, Library, Bounties and Profile. Search is in the top bar. Learning and Settings are reached from the profile page.

## Staff pages

`/admin` is guarded by `AdminRoute` (`src/router/AdminRoute.tsx`). Staff log in at `/login` like anyone else, then go through the gate: a QR code the first time, an authenticator code after that. Anyone who isn't staff goes to `/home`.

Staff only get the admin area. Learner pages send them to `/admin`, and links to a person or post open `/admin/people/<username>` or `/admin/posts/<id>`.

| URL | Section | Who |
|---|---|---|
| `/admin` | Overview | All staff |
| `/admin/reports` | Reports | All staff |
| `/admin/decisions` | Appeals, escalations, restrictions, policy | All staff (policy: admins) |
| `/admin/people` | Suspend, ban, reinstate | All staff |
| `/admin/people/:username` | Review a person | All staff |
| `/admin/posts/:id` | Review a post | All staff |
| `/admin/activity` | Moderation history | All staff |
| `/admin/blog`, `/admin/blog/:id` | Write and publish posts | All staff |
| `/admin/faq` | Edit the FAQ | All staff |
| `/admin/notifications` | Staff notifications | All staff |
| `/admin/team` | Staff and invitations | Admins (invite and remove: super admin) |
| `/admin/health` | Services, database, uptime, security | Admins |
| `/admin/logs` | Application logs, staff audit, sign-ins | Admins |
| `/admin/security` | Your authenticators, recovery codes, password | All staff |

The gate is only a convenience. The database refuses every admin call from a session without a password and an authenticator code.

## Roles

Setting `profiles.role` by hand doesn't work: a trigger refuses it, and power comes from `admin_accounts` and the login itself. See [Admin setup](ADMIN_SETUP.md) for how accounts are created and what each role can do.

## Adding a route

A new app route needs a line in `public/_redirects`, or it answers with a 404 status. `npm run check:seo` fails if the two drift apart. See [SEO](SEO.md#5a-how-it-is-built-crawlable-html-).
