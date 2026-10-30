# Fluency Talks - Feature Documentation

This document describes every core feature of the Fluency Talks application in
plain language. For each feature it explains what it does, how it works,
what it depends on, and when it is used.

The application is a peer-to-peer language exchange platform. A learner
declares one native language and one language they are learning. The app
matches them with people whose languages complement theirs. Partners chat,
correction each other inline, save phrases, and trade points.

---  

## 1. Account and Sign-In

### What it does
A user creates an account using their email address, Google, Apple, or
Facebook. After sign up they are automatically logged in. A profile row is
created in the database so the app can store their name, bio, and language
choices.

### How it works
- The login and signup screens collect the details and call the auth service.
- Supabase handles the actual authentication and returns a session token.
- A database trigger handle_new_user creates a profile row automatically on
  signup, so the user always has somewhere to store their settings.
- The app stores the session in Zustand (authStore) and in the browser so it
  survives page reloads.

### What it depends on
- Supabase Authentication (email + social providers).
- A Postgres table profiles keyed by the user's auth UID.
- Row-Level Security policies that allow the user to read and update only
  their own profile.

### When it is used
Every time a user opens the app. It is the first gate all other features pass
through. The login, signup, and password-reset screens are the only public
pages that exist outside this flow.

### Notes
Password reset and email confirmation are handled by Supabase itself. The
app also supports a custom forgot password screen that redirects to
Supabase's reset flow.

---  

## 2. Onboarding and Language Profile

### What it does
A brand-new user must answer a few setup questions before they can use the
app. They choose the one language they speak natively and the one language
they are learning, and set their level for the learning language (A1 to C2).
They also declare consent to the privacy policy, terms, and age requirement.

### How it works
- After login, a ProtectedRoute checks whether the user has completed
  onboarding. New users are sent to /onboarding.
- The onboarding form lets the user pick from a searchable list of languages.
  The native language is required; the learning language is optional but
  required once a level is chosen.
- When the user submits, the app calls set_language_profile, which writes
  the values into the profiles table with a 30-day cooldown on native
  language changes.
- Consent records (terms, privacy, age_18) are stored in the database
  so the user can be shown the right legal notices later.

### What it depends on
- The profiles table with native_language_id, learning_language_id,
  learning_level, onboarding_done, and consents columns.
- The languages reference table (about 100 curated languages, incl. Kenyan
  languages such as Kikuyu, Luo, Kalenjin, Luhya, Kamba, Kisii).
- The set_language_profile and record_consent database functions.

### When it is used
Only once for a brand-new user, and again whenever they change a language or
level (the first change is free, then once every 30 days).

---  

## 3. Language Reference

### What it does
The app ships with a fixed list of supported languages. Each language has a
three-letter code, an English name, a native name, a direction flag (left-to-
right or right-to-left), and a flag marking whether it is currently offered
for learning.

### How it works
- The list is stored in a Postgres table called languages and is seeded at
  deployment time.
- The app reads it through listLanguages from the people service.
- The LanguageSelect component renders a searchable A-Z picker that shows
  names in the user's own language using the browser's internationalization
  API.

### What it depends on
- The languages table and the displayLabel helper in src/lib/languages.ts.
- The user's browser locale (for showing native names in their own language).

### When it is used
Onboarding, search filters, the home feed, message language tagging, the
phrasebook, corrections, and the moderation panel. Every feature that
mentions "which language" uses this list.

---  

## 4. Home Feed and Matching

### What it does
The home feed shows a list of potential study partners, ranked from best to
worst, so the user can immediately start a conversation with a good match.

### How it works
- A single database function home_feed returns two ranked lists: one of
  partners the user can learn from, and one of other people.
- The ranking logic is: first can teach me (native language matches the
  user's learning language), then same goal (one can teach the other and
  they share a language direction or region), then same native, then
  everyone else.
- Each result includes a match_kind label explaining why that person was
  recommended (example: native = they teach your target language, or
  learning = you can teach them).

### What it depends on
- The profiles table with language and level columns.
- The home_feed database function.
- The MatchBadge component, which displays the reason for the match.

### When it is used
Every time the user opens the app. The feed is the main discovery surface.

### Notes
Matching is one-directional for now (the list does not currently suggest who
the user should message). This is a known gap.
## 5. Search

### What it does
Two search boxes let the user find people and find things that were already
said in conversation.

