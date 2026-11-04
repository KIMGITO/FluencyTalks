# Database

Postgres on Supabase: 58 tables, about 240 functions, and row-level security throughout. Production is hosted in Ireland (`eu-west-1`).

## Migrations

There's one file per area, holding the final definition of everything in it. Content is kept apart from schema. The chain was consolidated into these 20 files on 3 November 2026.

| File | What it is |
|---|---|
| `20261103100000_foundation.sql` | Default privileges, language and country tables, shared helpers |
| `20261103100100_accounts.sql` | Profiles, language profile, sign-up guards, avatars bucket |
| `20261103100200_staff_access.sql` | Staff accounts and MFA, audit trail, logs, health |
| `20261103100300_app_controls.sql` | Pause switch, rate limits, `check_request` |
| `20261103100400_social_graph.sql` | Follows, blocks, saved partners, matching, `home_feed`, `search_people` |
| `20261103100500_notifications.sql` | Notification feed, web push, nav badges |
| `20261103100600_messaging.sql` | Conversations, messages, reactions, read receipts |
| `20261103100700_moderation.sql` | Reports, restrictions, appeals, accountability sweep |
| `20261103100800_community_posts.sql` | Contribution and help posts, discussions, endorsements |
| `20261103100900_corrections.sql` | Corrections workflow and bounties |
| `20261103101000_phrasebook.sql` | Saved phrases, translation history |
| `20261103101100_points_and_levels.sql` | Points ledger, earned levels, vouches |
| `20261103101200_consent_ledger.sql` | Consents, legal document versions, hash-chained ledger |
| `20261103101300_data_archive.sql` | Retention, archive batches, legal holds, checkpoints |
| `20261103101400_blog.sql` | Blog table, staff editor, images bucket |
| `20261103101500_reference_data.sql` | Settings rows, launch languages, countries, level rules, rate limits, retention periods |
| `20261103101600_legal_documents.sql` | Wording and text of each consent version |
| `20261103101700_blog_posts.sql` | The published posts |
| `20261103101800_faq.sql` | FAQ table and staff editor |
| `20261103101900_faq_questions.sql` | The FAQ questions |

`supabase/seed.sql` adds the languages beyond the launch list, for local development only. `db push` never runs it, so anything production needs belongs in a migration.

## Tables by area

| Area | Tables |
|---|---|
| Reference | `languages`, `countries` |
| People | `profiles`, `user_languages`, `banned_emails`, `user_presence` |
| Staff | `admin_accounts`, `admin_invitations`, `admin_recovery_codes`, `admin_audit_log`, `app_logs`, `system_heartbeats`, `super_admin_bootstrap` |
| Controls | `app_status`, `rate_limit_rules` |
| Social | `follows`, `blocks`, `saved_partners` |
| Notifications | `notifications`, `push_settings`, `push_subscriptions`, `message_push_claims`, `tab_seen` |
| Messaging | `conversations`, `conversation_members`, `messages`, `message_reactions` |
| Moderation | `reports`, `moderation_actions`, `accountability_policy`, `accountability_audit`, `accountability_warnings`, `decision_items`, `user_restrictions`, `restriction_appeals` |
| Library | `contribution_posts`, `post_discussion`, `post_discussion_events`, `post_endorsements`, `post_thread_mutes`, `saved_posts` |
| Corrections | `message_corrections`, `correction_agreements` |
| Phrasebook | `saved_phrases`, `translation_history` |
| Points and levels | `points_ledger`, `level_rules`, `level_vouches` |
| Consent | `consents`, `consent_documents`, `consent_ledger` |
| Archive | `retention_policies`, `archive_settings`, `archive_batches`, `archive_subjects`, `archive_legal_holds`, `archive_checkpoints` |
| Content | `blog_posts`, `faq_items` |

## Rules for changing the database

1. **Once a migration has been pushed, change the database with a new file.** `db push` skips files it has already applied, so an edit never reaches the live database. Name the file for what it does, and fold it into its area file the next time the chain is consolidated.
2. **Run `npm run test:db` before you push.** It needs a throwaway Postgres 15+, and [Testing](TESTING.md) explains how. CI runs the same check on every push.
3. It builds the database from scratch, checks that **every `rpc()` call in `src/` matches a database function and its parameter names**, and replays onboarding, messaging, corrections, points, bounties, reports, blocking and admin access.
4. **Hosted Supabase rejects direct `DELETE`s on `storage.*` tables.** Remove buckets with the Storage API or the dashboard.
5. **Real Supabase refuses an UPDATE or DELETE with no WHERE.** `scripts/test-db.sh` turns the same rule on when run against the Supabase image.

**Hosted history repair.** The consolidation renamed the migrations, so a hosted database that still has the old history needs a one-time repair before `db push` lines up. See [Deployment](DEPLOYMENT.md#one-time-migration-history-repair).

## Design rules

- **Clients read through row-level security, and write through functions.** Follow, block, message, report and profile completion are all `security definer` functions that check blocks, account status and rate limits. Those tables have no direct insert policies.
- **Blocking is enforced in every read** through `is_blocked_between()`, both directions, silently.
- **`profiles.role`, `status` and counters can't be edited from the client.** A trigger protects them.
- **New tables start closed.** Default privileges are revoked, so a new table needs its own `grant` and row-level security in its migration.
- **After adding a function,** give it its own `revoke` and `grant` at the end of its migration, as the area files do. Signed-in users only, unless it needs otherwise. Internal helpers such as `award_points` get no client grant. `supabase/tests/privileges.sql` fails otherwise.
- **Don't read other people's profile columns directly.** Only `id`, `username`, `display_name` and `avatar_url` are granted. Use `get_profile()` or `get_my_profile()`.
- **A policy on `storage.objects` can't query `storage.objects`,** because that recurses. Use a definer function.
- **Roles can't be set by hand.** See [Admin setup](ADMIN_SETUP.md).

## Limits enforced in the database

| What | Limit |
|---|---|
| Messages | 30 a minute |
| New chats | 20 a day |
| Open bounties | 3 at a time |
| Chat corrections | 20 an hour and 30 a day |
| Rewarded corrections | 10 a day, and 3 a day from one author |
| Library posts | 20 a day |
| Practice posts | 5 a day. Title or text up to 280 characters, story text up to 5,000, question detail up to 2,000, 120 on an image |
| Teaching post phrase, translation, context | 500 characters each. Lesson text up to 5,000 |
| Discussion entries | 30 an hour, up to 1,000 characters, 12 levels deep |
| Saved posts | 500 |
| Reports | 10 an hour |
| All writes by one person | 240 a minute |

Request-level limits live in `rate_limit_rules` and can change with no deploy. See [Security](SECURITY.md#rate-limits).

## Scheduled jobs

These use pg_cron, which has to be enabled on the hosted project.

| Job | When | What it does |
|---|---|---|
| `ft-archive-run` | Every 6 hours | Starts the `archive-run` function |
| `ft-archive-purge` | Hourly | Deletes what isn't archived |
| Accountability sweep | On a schedule, or from app activity if pg_cron is off | Reminders, overdue notices, escalations |
| Heartbeat | Every minute | Fills the uptime history on the Health page |

## Reading production data

Never paste the service role key into a chat, `.env` or a `VITE_` variable. Run queries yourself in the Supabase SQL editor. Several tables aren't reachable from the API, on purpose.
