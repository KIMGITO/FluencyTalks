# Roadmap, decisions and known gaps

Status as of 3 November 2026.

## Built

| Area | Status |
|---|---|
| Profile editing and one-native, one-learning language profile | Done |
| Search with tabs and filters | Done |
| Block, report and moderation screens | Done |
| Text chat with requests, reactions, notifications, read receipts and typing | Done |
| Inline corrections, phrasebook and tap-to-translate | Done |
| Account deletion and data export | Done |
| Earned levels and vouches | Done |
| Points ledger and bounties | Done |
| Community library with review, accountability and practice posts | Done |
| Web push and installable web app | Done |
| Staff accounts with MFA, admin area, pause switch and rate limits | Done |
| Database-driven blog and FAQ, prerendered public pages | Done |
| Archive, tamper protection and consent ledger | Built. The write-once store still has to be connected: see [Setup](DATA_RETENTION.md#setup) |
| Contribution system: every learner posts from day one, stories, lessons, photos, sentence corrections, one set of statuses, warnings before a pause. See [Contribution system](CONTRIBUTION_SYSTEM.md) | Done |
| App-wide error, validation and keyboard rules, mixed Home feed | Done. The keyboard behaviour still needs testing on real phones |

## Not built yet

- **Voice and video sessions.** Not promised anywhere publicly.
- **Translated interface and right-to-left layout.** Strings are inline, and should move to translation files if the app is translated.
- **More post types:** games, dialogues, series and rich lessons. See [Post type ideas](POST_TYPES_AND_UNLOCKS.md#ideas-not-built).
- **Public, searchable library posts.** See [Public content plan](PUBLIC_CONTENT_SEO.md).
- **Bridge match tier.** Matching through a shared third language.
- **Review mode for the phrasebook,** such as flip cards, and attaching images to saved phrases.
- **Pages from the content plan:** `/safety` and a `/how-it-works` page. `/how-it-works` redirects to `/faq` today.

## Known gaps

| Gap | Detail |
|---|---|
| **`www.thefluencytalks.com` doesn't resolve** | Checked 3 November 2026. Add a DNS record and a redirect to the main domain. See [Deployment](DEPLOYMENT.md#domains). |
| **Old domains go elsewhere** | `fluencytalks.com` and `www.fluencytalks.com` redirect to an `l.ink` address, not to our site. |
| **An old Vercel copy is still online** | `fluency-talks.vercel.app` answers, and the GitHub repository's Website field points to it. Change that field to `https://thefluencytalks.com`. |
| **Old follow system** | `follows`, its counters and `is_private` are still in the database and in `search_people`, `get_profile` and `home_feed`. No screen shows them. |
| **`user_languages`** | A derived copy of the two language columns on `profiles`, kept in sync by `set_language_profile` so older functions keep working. |
| **Possible false logouts** | `validateSession` logs people out on any error from the session check, so a brief network failure may show "Your session is no longer valid". |
| **Unit tests aren't in CI** | `npm run test:unit` only runs by hand. See [Testing](TESTING.md). |
| **Consent kind name** | The app and legal pages say 16 or older, but the stored consent kind is still named `age_18`, and one report reason says "Seems under 18". |
| **Touch target size** | `min-h-11` generates no CSS in this project's Tailwind setup, so medium buttons and `Select` are shorter than the intended 44px. See [Design system](DESIGN_SYSTEM.md). |
| **Oversized favicons** | `favicon.png` and `favicon-dark.png` are large and should be replaced with 32, 180 and 512 px versions. |
| **`vercel.json`** | Left over from before the move to Cloudflare. Cloudflare ignores it. |
| **`public/_headers` comment** | Still mentions Cloudflare Pages, though the file works the same on the Worker. |
| **Translation history** | Old translations are never pruned. A scheduled job is a future item. |
| **Not measured** | Time to first fix on practice posts, and the baseline numbers in [Post type ideas](POST_TYPES_AND_UNLOCKS.md#what-to-measure), haven't been collected. |

Legal gaps are listed separately in [Legal compliance](LEGAL_COMPLIANCE.md).

## Decisions made

- **One native language, strict.** A second one can be added later if users ask.
- **40 launch languages,** including Swahili (`swh`) and Vietnamese (`vie`). The six smaller Kenyan languages were taken off the list on 1 November 2026.
- **Language changes:** the first is free, then one every 30 days.
- **Levels are earned.** The picked level is an estimate that unlocks nothing, and after setup it can only be lowered. `verified_level` rises from `level_rules`, and only falls if the learning language changes.
- **Who corrects:** native speakers and learners verified at B1+ of that language, not native speakers only as first proposed.
- **Vouching:** two native speakers who have really chatted with a learner can verify them at B1, and only B1. Each voucher has 3 a month.
- **Cards** show the verified level, or the level the person gave.
- **Presence is server-side** (`user_presence`). Hiding it works both ways.
- **Post review:** the owner decides, accepting supersedes only the previously accepted correction, and moderators can override with a reason. Chat corrections stay their own lighter flow.
- **Helpfulness:** learners rate corrections. Mostly negative recent ratings from at least 3 people stop the corrector's +5 until they recover.
- **Library posts don't earn points.**
- **Matching never requires a swap.** Requiring it would leave most users with an empty feed.
- **Home mixes posts and people,** and most of it is posts.
- **Vietnamese law applies.** Proof of consent is kept permanently, and archived records must be tamper-proof.

## Open decisions

**Product**

1. Should the Bridge match tier be on by default?
2. Are the current point values and daily limits final?
3. Should a bounty be answerable by anyone qualified, as it is now, or only by partners the asker has chatted with?
4. Should practice posts launch in all languages, or only where helpers exist? This needs production numbers.
5. Are the starting numbers in the [contribution system](CONTRIBUTION_SYSTEM.md#decisions-for-the-owner) right? Measure them after launch.

**Public content**

6. Should library posts become public, with the author's opt-in? See [Public content plan](PUBLIC_CONTENT_SEO.md).

**Legal**

7. The open items in [Legal compliance](LEGAL_COMPLIANCE.md) can only be resolved by the owner and a lawyer.
