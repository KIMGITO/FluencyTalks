# Social feed: audit and plan (Phase 0)

Status 2026-11-21: audit done, nothing built yet. The plan below needs a yes before the database changes.
Hosted already has every migration up to `20261121100600`, so every change goes in new migration files.

## What already exists (reuse, don't duplicate)

| Need | Already there |
|---|---|
| Posts | `contribution_posts`, 7 types. Practice types (`correct_me`, `how_do_i_say`, `story`, `question`, `photo`) are open to all; `library` and `lesson` need a qualified author. |
| Composer | `/library/contribute` + `HelpComposer` (practice types), `post_help_request` / `post_contribution` RPCs. Rate limits are in SQL. |
| Comments and replies | `post_discussion` (`kind` = `comment` / `correction` / `clarification`), threaded, depth ≤ 12, idempotent `client_key`, `submit_discussion`. |
| Corrections | Original text, proposal and explanation, the corrector, accept or decline (`decide_correction`, `rate_help_fix`), follow-ups, agree and flag, a decision history, accepted fixes saved to the phrasebook (`keep_correction`). Immutability trigger `protect_discussion`. |
| Reactions | `post_likes` + `like_count` (likes only), `ReactionButton` with animation. |
| Save, report, block, pin, delete, edit | `toggle_saved_post`, `report_post` (auto-suspend at 5 reporters), `block_user`, `pin_contribution`, `delete_contribution`, `update_contribution` (locked once reviewed). |
| Notifications | `notify_event` with dedupe, prefs, web push, realtime on `notifications`. |
| Feed plumbing | `usePagedList` cache (scroll position kept, stale refresh, dedupe), `useInfiniteScroll`, `mixFeed` / `weavePosts`, skeletons, `ErrorState`. |
| People, presence | `home_feed`, `search_people`, `person_status`, `presence_of`, connections, `home_pulse`. |
| Achievements | `level_progress.passed_at` (verified level passes), points ledger. |

## What's missing

1. Reactions beyond Like (love, helpful, interesting, celebrate), per-type counts, and reactions on comments.
2. Editing and deleting your own **comments**. Corrections stay immutable on purpose.
3. Inline, paged comments on a feed card: today the card links to the post page, and `get_post_thread` loads every item.
4. Sharing: reposting to your feed with the original credited, a share count, and copy link.
5. Hiding a post from your own feed.
6. Server-side feed ranking with keyset pagination. The feed pages with offset today, which can repeat or skip posts while new ones arrive.
7. Real-time updates for feed cards (new comments and reactions on posts on screen).
8. Stories strip, left sidebar shortcuts, right rail widgets (the current rail shows a hard-coded "daily prompt").
9. **Communities don't exist.** Proposal: a community is a language (people learning or speaking it), the way Library already filters by language. No new community tables.

## Proposed database changes (one migration, `20261121100800_social_feed.sql`)

- `post_likes` renamed to `post_reactions` with `kind` (`like`, `love`, `helpful`, `interesting`, `celebrate`), primary key `(post_id, user_id)` so one reaction per person, changeable. Existing likes become `like`. `like_count` becomes `reaction_count`, plus `reaction_counts jsonb`, kept by trigger. RPC `set_post_reaction(post, kind|null)`.
- `discussion_reactions (item_id, user_id, kind)`, the same rules, and `reaction_count` on `post_discussion`.
- `post_discussion.edited_at`, `deleted_at`. `edit_comment` and `delete_comment` for your own `comment` items only. A deleted comment that has replies keeps its place as "deleted". The immutability trigger lets only these two functions through, so corrections stay unchangeable.
- `list_post_comments(post, after_cursor, limit)`: top-level items with reply counts and my reaction. `list_comment_replies(parent, …)`. Both keyset-paged, so nothing loads every comment.
- Post type `share` with `shared_post_id` (on delete set null, shown as "original removed"), optional caption, `share_count` by trigger. Shares never count as practice or take corrections. RPC `share_post(post, caption)`.
- `hidden_posts (user_id, post_id)` + `hide_post`.
- `feed_page(mode 'ranked'|'latest', cursor, limit 12)`. Ranked uses one written-down score: my languages, people I'm connected with or follow, recency decay, real engagement (reactions, replies, accepted corrections), needs-help boost. The score is computed per request and paged by `(score bucket, created_at, id)`. "Latest" is pure chronological. No hidden signals, no seeded content.
- `feed_highlights()` for stories: real level passes by people I'm connected with, today's topic from `path_topics` (picked by date), open help requests in my languages.
- Indexes for the above, grants, `revoke ... from public, anon`, rate-limit rules, REFUSALS lines, and `export_my_data` gaining the new tables.

Rollback: every step is additive except the rename, which the migration can reverse (`post_reactions` → `post_likes`, keeping `like` rows).

## Front end (phases)

1. Database + tests (`app_flow.sql`, `test:security` for RLS and the direct-table refusals).
2. Feed card v2 (reaction picker, inline comments, share, hide, copy link, see more), `feed_page` with cursor paging, pull to refresh, Latest/For you toggle.
3. Layout: left sidebar (profile, languages, connections, saved, bounties, achievements), stories strip, right rail (online partners, suggestions, trending, popular questions, today's topic). Phone: single column, composer chips on top, stories scroll sideways.
4. Realtime: one channel for the posts on screen (filtered `post_id=in.(…)`), cleaned up on unmount.
5. Browser end-to-end on the local stack (desktop and phone), the acceptance list from the brief.

## Decisions taken in the plan (say if any is wrong)

- "Start a discussion" and "Ask a language question" both make a `question` post, which the app already calls "Question or discussion".
- "Share a learning experience" makes a `story`. "Request a correction" makes `correct_me`.
- "Share an achievement" is offered only when there is a real one (a passed level). Nothing is self-declared.
- Communities are languages (see above).
