# FluencyTalks

> Practice a foreign language by actually talking to people who speak it well.

FluencyTalks connects **language learners** (students abroad, expats, anyone studying a language) with **native and fluent speakers**. People follow each other, message, and help each other improve. This repo is the **web app frontend (MVP phase 1)**. Supabase is the backend for everything.

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

Supabase setup: create a project, run `supabase/migrations/0001_init.sql` in the SQL editor, then enable **Email, Google, Apple, Facebook** under Authentication → Providers. Add `http://localhost:5173/**` to the redirect URLs.

## Folder map

```
src/
  theme/        tokens.ts (SOURCE OF TRUTH) + inject.ts (tokens -> CSS variables)
  styles/       index.css  Tailwind layers + custom classes (variables only)
  components/
    ui/         Generic primitives: Button, Input, Avatar, Card, Logo, Spinner, ThemeToggle, Tabs
    features/   Domain components: LanguageChip, ProfileCard, SocialButtons, NotificationBell
      chat/     ChatThread, MessageBubble, ReactionBar, CorrectionDialog/Card, Composer ...
      admin/    AdminReports, AdminUsers, AdminActivity, ReportCard, ModerationDialog
    layout/     AppShell, TopBar, Sidebar, RightRail, BottomNav, AuthLayout, PageHeader
  pages/
    public/     Landing, NotFound
    auth/       Login, Signup, ForgotPassword, ResetPassword
    app/        Home, Discover, Messages, Profile, Settings, Phrasebook, FollowList, Admin
  router/       Routes + ProtectedRoute + AdminRoute (admins and moderators only)
  store/        Zustand: authStore, themeStore, profileStore, languageStore, chatStore, notificationStore
  hooks/        useBreakpoint
  lib/          supabase.ts (the only file that creates the client), translate.ts (the only file that talks to a translation provider)
  data/         mock.ts (temporary seed data, delete once real queries exist)
supabase/migrations/   Schema as code, applied in order (see Backend section)
supabase/functions/    delete-account (Edge Function)
  services/     Typed wrappers over Postgres functions (people, social, messaging, safety, account)
  types/        db.ts shared types
```

## Backend (Supabase)

Run the migrations in order in the SQL editor (or `supabase db push`):

| File | Adds |
|---|---|
| 0001 | profiles, user_languages, follows, blocks, signup trigger |
| 0002 | languages list, helpers, counters, `search_people`, `get_profile`, `save_profile`, `set_my_languages`, follow/unfollow/requests, block/unblock |
| 0003 | conversations, messages, reactions, corrections, phrasebook; `start_conversation`, `send_message`, message requests, rate limits, realtime |
| 0004 | reports (with message evidence), admin actions, bans (email-hash), auto-suspend after 5 reporters in 7 days |
| 0005 | avatars bucket + policies, notifications (triggers), consents, `export_my_data`, function grants |
| 0006 | `save_phrase`, `accept_correction` (accepts and saves the corrected phrase atomically) |
| 0007 | `list_notifications`, `count_unread_notifications`; admin read functions `admin_report_queue`, `admin_search_users`, `admin_recent_actions` |

Design rules:
- **Clients read through RLS, write through functions.** Follow, block, message, report and profile-completion are all `security definer` functions that check blocks, account status and rate limits. There are no direct insert policies on those tables.
- **Blocking is enforced in every read** via `is_blocked_between()` (both directions, silent).
- `profiles.role`, `status` and counters cannot be edited from the client (trigger-protected).
- **After adding any new function**, re-run the grants block at the end of 0005 (functions are callable by signed-in users only).
- Make yourself an admin once: `update profiles set role = 'admin' where id = '<your uid>';` in the SQL editor.
- Deploy account deletion: `supabase functions deploy delete-account`. It is the only Edge Function, so exit cost is one small endpoint.
- Realtime is used in exactly two places (`services/messaging.ts` for messages, corrections and reactions; `services/notifications.ts` for the bell), so it can be swapped for your own WebSocket layer later.

Frontend usage: `import { searchPeople, follow, sendMessage } from '@/services'`. Errors are `ApiError` with a user-safe message.

## What's wired to the backend

| Screen | Uses |
|---|---|
| Onboarding / Edit profile | `save_profile`, `set_my_languages`, avatar upload, consent records. New users are redirected to `/onboarding` until `onboarding_done` |
| Discover | `search_people` (language, role, level, name), 300 ms debounce, "Show more" paging |
| Home | follow requests, suggestions = native speakers of your first learning language |
| Profile `/u/:username` | `get_profile`; blocked and missing profiles look identical |
| Follow / Message / Block / Report | `FollowButton`, `MessageButton`, `UserMenu` (used on cards, profiles and chat headers) |
| Messages | chat list + Requests tab, thread, realtime via one inbox channel, unread dot in nav |
| Corrections | "Correct" on a partner's message opens a dialog with a live word-level diff. The learner sees the diff inline and taps **Accept and save** (saves to the phrasebook) or **Dismiss**. Updates arrive in realtime |
| Phrasebook | "Save phrase" on any message, plus accepted corrections. List and delete at `/phrasebook` |
| Reactions | Emoji chips under every message, tap to add or remove yours (`toggle_reaction`). Counts update in realtime from the same inbox channel |
| Tap-to-translate | "Translate" under a partner's message shows it in your native language (falls back to English). If a translation is showing, "Save phrase" stores it with the phrase. See the privacy note below |
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

## Roadmap

1. ✅ Profile editing + languages (CEFR levels) wired to Supabase
2. ✅ Discover with filters, follow/unfollow, private profiles, followers and following lists
3. ✅ **Block + report** (RLS already hides blocked users from profiles), moderation screens
4. Text chat with message requests ✅, reactions ✅, notifications ✅. Still to do: typing indicators, read receipts
5. ✅ In-chat corrections, phrasebook, tap-to-translate
6. ✅ Account deletion (needs a server-side function with the service role), data export
7. Voice/video sessions, PWA + push, i18n/RTL

## Known gaps in this scaffold

- Not yet installed or build-tested, and the SQL has not been run against a live database; apply migrations to a throwaway Supabase project first.
- Discover/Home still use mock data; services exist but pages are not wired yet.
- Reaction removals arrive over realtime without RLS filtering (Supabase limitation for DELETE events); they carry only message, user and emoji ids, and the client ignores ones for messages it doesn't have.
- Followers and following lists link to profiles but don't show a Follow button per row (`list_follows` doesn't return the viewer's follow status). Add it to the function if you want that.
- Notifications are never pruned. Add a scheduled `delete from notifications where created_at < now() - interval '90 days'` when volume grows.
- No i18n yet. Strings are inline and should move to translation files before launch.
# FluencyTalks
