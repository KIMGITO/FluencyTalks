# The Fluency Talks

> Practice a foreign language by actually talking to people who speak it well.

The Fluency Talks connects **language learners** (students abroad, expats, anyone studying a language) with **native and fluent speakers**. People follow each other, message, and help each other improve. This repo is the **web app frontend (MVP phase 1)**. Supabase is the backend for everything.

## Intentions

1. **Conversation first.** Text chat now; voice and video later, behind the same people/follow/block model.
2. **Safe by design.** Blocking, reporting and message requests ship *before* chat goes live.
3. **A real design system.** Every color, font, size, spacing value and gradient lives in one file. Restyling the whole app means editing one file.
4. **Component-driven.** Pages only compose components. If you write the same markup twice, make a component.
5. **Responsive like Facebook.** Three columns on desktop, two on tablet, one with a bottom tab bar on mobile.
6. **Portable.** Supabase today; Postgres + our own backend tomorrow (Railway, etc.).

## Quick start

```bash
npm install
cp .env.example .env        # add your Supabase URL + anon key
npm run dev
```

Supabase setup: create a project, run `supabase/migrations/0001_init.sql` in the SQL editor, then enable **Email, Google, Apple, Facebook** under Authentication → Providers. Under Authentication → URL Configuration set the **Site URL** to `https://thefluencytalks.com` and allow-list **both** `http://localhost:5173/**` and `https://thefluencytalks.com/**` under **Redirect URLs** — if the hosted whitelist still points at `localhost:3000`, production logins bounce back there instead of the app. In Google Cloud Console → Credentials, the OAuth client's **Authorized redirect URIs** must include `https://<project-ref>.supabase.co/auth/v1/callback`. Custom domain + Cloudflare Pages: add `thefluencytalks.com` (apex) and `www.thefluencytalks.com` in Cloudflare → Pages → Domains. `wrangler.toml` + `public/_redirects` 301-redirect every legacy/`www` host (`fluencytalks.com`, `www.fluencytalks.com`, `www.thefluencytalks.com`) to the apex `https://thefluencytalks.com`, and `/* → /index.html` handles React Router client-side routes.

## Folder map

```
src/
  theme/        tokens.ts (SOURCE OF TRUTH) + inject.ts (tokens -> CSS variables)
  styles/       index.css  Tailwind layers + custom classes (variables only)
  components/
    ui/         Generic primitives: Button, Input, Avatar, Card, Logo, Spinner, ThemeToggle, Tabs
    features/   Domain components: LanguageChip, ProfileCard, SocialButtons, NotificationBell
      chat/     ChatThread, MessageBubble, ReactionBar, CorrectionDialog/Card, Composer ...
      search/   SearchBox, SearchFilters, PersonResult, MessageResult
      admin/    AdminReports, AdminUsers, AdminActivity, ReportCard, ModerationDialog
    layout/     AppShell, TopBar, Sidebar, RightRail, BottomNav, AuthLayout, PageHeader
  pages/
    public/     Landing, NotFound
    auth/       Login, Signup, ForgotPassword, ResetPassword
    app/        Home, Search, Messages, Profile, Settings, Phrasebook, FollowList, Admin
  router/       Routes + ProtectedRoute + AdminRoute (admins and moderators only)
  store/        Zustand: authStore, themeStore, profileStore, languageStore, chatStore, notificationStore
  hooks/        useBreakpoint, useUnreadCount, useDebouncedValue
  lib/          supabase.ts (the only file that creates the client), translate.ts (the only file that talks to a translation provider)
supabase/migrations/   Schema as code, applied in order (see Backend section)
supabase/functions/    delete-account (Edge Function)
  services/     Typed wrappers over Postgres functions (people, social, messaging, safety, account, phrasebook, history, search)
  types/        db.ts shared types
```

## Backend (Supabase)

> **Important: reset your database after pulling this.** Two earlier rewrites of the migrations (git tags
> `backup-team-squash-2026-10-21` and the files in `supabase/migrations_archive/team_squash_v2/`) dropped
> columns and more than 30 functions the app calls, so onboarding failed (`column "status" does not exist`,
> then `set_language_profile` and `record_consent` missing). A database built from those files cannot be
> patched in place: run `supabase db reset` (local) or `supabase db reset --linked` (hosted dev project).
> **This deletes all data in that database.** Do not use it on a database with real users.