### How it works
- **People search** via searchPeople queries search_people, which looks
  up profiles by name or username, and can filter by language, role, and
  level. Results include a private-profile flag.
- **Message search** via searchMessages queries search_messages, which
  searches inside the user's own conversations.
- Both searches show a search field with filters: language, role, level, and
  a conversation selector.

### What it depends on
- The database functions search_people and search_messages.
- The search service and the SearchBox / SearchFilters components.

### When it is used
- The search page is reached from the top bar.
- Message search is available inside the conversation list and the chat
  thread, so a user can find a phrase they already discussed.

---  

## 6. Messaging and Conversation

### What it does
The heart of the product. Two users can start a conversation, exchange
messages, reply to each other, request or accept a message, and see read
eavesdropping hints.

### How it works
- **Starting a conversation**: start_conversation in the messaging service
  calls a database function that creates a conversation between the two users
  and returns the conversation ID.
- **Sending a message**: send_message posts the text, the sender's language
  tag, and an optional bounty flag to a send_message function.
- **Reading the thread**: getMessages reads messages one conversation at a
  time, newest first, with a before cursor for pagination.
- **Real-time updates**: a subscribeToConversation channel pushes new
  messages to everyone viewing that conversation instantly. A broader
  subscribeToInbox channel also listens for corrections and reactions.
- **Message requests**: respond_message_request accepts or rejects an
  incoming request. A request is just a pending conversation state.
- **Read receipts**: getPeerReadAt and subscribeToReceipts track the last
  time the other person read the conversation. This is stored in
  conversation_members and pushed through Realtime.
- **Editing and deleting**: editMessage and deleteMessage update or mark
  a message as deleted without removing the history.

### What it depends on
- The conversations, messages, conversation_members, and
  message_reactions tables.
- The database functions send_message, start_conversation,
  list_conversations, respond_message_request, mark_read,
  edit_message, delete_message, peer_read_at, suggest_correction,
  accept_correction, respond_correction, toggle_reaction.
- Supabase Realtime for live pushes.

### When it is used
- The Messages page shows the conversation list and opens a chat thread.
- The Composer, MessageBubble, ReactionBar, and CorrectionCard components
  live inside the chat thread.

### Notes
Message requests and read receipts exist to keep chat safe before it goes
live for everyone. Bounties are attached to messages but handled by a
separate feature below.

---  

## 7. Inline Corrections

### What it does
When a learner writes a sentence, a qualified native speaker can correct it
in place. The old text turns red, the new text turns green, and the learner
accepts or dismisses the fix. This is the core learning moment of the app.

### How it works
- A qualified user taps **Correct** on a message. They must be a native
  speaker of the message's language, or a learner at B1 or above.
- The corrector edits the sentence and adds a short note. suggest_correction
  stores a row in message_corrections with status pending.
- The learner sees the CorrectionDialog, which shows the old text in red,
  the suggested text in green, and the helper's note.
- DiffText renders the word-level difference.
- The learner accepts or dismisses via accept_correction or
  respond_correction.
- When accepted, the correction gets a history entry, the helper earns
  points, and the phrase is saved to the learner's phrasebook.

### What it depends on
- The message_corrections, message_diff, and correction_history tables.
- The qualifiedLanguages and canCorrect helpers in src/lib/corrections.ts.
- The suggest_correction, accept_correction, and
  respond_correction database functions.
- The live reception of correction events through subscribeToInbox.

### When it is used
- On the chat thread, when the other person has a qualified language in the
  message.
- It happens entirely inside an existing conversation; no new data model is
  needed.

---  

## 8. Phrasebook

### What it does
Learners save phrases they want to remember, usually ones they corrected or
were corrected in. It is a personal library of useful expressions.

### How it works
- The user taps **Save** in a chat thread. savePhrase calls save_phrase,
  which writes phrase, translation, language_id, and the source message
  ID into saved_phrases.
- listPhrases reads the list, optionally filtered by language.
- The user can tap on a phrase to open it, and delete it.
- Each phrase can also carry an Unsplash photo when the user creates it
  inside the phrasebook editor (see the library feature).

### What it depends on
- The saved_phrases table and save_phrase, list_phrases functions.
- The phrasebook page built from Phrasebook and related components.
- The source:messages(conversation_id) join to show where a saved phrase
  came from.

### When it is used
- Any time a learner wants to keep a phrase instead of losing it.
- The Learning page displays the saved phrases and the translation history.

---  

