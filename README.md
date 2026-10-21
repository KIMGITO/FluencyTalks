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
| 0008 | `translation_history` (every Translate tap, deduped and traced to its message), `save_translation`, `list_my_corrections`, reaction emoji limit 8 → 40 (ZWJ/skin tones), translations added to `export_my_data` |
| 0009 | Central search: `search_people` rewritten (leading `@` allowed, wildcards escaped, relevance order, role/level filters that work on their own, `p_scope` "people you follow") and `search_messages` added so `/search` can search your own chats |
| 0010 | `country_code` on profiles + `home_feed()` (partners first, everyone else after, with the reason for the match) |
| 0011 | **ISO 639-3 everywhere.** `languages` rebuilt around its standard 3-letter `id` (`iso_639_1`, `english_name`, `native_name`, `is_supported_learning`); `user_languages.language_id` replaces the free-text `language_code`, FK `ON DELETE CASCADE`; `saved_phrases` and `translation_history` re-pointed at the same table; `search_people`/`home_feed` match on ids; person payloads carry both display names. Existing rows are mapped, so no profile loses a language. `supabase/seed.sql` loads the curated list of 100 languages |
| 0012–0019 | single reaction, deleted-message handling, follow-back, read receipts, provider avatar, follow languages |
| 0020–0026 | *(blog/posts system, added then removed; see git history. Not part of the product.)* |
| 0027 | `points_balance` (default 100), `adjust_user_points`, +5 for an accepted correction, public phrase library columns incl. `unsplash_image_url` |
| 0028 | drops the posts system |
| 0029 | restores function grants lost in 0028 and makes `adjust_user_points` internal-only |
| 0030 | **One native + at most one learning language.** `profiles.native_language_id / learning_language_id / learning_level` with constraints; `set_language_profile()` is the only way to change them (30-day cooldown after the first change); the open client write policy on `user_languages` is removed; launch list of 40 languages; `set_my_languages` removed |

Design rules:
- **Clients read through RLS, write through functions.** Follow, block, message, report and profile-completion are all `security definer` functions that check blocks, account status and rate limits. There are no direct insert policies on those tables.
- **Blocking is enforced in every read** via `is_blocked_between()` (both directions, silent).
- `profiles.role`, `status` and counters cannot be edited from the client (trigger-protected).
- **After adding any new function**, re-run the grants block at the end of 0030 (functions are callable by signed-in users only). Keep its last line: `adjust_user_points` must stay internal-only.
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

## Known gaps

- Direction and plan: see **[docs/PRODUCT_ANALYSIS.md](docs/PRODUCT_ANALYSIS.md)** (features, what is built, what to add, bottlenecks).
- Migrations have not been verified against a live database since 0027. Apply them to a throwaway Supabase project first.
- `user_languages` is now a derived copy of the two language columns on `profiles` (kept in sync by `set_language_profile`) so the old search and feed functions keep working until they are rewritten.
- The follow system still exists in the database (`follows`, counters, `is_private`) and in `search_people`, `get_profile` and `home_feed`; the UI no longer shows it. It is replaced by *Saved Study Partners* in the next phase.
- The emoji reaction bar is commented out in `MessageBubble`; reactions can be sent from the message menu but are not displayed yet.
- Notifications are never pruned. Add a scheduled `delete from notifications where created_at < now() - interval '90 days'` when volume grows.
- No i18n yet. Strings are inline and should move to translation files before launch.
- Two deploy configs exist (`wrangler.toml` for Cloudflare Pages and `vercel.json`); pick one.
