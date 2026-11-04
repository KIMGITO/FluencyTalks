# Features

Every feature of The Fluency Talks: what it does, why it helps, how it works, what it depends on and when it's used.

This file replaces `features.md` (the business view) and `FEATURES_DESCRIPTION.md` (the technical view). Function names were checked against the code on 3 November 2026. Rules for one specific area have their own files, linked where they matter.

## Contents

**Members:** [1. Accounts](#1-accounts-and-sign-in) · [2. Onboarding](#2-onboarding-and-language-profile) · [3. Languages](#3-languages) · [4. Earned levels](#4-earned-levels-and-vouches) · [5. Home feed](#5-home-feed-and-matching) · [6. Search](#6-search) · [7. Messaging](#7-messaging) · [8. Presence and typing](#8-presence-and-typing) · [9. Corrections](#9-inline-corrections) · [10. Phrasebook](#10-phrasebook-and-the-learning-page) · [11. Translation](#11-translation) · [12. Points](#12-points) · [13. Bounties](#13-bounties) · [14. Saved partners](#14-saved-partners) · [15. Library](#15-community-library) · [16. Post review](#16-post-review-and-accountability) · [17. Practice posts](#17-practice-posts) · [18. Notifications and push](#18-notifications-and-push) · [19. Profile](#19-profile-and-settings) · [20. Your data](#20-your-data-and-consent)

**Safety and staff:** [21. Reports and blocking](#21-reports-and-blocking) · [22. Admin area](#22-admin-area) · [23. Pause switch](#23-pausing-the-app) · [24. Archive](#24-records-and-archiving)

**Public site:** [25. Public pages](#25-public-pages) · [26. Blog and FAQ](#26-blog-and-faq)

**Everywhere:** [27. Cross-cutting behaviour](#27-behaviour-across-the-whole-app) · [28. How features connect](#28-how-the-features-connect)

---

## 1. Accounts and sign-in

**What it does.** People create an account with an email and password, or with Google, and can recover access if they forget their password.

**How it helps.** Each learner gets a personal space for their profile, languages, conversations, phrases, history and points, so they never start over.

**How it works**
- The login and signup screens call the auth service, and Supabase handles authentication and returns a session.
- The database trigger `handle_new_user` creates a profile row on signup, so the user always has somewhere to store settings.
- The session lives in `authStore` and in the browser, so it survives a reload.
- Learner passwords need at least 8 characters. Staff passwords need at least 12.
- Password reset uses a custom forgot-password screen on top of Supabase's reset flow.

**Depends on.** Supabase Auth, the `profiles` table keyed by the user's auth id, and row-level security.

**When it's used.** Every time someone opens the app. It's the first gate for every other feature.

**Limits.** The code has types for Apple and Facebook sign-in, but only the Google button is on screen. Staff can't use Google or email links to enter the admin area.

## 2. Onboarding and language profile

**What it does.** A new user chooses the one language they speak natively, optionally one language they're learning, and their level from A1 to C2. They also confirm they are 16 or older and accept the terms and privacy policy.

**How it helps.** The app gets what it needs to suggest partners, and the level tells partners how to communicate.

**How it works**
- `ProtectedRoute` sends users to `/onboarding` until `onboarding_done` is true and a native language is set.
- The native language is required. The learning language is optional, and required once a level is chosen.
- `set_language_profile` writes the values to `profiles`. The two languages can't be the same.
- The first language change is free. After that, the language you're learning can change every 7 days and your native language every 30.
- `record_consent` stores each consent with its version, and also adds it to the [permanent consent ledger](DATA_RETENTION.md#proof-of-consent).

**Depends on.** `profiles` (`native_language_id`, `learning_language_id`, `learning_level`, `onboarding_done`), `languages` and `consents`.

**First steps.** Home shows a short checklist for a new member (`FirstSteps`): write a post, say hello, earn a first level. It goes away once done or dismissed.

**When it's used.** Once for a new user, and again whenever they change a language.

## 3. Languages

**What it does.** A shared, searchable list of languages. 40 major world languages are offered at launch, including English, Vietnamese and Swahili.

**How it helps.** People can find a language under its local name, and profiles, matching, chats, corrections and saved phrases all use the same list.

**How it works**
- Each language has a three-letter id, an English name, a native name, a direction and an `is_supported_learning` flag.
- Production holds the 40 launch languages plus Mandarin Chinese, which isn't offered (migration `20261103101500_reference_data`). `supabase/seed.sql` adds 68 more for local development, making 109 locally.
- Users can only pick launch languages. A profile that already holds another language keeps it.
- `LanguageSelect` renders a searchable A–Z picker, using the browser's internationalisation API to show names in the user's language.

**Depends on.** The `languages` table, `listLanguages` and `displayLabel` in `src/lib/languages.ts`.

**When it's used.** Onboarding, search filters, the feed, message tagging, the phrasebook, corrections, the library and moderation.

## 4. Earned levels and vouches

**What it does.** The level a user picks is only their own estimate, and it unlocks nothing. After setup they can lower it but not raise it. A separate **verified level** rises by itself, and that alone lets a learner correct others, answer bounties, teach and earn in their learning language. Practice posts need no level.

**How it helps.** Trust comes from real activity, so someone can't claim a high level to gain privileges.

**How it works.** The level reads distinct messages and written posts, active days, reviewers who replied (native speakers, or people verified at B2+ in the language; from B1 up, only those here 7+ days count), and the error rate over the latest 50 reviewed messages. It's re-checked whenever a post, correction, decision, rating, confirmation or save happens. Likes and post counts never move it. From B2 it also reads accepted corrections, helpfulness ratings and saves of the learner's posts. These are the current thresholds in `level_rules`:

| Level | Messages | Active days | Reviewers | Reviewed | Max error % | Corrections accepted | Helpful % | Post saves | Vouches instead |
|---|---|---|---|---|---|---|---|---|---|
| A1 | 5 | 1 | 0 | 0 | 100 | 0 | 0 | 0 | |
| A2 | 20 | 3 | 1 | 10 | 80 | 0 | 0 | 0 | |
| B1 | 80 | 7 | 2 | 40 | 50 | 0 | 0 | 0 | 2 |
| B2 | 200 | 14 | 2 | 100 | 35 | 5 | 60 | 0 | |
| C1 | 400 | 30 | 3 | 200 | 20 | 20 | 70 | 3 | |
| C2 | 800 | 60 | 3 | 400 | 10 | 50 | 80 | 10 | |

Changing the learning language resets the verified level. It otherwise never falls. Progress shows on the profile form (`LevelProgress`), with what you've contributed listed separately. An accepted correction counts with up to 3 a day and 10 overall from one person, and a chat correction with no explanation counts as half. What counts, and why, is in [The contribution system](CONTRIBUTION_SYSTEM.md#how-levels-work).

**Vouches.** Two native speakers who have really chatted with a learner (15+ of the learner's messages over 2+ days) can vouch from the learner's profile. That reaches B1 and no further, and needs the learner's recent error rate to hold. Each voucher has 3 vouches a month. Someone new can vouch straight away, and their vouch starts counting once they've been here 7 days.

**What others see.** Cards show a learner's verified level. With none yet, they show the level the person gave, with no label casting doubt on it.

## 5. Home feed and matching

**What it does.** Home is one column like a social feed: everyone's posts of every type, your own included, with rows of small square cards for people between them. It always opens with posts.

**How it helps.** Members see useful content straight away and meet good partners along the way, without searching.

**How the mix works** (`src/lib/feedMix.ts`)
- A sideways row of up to 6 people appears after every 3, then 6, then 5 posts, and the pattern repeats. Each square card leads with the person's native language (`PeopleRow`).
- A request for help takes every third post slot, from the second post on.
- A row's place depends only on how many posts come before it, so loading more posts never moves what's on screen.
- Once posts run out, one more row shows at the end. The rest are a search away.
- Posts in the reader's two languages come first, then the rest.

**How matching works** (`home_feed`)
1. **Swap:** their native language is my target, and their target is my native language. This is the best match, never a requirement.
2. **Teacher:** their native language is my target, whatever they are learning, even nothing.
3. **Learner:** they are learning my native language, whatever their own native language is.
4. **Everyone else.** Sharing a native or target language isn't a match.

Anyone you've chatted with in the last 30 days is left out, since they're already in Messages. Someone you lost touch with comes back, marked with when you last chatted.

Within a tier, people are ordered by the most recent day they were active, then timezone closeness, then newest. Follower count plays no part. Each person carries a `match_kind` label explaining the suggestion (`MatchBadge`), and `match_pool` counts teachers and learners for empty states.

**When it's used.** Every time a member opens the app. It's the main discovery surface.

**Limits.** The feed is built from language and activity only. Timezone is a tie-breaker, not a filter.

## 6. Search

**What it does.** One search screen at `/search` finds anyone by name or `@username`, including people you've never met, and finds messages inside your own chats.

**How it helps.** Learners can find a specific partner and go back to an explanation without scrolling through a conversation.

**How it works**
- One field with **All / People / Messages** tabs, and filters for language, role, level and scope.
- Query, tab and filters live in the URL (`?q=&tab=&lang=&role=&level=&scope=`), so a search can be shared and Back works.
- Typing is debounced by 300 ms. "Show more" pages through results. An exact `@handle` shows as a profile hit, and matched words are highlighted in message hits.
- It's backed by `search_people` and `search_messages`.

**When it's used.** From the sidebar on desktop and the top bar on phones. `/discover` redirects here.

## 7. Messaging

**What it does.** The heart of the product. Two people start a conversation, exchange messages, reply, react, and edit or delete their own messages. A first contact arrives as a request the other person can accept or reject.

**How it helps.** This is where the language exchange happens. Requests give people control over who can start a chat.

**How it works**
- `start_conversation` creates the conversation, and a request is just its pending state. `respond_message_request` accepts or rejects it.
- `send_message` stores the text, the language tag and an optional bounty flag. The sender chooses the language, which defaults to the one they are learning.
- `getMessages` reads newest first, with a cursor for paging.
- `subscribeToConversation` pushes new messages live, and `subscribeToInbox` also carries corrections and reactions.
- `getPeerReadAt` and `subscribeToReceipts` drive read receipts, stored in `conversation_members`.
- `edit_message` and `delete_message` change or mark a message without losing the history.
- Reactions show as emoji chips and use `toggle_reaction`. The picker is `emoji-picker-react`, with a limit of 40 characters so skin tones and joined emoji work.
- Limits: 30 messages a minute and 20 new chats a day.

**Depends on.** `conversations`, `conversation_members`, `messages`, `message_reactions` and Supabase Realtime.

**When it's used.** On the Messages page, with the chat list and Requests tab, and an unread dot in the navigation.

## 8. Presence and typing

- The app sends a heartbeat every 30 seconds while the tab is visible and in use (`touch_presence`), from any page.
- Someone counts as online for 70 seconds after a heartbeat. An open tab left alone for 5 minutes stops counting.
- `presence_of` answers for specific people. Online status is visible to signed-in people who aren't blocked. Last seen is visible only to accepted chat partners.
- The `show_activity` setting hides it both ways.
- Typing goes between the two browsers over a private realtime channel, checked against conversation membership, and isn't stored. It stops when the message is sent or the text is cleared.

## 9. Inline corrections

**What it does.** A qualified partner corrects a sentence in place. The old text shows in red and the new text in green, and the learner accepts or declines. This is the core learning moment of the app.

**How it helps.** Everyday conversation becomes a lesson, with a record of what changed and why.

**How it works**
- A person may correct a message if they are a native speaker of its language, or a learner **verified** at B1 or above (`can_correct_language`, with `qualifiedLanguages` and `canCorrect` in `src/lib/corrections.ts`).
- `suggest_correction` stores a row in `message_corrections` with status `pending`. It refuses text that doesn't change anything.
- `CorrectionDialog` and `CorrectionCard` show the change with `DiffText`, which renders a word-level diff, plus the helper's note.
- `accept_correction` accepts and saves the phrase to the learner's phrasebook. `respond_correction` declines, and a reason is required and sent to the helper.
- After deciding, the learner can rate the correction helpful or not helpful.
- Limits: 20 corrections an hour and 30 a day.

**When it's used.** Inside a chat thread. Corrections on library posts are a separate system, and [Corrections and bounties](CORRECTIONS_AND_BOUNTIES.md) explains why the two stay apart.

## 10. Phrasebook and the Learning page

**What it does.** A personal collection of phrases on the Learning page (`/learning`, and `/phrasebook` redirects there). It has three tabs in small text with a text-size toggle: **Phrases**, **Corrections** (every correction your messages received, with outcome and corrector) and **Translations**. Rows link back to the chat they came from.

**How it helps.** Useful expressions don't get lost in long conversations.

**How it works**
- `save_phrase` writes the phrase, translation, language and source message to `saved_phrases`. Accepted corrections are saved automatically.
- `listPhrases` reads the list, optionally by language. People can open and delete phrases.
- The Learning page can also look up an Unsplash photo with its photographer's credit.

**Limits.** Attaching an image to a saved phrase isn't built, even though the `unsplash_image_url` column exists. Images only appear on library posts.

## 11. Translation

**What it does.** "Translate" under a partner's message shows it in your native language, falling back to English. Each completed translation goes into a personal history that you can review and delete.

**How it works**
- `src/lib/translate.ts` calls the MyMemory free API. It's the only file that talks to a translation provider, so the provider can be changed in one place.
- `translationCode` maps each language's three-letter id to a tag the provider understands.
- Long messages are split into chunks of about 450 bytes, and results are cached for the session.
- `save_translation` stores the result, deduplicated per text and language, in `translation_history`. If a translation is showing, "Save phrase" stores it with the phrase.
- `VITE_TRANSLATE_EMAIL` raises the free daily quota.

**Privacy.** Text goes to MyMemory **only when someone taps Translate**, but it does leave our system. Availability depends on the provider's limits. The privacy policy discloses this, and it may count as a cross-border transfer ([open legal items](LEGAL_COMPLIANCE.md)).

## 12. Points

**What it does.** A small reward system with a visible balance and a full history at `/points-history`. Points reward helping and can buy community help through bounties.

| Event | Points |
|---|---|
| Starting balance | +100 |
| Your correction is accepted (chat or library post) | +5 to the corrector |
| Your bounty answer is accepted | +50 to the helper |
| You post a bounty | −50, held |
| Bounty expires or its message is deleted | +50 back |
| Posting to the library | Nothing |

**How it works**
- Points only move through `award_points`, which clients can't call. Each movement is one row in `points_ledger`, one per event, so nothing pays twice.
- The +5 is limited to 10 a day per corrector and 3 a day from the same message author. It only applies to a real edit on a message with a language tag.
- A corrector whose recent ratings are mostly "not helpful", from at least 3 people, stops earning the +5 until that recovers. Bounty payouts aren't affected, because the asker chose that answer.

## 13. Bounties

**What it does.** A stuck learner spends 50 points to put a message in front of qualified speakers. The chosen helper gets the points.

**How it works**
- Tick "Ask the community" in the composer. The message gets `is_bounty`, `bounty_cost = 50`, `bounty_status = open` and `bounty_expires_at` 48 hours away.
- The composer warns that the message text will be shown to other speakers of that language.
- Qualified people see it on the Bounties page (`/bounty-queue`) under **I can answer**, and each may send one answer (`answer_bounty`).
- When the asker accepts an answer, the status becomes `paid` and that helper gets the 50. Other answers become `superseded`.
- After 48 hours with no accepted answer, or if the message is deleted, the status becomes `refunded`. Refunds run when anyone opens the Bounties page or posts a bounty, so no scheduled job is needed.
- Each person may have at most 3 open bounties (`too_many_bounties`).

The full state machine and audit are in [Corrections and bounties](CORRECTIONS_AND_BOUNTIES.md).

## 14. Saved partners

**What it does.** Private bookmarks of people to study with again, on `/partners`. There are no follower counts, and the other person isn't told.

**How it works.** `savePartner` and `deletePartner` write to `saved_partners`, and `listSavedPartners` reads it. Saving is done from `UserMenu` on cards, profiles and chat headers, which also holds Block and Report. `MessageButton` starts a chat.

**Limits.** The older follow system still exists in the database (`follows`, counters, `is_private`) and inside `search_people`, `get_profile` and `home_feed`, but no screen shows it. Removing it is on the [roadmap](ROADMAP.md).

## 15. Community library

**What it does.** Qualified members publish phrases, idioms, usage notes, grammar notes and longer lessons, with a translation, context and an optional Unsplash image, which can carry the text. Others save them and learn from them. Learners' own writing goes to [Practice](#17-practice-posts) instead.

**How it helps.** Knowledge from outside a learner's own chats becomes a shared resource.

**How it works**
- A teaching post needs a language the author qualifies in: native, or verified B1+ in their learning language. The composer explains when a learning language isn't open yet, and the database checks again.
- Phrase, translation and context can each be up to 500 characters, and lesson text up to 5,000. Text on an image is limited to 120. The limit is 20 posts a day.
- Each category has its own colour and mark (`postLooks.ts`).
- `post_contribution` writes to `contribution_posts`, and `listContributionPosts` reads by language and category.
- Editing may keep a post's language even if the author no longer qualifies. Moving it to another language needs the qualification.
- Authors can delete their own posts, unless a decision is still open. Readers can save up to 500 posts.
- Unsplash searches go through the `unsplash-proxy` function, so the key stays on the server.

**When it's used.** The Library page has **All posts**, **Practice** and **Saved** tabs. Library posts are for signed-in members only and aren't public on the web. A [plan](PUBLIC_CONTENT_SEO.md) exists for making opted-in posts searchable, but it isn't built.

## 16. Post review and accountability

**Review.** Anyone qualified in the language can confirm a post, propose a correction or ask for clarification, and anyone can reply. It all lives in `post_discussion`, on the post page (`/library/post/:id`).

- A correction has a target, a proposed phrase or translation, an explanation, an author, a status and a history. A reply has none of those, and table constraints enforce the difference.
- Nothing is overwritten. The original stays in `phrase` and `translation`, and the accepted version sits in `current_phrase` and `current_translation`.
- Post statuses: Awaiting feedback, Corrections received, Under review, Reviewed.
- Correction statuses: `pending`, `accepted`, `declined`, `superseded`, `withdrawn` and `resolved` (clarifications only).
- The post's owner decides: accept, decline, or ask the person about it. Accepting replaces only the previously accepted correction, so other proposals stay open and the post stays "Corrections received". Newest doesn't win. Moderators can decide or reverse with a required reason.
- On a lesson, a correction covers one sentence, and several can be accepted. The original stays in `body`, and `current_body` holds the corrected reading.
- Accepted corrections go to the author's phrasebook.
- Qualified people can flag a correction as wrong. The author sees the count.
- Text under review can't be edited. A post with open decisions can't be deleted by its owner.
- An accepted correction earns +5 under the same limits as chat corrections.

**Accountability.** On a teaching post, a correction or clarification creates a `decision_items` row for the post's owner. Practice posts never do. Only a decision, a withdrawal or an exemption closes it. Being online or opening it never does.

`accountability_sweep` sends reminders, overdue notices and escalations. It runs from pg_cron where available, and otherwise from app activity. These are the defaults, which admins can change in `accountability_policy` (Decisions page):

| Setting | Default |
|---|---|
| First reminder, then repeats | After 48 hours, then every 48 hours |
| Decision deadline | 7 days |
| Escalation to moderators | 72 hours after the deadline |
| Warning | At 3 decisions overdue for 72 hours |
| New teaching posts paused | 72 hours after the warning, if still at 3 |
| Asking about a correction | Restarts the deadline, once per correction |
| Extensions | One, of 7 days |

A pause covers new teaching posts only: practice posts, chat and replies carry on. It lifts by itself once decisions are answered. Owners can ask for an extension or appeal, and every step is audited.

## 17. Practice posts

**What it does.** Any learner can publish from day one with no level needed: **Correct me**, **How do I say…?**, **Story or journal**, **Photo and caption**, and **Question or discussion**. These posts show on the Library's Practice tab and in the Home feed.

**How it's different from a library post**
- The owner has no duty and no deadline, and can't be restricted because of them. Being paused for overdue teaching decisions doesn't stop practice posts either.
- The original stays visible, with each fix shown as a diff. A fix the owner thanks goes to their phrasebook, and "Add to phrasebook" works on any fix.
- Readers fix a story one sentence at a time, and it shows a corrected reading beside the original. A question takes replies from anyone, and no corrections.
- Up to 280 characters, stories up to 5,000, and 5 posts a day.
- Open posts appear in the **I can answer** queue and notify up to 5 qualified people. A language with few helpers shows an honest note in the composer.
- Correct me posts, stories and photo captions count toward levels, with B1 still anchored in real chat. Fixes on them don't count against the author's error rate.

The full rules and what can happen are in [The contribution system](CONTRIBUTION_SYSTEM.md).

## 18. Notifications and push

**In-app.** A bell with an unread badge, a dropdown and a full page at `/notifications`, updated live. It covers message requests, corrections and their outcomes, bounties, post reviews, help on practice posts, level-ups and vouches. `listNotifications` reads newest first, and `markNotificationsRead` and `deleteNotifications` manage them. Read notifications are removed after 180 days.

**Web push.** A notifications row reaches the owner's devices after it commits: `trg_push_notification` (pg_net), then the `send-push` function, then the service worker (`public/sw.js`).

- The function claims the row first, so a retry can't send twice.
- Only rows that passed preferences and mutes exist, so push follows the same rules.
- Events on one post replace each other on the device, and a focused app shows no banner.
- Signing out removes that device, and devices the push service reports as gone are deleted.
- There's no retry if the function itself fails, though the in-app notification is still there.
- iPhones need the app added to the Home Screen.

Setup is in [Deployment](DEPLOYMENT.md#web-push).

## 19. Profile and settings

**Profile.** Display name, username, bio, country, time zone, privacy setting and photo. `save_profile` updates `profiles`. `resolveAvatar` in `src/lib/avatar.ts` picks the best image source.

**Photos** go in the `avatars` bucket under the user's own folder: JPEG, PNG or WebP, up to 2 MB, at most 5 files. `profiles.avatar_url` only accepts your own folder or a Google photo, so a profile can't load a tracking image in other people's browsers.

**Other people's profiles** (`/u/:username`) use `get_profile`. Blocked and missing profiles look identical.

**Settings** covers profile, email, password, activity status, blocked people, your data, help, appearance (light, dark or device) and deleting your account.

## 20. Your data and consent

- **Export:** `exportMyData` calls `export_my_data`, which returns a JSON copy of what we store about you. It reads live data only.
- **Delete:** `deleteAccount` calls the `delete-account` function, which needs the service role because the browser can't do this. The user is signed out and returned to the landing page. Staff can't delete their account this way.
- **Consent:** `recordConsent` records agreement to the terms, the privacy policy and the age requirement, with the version, so updated terms can be presented.
- **Proof of consent is kept permanently,** even after deletion. See [Data retention](DATA_RETENTION.md).

## 21. Reports and blocking

**Reporting.** `ReportDialog` lets someone report a person or a post, with a reason and optional details. Reasons: harassment, spam, inappropriate, impersonation, underage, scam, fake correction, points abuse, other. `report_user` and `report_post` store the report with a snapshot of the evidence. The limit is 10 reports an hour. Reports notify the super admin and every admin in the app.

**Blocking.** Silent and two-way, enforced in every read by `is_blocked_between()`. A blocked person disappears from search, the feed and profile lookups. `blocks` is the single source of truth, and people can unblock from Settings.

**Automatic suspension.** Five **different people** reporting someone within 7 days suspends the account automatically, recorded in `moderation_actions` as `auto_suspend`. This rule should be reviewed as part of the moderation policy, so reports are assessed fairly and reversing a suspension is clear.

**Retention.** Reports are actioned or dismissed, not deleted when decided. The reporter's details are kept so moderators can contact them again. They're [archived, then destroyed](DATA_RETENTION.md) after 3 years.

## 22. Admin area

Staff use a separate area at `/admin`, and staff accounts can't use the learner app. Roles and what each can see are in [Admin setup](ADMIN_SETUP.md).

| Section | What it's for | Who |
|---|---|---|
| Overview | What needs attention, community numbers, site status | All staff |
| Reports | Every report and its evidence | All staff |
| Decisions | Appeals, escalations, restrictions and the accountability policy | All staff (policy: admins) |
| People | Find anyone, then suspend, ban or reinstate with a reason | All staff |
| Activity | What the moderation team has done | All staff |
| Blog | Write, preview and publish posts | All staff |
| FAQ | The questions on the FAQ and home pages | All staff |
| Notifications | The staff member's own notifications | All staff |
| Team | Staff accounts and invitations | Admins (invite and remove: super admin) |
| Health | Services, database, uptime, security and archive state | Admins |
| Logs | Application errors, staff audit trail and sign-ins | Admins |
| Security | Your own authenticators, recovery codes and password | All staff |

`adminSetUserStatus` sets `profiles.status` to active, suspended or banned, and each change goes in `moderation_actions`. Links to a reported person or post open review pages inside the admin area. Every admin function checks the role and the login again in SQL, so `AdminRoute` only decides what to show.

## 23. Pausing the app

Admins can pause everything from **Overview → Site status**, with an authenticator code and a reason. Learners see a maintenance page, and the API refuses them. Public pages and login stay up. See [Security](SECURITY.md#taking-the-app-down).

## 24. Records and archiving

Logs and records that keep growing move out of the database into compressed files, with a tamper-proof copy in write-once storage, and are destroyed on schedule. Messages aren't archived. See [Data retention](DATA_RETENTION.md).

## 25. Public pages

**What it does.** Explains the product before sign-up: the landing page, 40 language pages, About, and the legal pages (privacy, terms, data deletion).

**How it works**
- Every page uses `PublicShell`, with the same header and footer. The design is in [Design system](DESIGN_SYSTEM.md).
- Pages are prerendered to plain HTML at build time, so crawlers can read them without JavaScript.
- All claims describe real features. There are no invented testimonials, made-up counts, premium plans or voice and video promises.
- Legal pages use `LegalLayout`, with a contents list that's a sticky column on desktop and a strip of chips on mobile.
- The data deletion page really deletes the account when the user is logged in.

## 26. Blog and FAQ

**What it does.** Staff write posts at `/admin/blog` and edit questions at `/admin/faq`. Both go live without a deploy.

**How it works**
- `worker/index.ts` serves `/blog`, `/blog/<slug>`, `/`, `/faq`, `/sitemap.xml` and `/llms.txt` from the database as finished HTML, cached at the edge for 60 seconds. An unknown post gets a real 404.
- The blog editor uses Tiptap. Saving only touches `draft`, and only publishing changes the public columns.
- Stored post bodies are only rendered through the allow-list in `src/lib/blogHtml.ts`, so a post can't inject script.
- If the database fails, `/` and `/faq` fall back to the static file plus a browser fetch.

Production has 13 published posts and 21 FAQ questions from the migrations, and staff may have added more since.

## 27. Behaviour across the whole app

These apply to every screen, and [App-wide rules](APP_WIDE_RULES.md) has the details.

- **Friendly errors only:** no backend or crash text ever reaches the screen.
- **No browser validation pop-ups:** forms check input in code and show our own messages.
- **Data is checked before it reaches the database.**
- **Phone keyboard:** the field you're typing in moves into the space above the keyboard, and the page returns to where it was when the keyboard closes.
- **Responsive layout:** one column with a bottom tab bar on phones, an icon sidebar on tablets, a full sidebar with a right rail on desktop.
- **Light and dark themes,** and installable as a web app (`manifest.webmanifest`).

## 28. How the features connect

- **Account, onboarding and profile** are the identity layer. Search, matching, chat, corrections, points and the admin area all read or write the same `profiles` row.
- **Languages** are the shared vocabulary. Onboarding, matching, filters, message tags, the phrasebook, corrections and the library all key on the same table.
- **Chat is the hub.** Messages link to corrections, bounties, translations and source conversations.
- **Points are the ledger of value.** Corrections and bounties all go through `award_points`, so every movement can be audited in one place.
- **Safety is inside every read.** A blocked profile disappears from search, the feed and lookups, because it's enforced in the database rather than the UI.