## 9. Translation and Tap-to-Translate

### What it does
A learner can translate a word or sentence instantly into their own language
or another supported language. The translation is saved to a personal history
so the learner can review it later.

### How it works
- The user selects a phrase and taps Translate. saveTranslation calls
  save_translation, which writes source_text, translated_text,
  language_id, and the original message ID into translation_history.
- listTranslations reads the history, ordered newest first.
- The user can delete a single translation.
- The Translation component in the message menu renders a translated view
  of a message on demand.

### What it depends on
- The translation_history table and the save_translation,
  list_translations functions.
- A translation provider (currently MyMemory, a free translation API).
- The translationCode helper, which maps each language's three-letter code
  to a BCP-47 tag that the translation provider understands.
- The translation_history table is created by a migration that adds the
  translation_history table and a function to keep it populated from
  message corrections.

### When it is used
- While reading a message in a foreign language, the user can tap Translate.
- The Learning page shows the saved translation history alongside the
  phrasebook.

### Notes
The translation provider is free, which means usage quotas apply and message
text leaves the app. This is disclosed in the privacy notice. A scheduled
job to prune old translations is a known future item.

---  

## 10. Points Economy

### What it does
A small rewards system that gives points to people who help. It rewards
helpful corrections and allows users to buy community help through bounties.

### How it works
- Every user starts with 100 points.
- A corrector earns +5 points when a learner accepts their correction.
  All point movements go through a single function adjust_user_points,
  which writes one row to a points_ledger table so every credit is
  auditable.
- A user can view their balance and a full history of every point earned or
  spent on the PointsHistory page. Each ledger entry shows the actor, the
  delta, the reason, and the reference (message, correction, or bounty).

### What it depends on
- The profiles.points_balance column and the points_ledger table.
- The adjust_user_points function used by messaging.ts after an accepted
  correction and by the bounty feature after a paid bounty.
- The listPointsLedger service, which joins each entry to the owner's
  display name for display.

### When it is used
- When a correction is accepted, the helper gets points automatically.
- When the user sends a bounty, they spend points up front; a paid bounty
  credits the answerer.
- The PointsHistory page is viewed whenever the user wants to see where
  their points came from.

---  

## 11. Bounties

### What it does
A learner who is stuck on a question can pay points to put a message into a
community queue. A qualified speaker answers it, and the points go to the
answerer when the asker accepts.

### How it works
- The sender picks a message and pays 50 points. sendMessage with
  bounty: true marks the message as is_bounty = true and stores
  bounty_cost = 50, bounty_status = open, and bounty_expires_at set
  to 48 hours in the future.
- The message appears in the community open-bounty list, shown to people
  qualified in that language through listOpenBounties.
- A qualified user answers it through answerBounty, which posts a text
  answer to the same message.
- When the asker accepts the answer, the bounty status becomes paid and
  the answerer gets the 50 points. If nobody answers within 48 hours, or the
  question is deleted, the status becomes refunded and the points are safe.
- A user can have at most 3 open bounties at a time (an error message
  too_many_bounties is returned otherwise).

### What it depends on
- The messages.bounty_* columns, bounty_status checks, and an index on
  messages for open bounties.
- The send_message function, which sets the bounty fields.
- The list_open_bounties, list_my_bounties, and answer_bounty
  functions.
- The Points ledger for refunds and credits.

### When it is used
- When a student is stuck on a specific sentence, they can pay to ask the
  community.
- Open bounties are listed on a BountyQueue page; the user's own bounties
  appear on the same page when they are logged in.

---  

## 12. Safety and Moderation

### What it does
The app keeps users safe from harassment, spam, scams, and abuse, and gives
moderators a place to review reports and take action.

### How it works
- **Reporting**: the user opens a ReportDialog, picks a reason from a list
  (harassment, spam, inappropriate, impersonation, underage, scam,
  fake_correction, points_abuse, other), adds details, and optionally links
  the report to a conversation. reportUser calls report_user, which
  stores the report with evidence (a snapshot of the offending message) and
  increments the target's open-report counter.
- **Blocking**: the user can block another person. The app enforces blocking
  silently: a blocked user's profile never appears in search, the feed, or
  any other read path. The blocks table is the single source of truth.
- **Auto-suspend**: if a user receives 5 reports within 7 days, the
  database function admin_set_user_status marks them suspended
  automatically.
- **Admin panel**: a moderator or admin can view reports, search users,
  see recent actions, and set a user's status to active, suspended, or banned.
  Actions are recorded in admin_actions.