### Migrations

| File | What it is |
|---|---|
| `20261024000000_baseline.sql` | The complete, tested schema in one file: tables, security rules, messaging, safety, storage, phrasebook, corrections, notifications, search, ISO 639-3 languages, one-native-plus-one-learning language profile, points ledger and reward limits. It is the original chain 0001–0031 (kept in `supabase/migrations_archive/`) joined in order. |
| `20261024000001_message_language_and_bounties.sql` | Message language tag; who may correct (native speaker, or learner at B1+); the bounty system (`send_message(... p_bounty)`, `answer_bounty`, `list_open_bounties`, `list_my_bounties`, automatic refunds). |

**Rules for changing the database**
1. **Never edit, merge, squash or rewrite an existing migration by hand.** Add a new file with a later version number.
2. Run `npm run test:db` (needs a throwaway Postgres 15+; see `scripts/test-db.sh`) before you push. CI runs the same check on every push.
3. It builds the database from scratch, checks that **every `rpc()` call in `src/` matches a database function and its parameter names**, and replays onboarding, messaging, corrections, points, bounties, reports, blocking and admin access.
4. Hosted Supabase rejects direct `DELETE`s on `storage.*` tables; remove buckets with the Storage API or dashboard.

### Points and bounties
- Everyone starts with 100 points. Points only move through `award_points()`, which clients cannot call; every movement is a row in `points_ledger` (one per event, so nothing pays twice).
- An accepted correction earns its author +5, limited to 10 per day per corrector and 3 per day for the same message author, and nothing when the "correction" is the original text.
- **Bounty:** tick "Ask the community" in the composer (50 points held, at most 3 open). Speakers qualified in the message's language see it under Bounties and answer. When you accept an answer, that helper gets the 50 points. After 48 hours with no accepted answer, or if you delete the message, the 50 points come back.
- **Who may correct:** a native speaker of the message's language, or a learner at B1 or above. The sender chooses the language a message is written in (default: the one they are learning).
- A bounty shows the message text to other speakers of that language. The composer says so before you send.

Design rules:
- **Clients read through RLS, write through functions.** Follow, block, message, report and profile-completion are all `security definer` functions that check blocks, account status and rate limits. There are no direct insert policies on those tables.
- **Blocking is enforced in every read** via `is_blocked_between()` (both directions, silent).
- `profiles.role`, `status` and counters cannot be edited from the client (trigger-protected).
- **After adding any new function**, re-run the grants block at the end of `20261024000001_message_language_and_bounties.sql` (functions are callable by signed-in users only). Keep its last lines: `award_points` and `refund_expired_bounties` must stay internal-only.
- Make yourself an admin once: `update profiles set role = 'admin' where id = '<your uid>';` in the SQL editor.
- Deploy account deletion: `supabase functions deploy delete-account`. It is the only Edge Function, so exit cost is one small endpoint.
- Realtime is used in exactly two places (`services/messaging.ts` for messages, corrections and reactions; `services/notifications.ts` for the bell), so it can be swapped for your own WebSocket layer later.

Frontend usage: `import { searchPeople, follow, sendMessage } from '@/services'`. Errors are `ApiError` with a user-safe message.

## What's wired to the backend