### What it depends on
- The reports, blocks, admin_report_queue, admin_users,
  admin_actions, account_status tables and the report_user,
  admin_list_reports, admin_report_queue, admin_search_users,
  admin_recent_actions, admin_set_user_status functions.
- Row-Level Security policies: blocked profiles are invisible to the
  blocker, and blocked profiles are invisible to anyone blocked by them.

### When it is used
- Reporting is available from a user's profile, a message, and a conversation.
- Blocking is available from a user's profile and the blocked-list screen.
- The Admin panel is reachable only by users whose profiles.role is
  admin or moderator (checked by AdminRoute).

### Notes
Reports are never deleted; they are either actioned or dismissed. The
details of the person who reported are kept so moderators can re-contact
them if needed.

---  

## 13. Saved Partners and Saved Study Partners

### What it does
A user can bookmark another person they want to study with again later.

### How it works
- savePartner calls save_partner, which writes a row to saved_partners
  pairing the current user with the target ID.
- The list is shown on the Partners page, which reads listSavedPartners.
- The user can delete a saved partner with deletePartner.

### What it depends on
- The saved_partners table and the save_partner / delete_partner
  functions.
- The Partner page built from SavedPartner components.

### When it is used
- When a learner finds someone worth keeping in touch with, they save them
  here instead of following. This replaces the older follow system, which
  was removed from the UI so the product stays focused.

---  

## 14. Public Phrase Library

### What it does
Users who write good corrections or phrases can publish them to a shared
library so other learners can learn from them. This is a community-onramping
feature.

### How it works
- Only eligible users can post: a user with a native language, or a learner
  at B1 or above (checked by isContributionEligible).
- postContribution calls post_contribution, writing phrase,
  translation, language_id, category, source_context, and an Unsplash
  image URL into contribution_posts.
- listContributionPosts reads the public posts, optionally filtered by
  language and category. Each post shows its author's name and avatar.
- deleteContribution removes a post the user authored.

### What it depends on
- The contribution_posts table and post_contribution /
  list_contribution_posts / delete_contribution functions.
- The isContributionEligible helper, which reads the user's profile.
- The Unsplash proxy function stores picture URLs so no API key is exposed.

### When it is used
- A user is taken to the Library page from the learning page. The library
  shows posts. A contributor writes a post from the ContributionModal in the
  same area.

### Known gap
No public screen currently browses or searches the community library. The
columns, functions, and eligibility check exist, but a UI that publishes and
discovers posts is still to be built.

---  

## 15. Notifications

### What it does
The app alerts the user when something important happens: a message request,
their correction was accepted, a correction was made, or a bounty was paid.

### How it works
- The notification store keeps the received array in memory.
- subscribeToNotifications listens for new rows in the notifications
  table for the current user's ID and fires a callback when one arrives.
- listNotifications reads the array, newest first, with a limit (default 30).
- markNotificationsRead and deleteNotifications handle reads and
  deletion.
- The NotificationBell component in the top bar displays the count and a
  dropdown of recent notifications.

### What it depends on
- The notifications table and the list_notifications,
  count_unread_notifications, mark_notifications_read,
  delete_notifications functions.
- The NotificationBell component and the notification store.

### When it is used
- Any time something happens to the user that requires attention: a message
  request, a correction, an accepted correction, or a paid bounty.

---  

## 16. Profile Editing and Avatar

### What it does
The user maintains their public identity: display name, username, bio,
timezone, privacy setting, country, and avatar image.

### How it works
- saveProfile calls save_profile, which updates the profiles table.
- Avatars are uploaded to Supabase Storage in the avatars bucket, named
  avatars/{userId}/avatar-{timestamp}.{ext}. uploadAvatar returns a
  public URL that is stored in the profile.
- The avatar is displayed on the profile page, the search results, and the
  conversation list. resolveAvatar in src/lib/avatar picks the best
  image source for a user.
- The user can click their own avatar to open the settings screen where the
  form lives.

### What it depends on
- The profiles table and the save_profile function.
- Supabase Storage bucket avatars.
- The FeaturedAvatar, ProfileCard, and ProfileForm components.

### When it is used
- On the user's own profile page, and whenever another user views a profile.

---  

## 17. Account Management

### What it does
The user can delete their account permanently, export all their data, and
record their legal consent.

### How it works
- deleteAccount calls the delete-account Edge Function, which performs
  the deletion with the service role key (the anon key cannot delete data).
  The user is then signed out and redirected to the landing page.
- exportMyData calls the export_my_data function, which returns a JSON
  dump of the user's profile, messages, corrections, phrases, and other
  data they requested.
- recordConsent writes the user's agreement to the terms, privacy, or age
  requirement, and the version number, so the app can force a refresh when
  the rules change.

### What it depends on
- The delete-account Edge Function and the export_my_data function.
- The DataDeletion public page and the Account settings page.

### When it is used
- When the user decides to leave the app, or requests a copy of their data.
- When the terms or privacy policy are updated, the user is asked to confirm
  consent again.

---  

## 18. Admin Panel

### What it does
A small set of tools for moderators and admins to manage the community:
view reports, search users, suspend or ban users, dismiss reports, and see
recent actions.

### How it works
- AdminRoute checks that the user's profiles.role is admin or
  moderator. Otherwise the route is denied.
- adminListReports and adminReportQueue return open reports for the
  chosen status. Each report shows the reporter, target, reason, evidence,
  and status.
- adminSearchUsers returns a filtered list of users for a given query.
- adminRecentActions returns logged actions.
- adminSetUserStatus can set a user to active, suspended, or banned.
  - banned blocks the user's profile from reading, and sets
    account_status = banned.
  - suspended sets account_status = suspended and locks the account.
  - active restores access.
  - Each change is recorded in admin_actions.

### What it depends on
- The profiles.role check, the admin_users, admin_report_queue,
  admin_recent_actions, admin_actions, account_status tables, and the
  admin service functions above.
- The Admin page with tabs for Reports, People, and Activity.

### When it is used
- Only by admins and moderators. The panel is the control center for the
  safety feature.

---  

## 19. Landing Page and Public Legal Pages

### What it does
The outside of the app. The landing page explains the product, the benefits,
and a call to action. The public legal pages (privacy, terms, data deletion)
carry the legal text for reviewers and users.

### How it works
- The landing page uses a PublicShell component with a deep indigo header,
  footer, serif headlines, and a what you get carousel. It is built with
  minimal calls into the app (the start-button links to signup).
- All claims on the landing page describe real features only; there are no
  invented testimonials, made-up counts, premium plans, or voice/video
  promises.
- The legal pages use a LegalLayout with a contents list, a sticky column
  on desktop, and a strip of chips on mobile.

### What it depends on
- The public React pages, PublicShell, and the legal text files.
- The DataDeletion page now performs a real account deletion when the user
  is logged in (the old fake form is gone).

### When it is used
- Anyone who has not signed up (landing, login, signup) and users who are
  navigating the public legal pages.

---  

## 20. Configuration and Deployment

### What it does
The app is configured for two places: local development with a linked Supabase
project, and production on Cloudflare Pages.

### How it works
- vite.config.ts maps the @ alias to src and runs the React plugin.
- .env (gitignored) holds VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
  for local development. .env.example shows the expected variables.
- supabase/migrations is a set of numbered SQL files that define the
  whole schema. supabase/seed.sql populates reference data after a reset.
- The npm run build command creates dist, which is deployed to Cloudflare
  Pages with npm run deploy.
- wrangler.toml and vercel.json both exist. The app uses the Cloudflare
  Pages configuration, but the Vercel config is a fallback that handles
  legacy and www hostnames with 301 redirects.

### What it depends on
- Node and npm for building. Supabase CLI for local development.
- Cloudflare Pages for hosting.

### When it is used
- Whenever the app is built, tested, or deployed.

---  

## Cross-cutting dependencies between features

- **Account, onboarding, and profile** form the identity layer for every
  other feature. Search, matching, chat, corrections, points, and the admin
  panel all read or write the same profiles row.
- **Languages** are the shared vocabulary of the platform. Onboarding,
  matching, search filters, message tagging, phrasebook, corrections, and
  the public library all key on the same language table.
- **Chat is the hub.** Messages link to corrections, bounties, translations,
  and source conversations. The notification bell reads from the same
  conversation data.
- **Points** are the ledger of value. Corrections, bounties, and automatic
  rewards all draw from the same points_ledger function, so every point
  movement is auditable in one place.
- **Safety and moderation** are hidden inside every read. A blocked profile
  disappears from search, feed, and profile lookup without the user noticing,
  which is how safety is enforced at the database level rather than in UI.