| Screen | Uses |
|---|---|
| Onboarding / Edit profile | `save_profile`, `set_my_languages`, avatar upload, consent records. New users are redirected to `/onboarding` until `onboarding_done` |
| Search `/search` | The one search screen, reached from the nav tab (there is no search box in the header). One field plus **All / People / Messages** tabs and filters for language, role, level and "everyone / people you follow". Finds anyone by name or `@username` — including people you don't follow — and messages inside your own chats. Query, tab and filters live in the URL (`?q=&tab=&lang=&role=&level=&scope=`), so a search is shareable and Back works; 300 ms debounce, "Show more" paging, an exact `@handle` shown as a profile hit and the matched words highlighted in message hits. Backed by `search_people` + `search_messages` |
| Home | follow requests, suggestions = native speakers of your first learning language |
| Profile `/u/:username` | `get_profile`; blocked and missing profiles look identical |
| Follow / Message / Block / Report | `FollowButton`, `MessageButton`, `UserMenu` (used on cards, profiles and chat headers) |
| Messages | chat list + Requests tab, thread, realtime via one inbox channel, unread dot in nav |
| Corrections | "Correct" on a partner's message opens a dialog with a live word-level diff. The learner sees the diff inline and taps **Accept and save** (saves to the phrasebook) or **Dismiss**. Updates arrive in realtime |
| Phrasebook `/phrasebook` | Three tabs at **very small text** (with a text-size toggle): **Phrases** ("Save phrase" + accepted corrections), **Corrections** (every correction your messages received — original wording, suggestion, note, outcome, corrector) and **Translations** (every message you translated). Each row links back to the chat it came from |
| Reactions | Emoji chips under every message, tap to add or remove yours (`toggle_reaction`). The picker is [`emoji-picker-react`](https://github.com/ealush/emoji-picker-react) (theme-aware, full emoji set — ZWJ and skin-tone sequences allowed, limit raised to 40 chars in 0008). Counts update in realtime from the same inbox channel |
| Tap-to-translate | "Translate" under a partner's message shows it in your native language (falls back to English). Every completed translation is stored in your history (`save_translation`, deduped per text + language) and shows up in the Phrasebook's Translations tab, traceable to its message. If a translation is showing, "Save phrase" stores it with the phrase. See the privacy note below |
| Notifications | Bell in the top bar with an unread badge (`list_notifications`, `mark_notifications_read`), realtime. Follows, follow requests, accepted requests, message requests and corrections link to the right screen |
| Followers / following | `/u/:username/followers` and `/following` (`list_follows`), paged. Private accounts you don't follow show an explanation instead of a blank list |
| Moderation | `/admin` for admins and moderators: report queue with message evidence, people search, activity log. Suspend, ban and reinstate always ask for a reason. Reached from the sidebar (desktop) or Settings (mobile) |
| Settings | edit profile, blocked list with unblock, data export, account deletion |

Everything in the phase-1 scope now has a screen.

### Tap-to-translate and privacy

`lib/translate.ts` uses MyMemory's free API. The text of a message is sent to MyMemory **only when someone taps Translate**, but it does leave your system, so mention it in the privacy policy or replace the provider before launch (the file is the only place to change). Anonymous use has a small daily quota; set `VITE_TRANSLATE_EMAIL` to a real contact address to raise it. Long messages are split into chunks (about 450 bytes each) and results are cached for the session.

### Admin access

Run `update profiles set role = 'admin' where id = '<uid>';` once. Moderators (`role = 'moderator'`) can review reports and act on regular users; only admins can act on staff. The `AdminRoute` guard only hides the screens, since every admin function checks the role again in SQL.

## Theming rules (important)

Tailwind + CSS variables + custom CSS work together, all fed by `src/theme/tokens.ts`:

| Need | Where it comes from |
|---|---|
| Colors (light/dark) | `themes` in tokens.ts -> `--c-*` variables -> Tailwind `bg-surface`, `text-muted`, `bg-brand/20` |
| Fonts, sizes, spacing, radii | tokens.ts -> Tailwind theme + `--font-*`, `--space-*`, `--radius-*` |
| Gradients | `gradients` in tokens.ts -> `--grad-*` -> `bg-grad-brand`, `.ft-gradient-text` |
| Layout widths | `layout` in tokens.ts -> `--layout-*` |
| Light/dark | `data-theme` on `<html>`, set by `themeStore` |

**Never** write `#hex`, `px` font sizes, or `linear-gradient(...)` in a component. Add a token instead. Custom CSS in `index.css` may only reference `var(--...)`.

## Responsive behaviour

| Width | Layout |
|---|---|
| < 768px | One column, top bar, **bottom tab bar** |
| 768-1099px | Icon-only sidebar + content |
| >= 1100px | Sidebar (labels) + content + right rail |

Breakpoints are defined once in tokens.ts.

## State management

Zustand stores hold cross-page state (`authStore`, `themeStore`). Components call store actions; they never call Supabase directly. Add new stores per domain (`followStore`, `chatStore`, ...).

## Portability notes

- Keep schema changes as SQL migrations (never click-edit tables in the dashboard).
- Keep Supabase calls inside `lib/` and stores so swapping the backend touches few files.
- Avoid Edge Functions and Supabase-only features where a plain Postgres approach works.

## Deployment (Cloudflare Pages)

1. Install deps and create `.env` from `.env.example` with your Supabase URL + anon key.
2. `npm run build` → outputs to `dist/` (Vite). `public/_redirects` and `public/_headers` are copied into `dist/` automatically.
3. Publish: `npm run deploy` (runs `npx wrangler pages deploy dist --project-name fluencytalks`)
   - First time: run `npx wrangler pages project create fluencytalks` or create the project in the Cloudflare dashboard, then `npm run deploy` again.
   - Or connect the repo in the Cloudflare dashboard: build command `npm run build`, build output `dist`.
4. In the dashboard, add domains `thefluencytalks.com` (apex) and `www.thefluencytalks.com`. Also add legacy hosts `fluencytalks.com`, `www.fluencytalks.com` so `_redirects` can forward them.
5. Add `VITE_*` environment variables at Settings → Environment variables → Production (all client-side vars already use the `VITE_` prefix).
6. In Supabase → Authentication → URL Configuration, set Site URL to `https://thefluencytalks.com` and allow-list `https://thefluencytalks.com/**` under Redirect URLs. Add the OAuth callback `https://<project-ref>.supabase.co/auth/v1/callback` to your Google/GitHub/etc. provider credentials.

## Roadmap

1. ✅ Profile editing + languages (CEFR levels) wired to Supabase
2. ✅ Search page with tabs and filters, follow/unfollow, private profiles, followers and following lists
3. ✅ **Block + report** (RLS already hides blocked users from profiles), moderation screens
4. Text chat with message requests ✅, reactions ✅, notifications ✅. Still to do: typing indicators, read receipts
5. ✅ In-chat corrections, phrasebook, tap-to-translate
6. ✅ Account deletion (needs a server-side function with the service role), data export
7. Voice/video sessions, PWA + push, i18n/RTL

## Tests

`supabase/tests/app_flow.sql` (run by `scripts/test-db.sh`) replays the exact RPC calls the app makes (same function and parameter names as `src/services`): onboarding (language profile, profile, consents), the language rules, profiles and feed, messaging, corrections and points, reports and blocking, and admin access. It stops with a non-zero exit on the first broken step.

```bash
# any throwaway Postgres 15+ you can create databases on (never a real project):
ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db
```

It prints `ALL APP-FLOW CHECKS PASSED` and `OK: database matches the app`, or stops at the first broken step. Run it after adding or changing any migration or any `src/services/*` call. It would have caught every migration failure in this project's history.

## Known gaps

- Direction and plan: see **[docs/PRODUCT_ANALYSIS.md](docs/PRODUCT_ANALYSIS.md)** (features, what is built, what to add, bottlenecks).
- Migrations have not been verified against a live database since 0027. Apply them to a throwaway Supabase project first.
- `user_languages` is now a derived copy of the two language columns on `profiles` (kept in sync by `set_language_profile`) so the old search and feed functions keep working until they are rewritten.
- **Community library**: phrases have an `is_public` column and a read policy, but no screen publishes or browses them yet.
- **Unsplash**: search runs through the `unsplash-proxy` Edge Function, so the key stays on the server. Deploy it and set the secret: `supabase secrets set UNSPLASH_ACCESS_KEY=...` then `supabase functions deploy unsplash-proxy`. The Learning page shows a result with its photographer credit; attaching an image to a saved phrase is not built yet.
- Expired bounties are refunded the next time anyone opens the Bounties page or posts a bounty (no scheduled job needed).
- The follow system still exists in the database (`follows`, counters, `is_private`) and in `search_people`, `get_profile` and `home_feed`; the UI no longer shows it. It is replaced by *Saved Study Partners* in the next phase.
- The emoji reaction bar is commented out in `MessageBubble`; reactions can be sent from the message menu but are not displayed yet.
- Notifications are never pruned. Add a scheduled `delete from notifications where created_at < now() - interval '90 days'` when volume grows.
- No i18n yet. Strings are inline and should move to translation files before launch.
- Two deploy configs exist (`wrangler.toml` for Cloudflare Pages and `vercel.json`); pick one.
