# FluencyTalks: Analysis and Refactor Plan

> A peer-to-peer language exchange platform. One native language, one target language, real people who correct each other, and a small points economy that rewards helping.

**Scope of this analysis.** I read the project README, the folder map, migrations `0001–0019` and `0027–0028`, `LanguagePicker.tsx`, `ProfileForm.tsx`, the router, and the seed data. I did not read every component (for example `ChatThread`, `Home`, `Search` UI internals), so anything marked *(not verified)* should be checked before you rely on it.

---

## 1. The Product in One Paragraph

FluencyTalks is a **study-partner platform, not a social network**. A user declares the one language they speak natively and, optionally, the one language they are learning. The app matches them with people whose languages complement theirs (a Kenyan learning Vietnamese ↔ a Vietnamese speaker learning English or Swahili). Partners chat, native speakers correct each other's sentences inline, learners save phrases into a personal phrasebook, and points reward helpful corrections. There is no feed, no follower counts, no popularity contest.

**Demo story for the project defence:** *Amina (Nairobi, native Swahili, learning Vietnamese) is matched with Linh (Hanoi, native Vietnamese, learning English). Amina writes a Vietnamese sentence, Linh corrects it inline (red → green), Amina accepts, Linh earns +5, the corrected phrase lands in Amina's phrasebook with an Unsplash image. Amina is stuck on an exam phrase, spends 50 points on a bounty, and a native speaker answers it within minutes.*

---

## 2. What Already Exists

### 2.1 Stack
React + Vite + TypeScript, Tailwind driven by a single token file, Zustand stores, Supabase (Postgres, Auth, Realtime, Storage, one Edge Function), deployed on Cloudflare Pages (a Vercel URL also appears on the repo).

### 2.2 Features that are built

| Area | What is there | Status |
|---|---|---|
| **Accounts** | Email, Google, Apple, Facebook sign-in; signup trigger creates the profile; onboarding gate; password reset; account deletion (Edge Function); data export | Done, per your note |
| **Languages (ISO 639-3)** | `languages` table keyed by 3-letter id (`vie`, `swa`, `eng`, 100 curated languages in seed incl. Kikuyu and Dholuo); searchable A–Z picker showing names in the user's own language; CEFR levels A1–C2 | Done, but the rules are too loose (see §5) |
| **Matching** | `home_feed()` ranks "can teach me" → "same goal / same native" → "everyone else" | Built, one-directional (see §5) |
| **Search** | People by name/`@username`, messages inside your own chats, filters by language, role, level | Built |
| **Chat** | Message requests, realtime messages, emoji reactions, read receipts, delete, unread dot | Built |
| **Inline corrections** | `suggest_correction` → learner sees a word-level diff → `accept_correction` or dismiss | Built |
| **Phrasebook / "Learning" page** | Saved phrases, corrections received, translation history; tap-to-translate via MyMemory | Built |
| **Points (backend only)** | `profiles.points_balance` (starts at 100), `adjust_user_points()`, +5 on accepted correction | Partial, **has an exploit** (see §6) |
| **Public phrase library** | `saved_phrases.is_public` and `unsplash_image_url` columns | Columns only, **no UI** |
| **Safety** | Reports with message evidence, admin queue, suspend/ban (email-hash), auto-suspend after 5 reporters in 7 days, silent two-way blocking enforced in every read, rate limits (30 msgs/min, 20 new chats/day) | Done |
| **Design system** | One `tokens.ts` drives colours, fonts, spacing, light/dark | Done |

### 2.3 What is **not** there yet
- Bounty system (no table, no function, no UI)
- Points display on the profile, points history
- Unsplash search box (only the URL column exists)
- Saved Study Partners (the app still has the Facebook-style follow model)
- A rule that limits users to one native and one learning language
- Language tagging on messages (so corrections cannot be attributed to a language)
- Tests, i18n, typing indicators

---

## 3. Features to Add: Defined Clearly

### F1. Language Profile: One Native, One Target
**What:** Every user picks exactly **one native language** and **at most one learning language** (with a CEFR level). Stored as ISO 639-3 ids.
**Why:** It makes matching a simple, explainable lookup and removes the noisy 12-language profiles.
**Behaviour:**
- Onboarding step 1: "I speak natively…" (single select). Step 2: "I'm learning…" (single select + level, skippable).
- The two cannot be equal.
- Changing languages is allowed but limited (e.g. once per 30 days) to stop users hopping between pools to farm corrections.

### F2. Reciprocal Match Engine
**What:** Replaces `home_feed()`. Shows partners ranked by match quality.
**Match tiers:**
1. **Perfect swap:** their native = my target **and** their target = my native.
2. **Teacher:** their native = my target (they can help me, I may not be able to help them).
3. **Bridge:** no direct fit, but both speak a shared third language at B1 or higher (e.g. English). Optional, off by default.

No ranking by follower count. Within a tier, order by **recent activity** and **timezone overlap**, so new users are not buried.

### F3. Saved Study Partners (replaces follow/unfollow)
**What:** A private bookmark list. Tapping "Save partner" adds someone to *your* list. They are not notified, there are no counts, no follow requests, no private accounts.
**Why:** Quick access without social-media mechanics.
**Removes:** `follows`, `followers_count`, `following_count`, `is_private`, follow-request notifications, `/followers`, `/following` pages, `FollowButton`.

### F4. Inline Grammar Corrections (hero feature, hardened)
**What:** A qualified native speaker taps **Correct** on a partner's message, edits the sentence, and the UI shows the old text in red and the new text in green. The author accepts or dismisses.
**Hardening needed:**
- Only users whose **native language = the message's language** can submit a *rewarded* correction (see F10).
- The suggested text must differ meaningfully from the original.
- Optional short explanation note, 200 characters.
- Messages get a `language_id` so the system knows which language is being practised.

### F5. Direct Message Bridging
**What:** Private 1:1 chat between partners. Already built; adjust it to the new model:
- Message requests stay (protects people from unwanted contact).
- A conversation has a `practice_language_id` (the language the learner is practising) used to tag messages by default.
- Add typing indicator (low priority).

### F6. Contextual Phrasebook / Vocabulary Decks
**What:** Personal notebook of phrases, slang and academic vocabulary saved from chats, accepted corrections, or typed manually. Each card has: phrase, meaning, language, optional example, optional Unsplash image.
**Add:** Language filter, simple review mode (flip card), and an optional "share to public library" toggle (column already exists).

### F7. Language Points Balance
**What:** A visible balance on the profile and in the top bar. Every change is recorded in a **ledger** (who, how many, why), so the balance can always be audited.
**Rules (starting values, tunable in one config table):**

| Event | Points |
|---|---|
| Sign-up bonus | +100 (already the default) |
| Correction accepted by the learner | +5 to the corrector |
| Bounty answered and accepted | +50 to the helper (the 50 the asker paid) |
| Posting a bounty | −50 from the asker |
| Expired bounty with no accepted answer | refund to the asker |

### F8. Priority Bounty System
**What:** A stuck learner spends **50 points** to post an urgent question (homework, exam phrase). It goes to a **Bounty Queue** shown to native speakers of that language, pinned above normal requests.
**Flow:** Post → points held in escrow → native speaker answers with a correction/explanation → asker accepts → escrow released to the helper. If nobody answers in 48 hours, the points are refunded.
**Why escrow:** the asker cannot spend the points twice, and the helper is guaranteed payment.

### F9. Unsplash Visual Anchors
**What:** A keyword search box on a flashcard that shows Unsplash results; picking one stores **only the image URL** (text). No uploads, so there are no storage costs and no explicit-content risk from user files.
**Notes:**
- Do not call Unsplash from the browser with a secret key. Put the key in a small proxy function (one Edge Function) and cache results.
- Unsplash's demo rate limit is low, so debounce typing (400 ms) and cache by keyword.
- Follow Unsplash's API guidelines: hotlink their image URLs and show photographer attribution. Check their current guidelines before launch.
- Validate on save that the URL host is `images.unsplash.com` so nobody stores arbitrary links.

### F10. Safety and Integrity (extend what exists)
- **Report queue:** add report reasons "fake correction" and "points abuse".
- **Silent two-way blocking:** keep as is.
- **Anti-farming rules** for the points economy (see §6).

---

## 4. Target Data Model (sketch)

```
profiles            + native_language_id, learning_language_id, learning_level, last_language_change_at
                    - followers_count, following_count, is_private
languages           (unchanged: iso 639-3 id)
study_partners      user_id, partner_id, created_at            -- replaces follows
conversations       + practice_language_id
messages            + language_id
message_corrections (existing)  + counts_for_reward boolean
points_ledger       id, user_id, delta, reason, ref_type, ref_id, created_at
                    UNIQUE (reason, ref_type, ref_id)           -- one payout per event
bounties            id, asker_id, language_id, text, cost, status, accepted_correction_id,
                    expires_at, created_at
saved_phrases       (existing) is_public, unsplash_image_url
```

`user_languages` can stay temporarily as a compatibility table, then be dropped once the new columns are live.

---

## 5. Bottleneck Analysis: Language Selection

This is the most important section. Language selection decides who can match with whom, so every weakness here shows up as an empty or bad-feeling home screen.

### B1. Users can pick up to 12 languages, with several native languages
**Where:** `set_my_languages()` allows up to 12 rows, multiple `native`, multiple `learning`.
**Impact:** Profiles become vague, matching signals blur, and a user can claim "native" in many languages to appear helpful or to farm points.
**Fix:** Move to single columns `native_language_id` and `learning_language_id` on `profiles` with a `CHECK (native_language_id <> learning_language_id)`. Update the picker to two single-select steps.
**Trade-off to decide as a team:** Many Kenyan users genuinely have two or three native languages (for example Kikuyu, Swahili, English). Your rule of one is fine for an MVP. Tell users to choose *the language they would be happy to correct others in*. You can add a "second native language" later without changing the matching logic.

### B2. Clients can write languages directly and bypass every rule
**Where:** `0001_init.sql` creates the policy `"own languages" ... for all using (auth.uid() = user_id)` and I found nothing that removes it. Any signed-in user can insert or update `user_languages` rows straight through the API, skipping the 12-row limit and the level validation in `set_my_languages()`.
**Impact:** Any future "one native, one learning" rule enforced only in the function would be bypassable.
**Fix:** Drop that policy, replace it with read-only access, and enforce the single-language rule with **table constraints** so the database itself is the authority. With single columns on `profiles`, the existing "protected columns" trigger pattern can guard them.

### B3. The same language can be both native and learning
**Where:** the primary key is `(user_id, language_code, role)`, so `eng/native` and `eng/learning` can coexist.
**Impact:** Contradictory profiles and false matches.
**Fix:** the `CHECK` in B1.

### B4. Matching is one-directional
**Where:** `home_feed()` puts anyone who speaks natively what I'm learning in the top tier, whether or not they want what I offer.
**Impact:** Native speakers get flooded with requests from learners and have no incentive to answer, so response rates fall and learners churn. A true exchange (both sides gain) is what keeps people returning.
**Fix:** The three-tier engine in F2, with "perfect swap" first. Show the reason on the card ("You teach Swahili, they teach Vietnamese").

### B5. The "learning" bucket mixes unrelated people
**Where:** the `match_kind = 'learning'` branch includes people learning the same language as me and people who share my native language.
**Impact:** Two learners of the same language cannot correct each other reliably, and two speakers of the same native language have no practice reason. The feed looks full but is not useful.
**Fix:** Drop those cases from the main feed. Offer "learning the same language" only as an explicit "study buddy" filter.

### B6. Ranking by follower count
**Where:** `order by followers_count desc` in `home_feed()`.
**Impact:** Popularity bias. New users are invisible, which is a problem on a small user base. It also keeps the Facebook-style mechanic you want to remove.
**Fix:** Order by last active, then timezone overlap, then newest. Remove the counters.

### B7. Thin pools: the cold-start problem
**Where:** 100 languages × 2 roles = many pairs that have zero users. Vietnamese ↔ Swahili will rarely have a perfect swap early on.
**Impact:** A new user sees "no matches" on day one and leaves. This is the biggest risk for any exchange platform.
**Fixes:**
- Show the empty state as a **waiting list**: "12 people speak Vietnamese natively. 3 are learning English or Swahili."
- Use the **Bridge tier** (shared third language, usually English) so users still see someone.
- Launch with a **small focus list** (e.g. English, Swahili, Vietnamese, Kikuyu, French) rather than all 100 languages. Keep the other languages as "coming soon". The seed already has an `is_supported_learning` flag you can use for this.
- Seed a few real test accounts for the demo.

### B8. Messages carry no language, so corrections cannot be validated
**Where:** `messages` has no `language_id`, and `suggest_correction()` only checks that the corrector is not the author.
**Impact:** Anyone in the chat can correct any message and earn points, even if they do not speak the language. Corrections cannot be filtered or counted per language.
**Fix:** Add `messages.language_id` (defaulting to the conversation's `practice_language_id`) and require the corrector's `native_language_id` to match it for a rewarded correction.

### B9. Self-declared fluency is unverified
**Impact:** Anyone can claim "native" and "Vietnamese".
**Fix for an MVP:** Do not build verification. Use **learner feedback** instead: the learner can mark a correction "helpful" or "not helpful", and a corrector with several unhelpful marks loses reward eligibility. Mention verification as future work.

### B10. Timezone is stored but not used for matching
**Impact:** Nairobi (UTC+3) and Hanoi (UTC+7) only overlap a few hours a day. Matches who are never online together don't convert to conversations.
**Fix:** Use timezone overlap as a tie-breaker (F2) and show "Active now" or local time on the card.

---

## 6. Other Bottlenecks and Risks

| # | Problem | Where | Impact | Fix |
|---|---|---|---|---|
| **R1** | **Anyone can credit any user unlimited points** *(closed in 0029; the ledger and caps are still to build)* | `adjust_user_points()` lets a caller add any positive amount to *another* user; it is callable by every signed-in client | A user can give a friend 1,000,000 points through a direct API call, which breaks the whole economy and the bounty system | Revoke `execute` on it from `authenticated`. Make it internal-only, called only from other `security definer` functions (`accept_correction`, bounty functions) that decide the amount. Add the `points_ledger` and write every change through one function |
| **R2** | **Points farming by collusion** | Two accounts (A writes junk, B "corrects", A accepts) earn +5 each loop | Fake economy, which also defeats the purpose of the platform | Daily cap on rewarded corrections (e.g. 10/day), a cap per pair per day (e.g. 3), reject trivial edits, require native-language match (B8), unique ledger entry per correction |
| **R3** | **Migration `0028` breaks permissions** *(fixed in 0029)* | It runs `revoke execute on all functions ... from authenticated, service_role` and did not re-grant | Every RPC and every RLS policy that calls a function (such as `is_admin()`) could fail | `0029_restore_grants_lock_points.sql` restores the grants. Still test on a fresh Supabase project |
| **R4** | **Migration numbering jumps 0019 → 0027** | `0020–0026` were the blog/posts system, added and then deliberately removed (see git history); `0028` drops it | Looks like missing files but is intentional. Low risk; a squashed baseline migration would still make fresh setups simpler | Optional: squash into one clean baseline before adding new migrations |
| **R5** | **Follow system conflicts with the new direction** | `follows`, counters, privacy, notifications, pages | Dead code and confusing UX | Replace with `study_partners` (F3) and remove the unused UI |
| **R6** | **No rate limit on corrections** | `suggest_correction()` | Spam corrections and a farming vector | Add a limit like the message one (e.g. 20/hour) |
| **R7** | **Free translation API** | `lib/translate.ts` uses MyMemory | Quota limits and message text leaving your system | Keep for the MVP, disclose it in the privacy policy (the README already notes this) |
| **R8** | **README is out of date** | Says "Search/Home still use mock data" and "not build-tested" | Confusing for graders and teammates | Verify and update after the refactor |
| **R9** | **No automated tests** *(not verified)* | No test folder seen | Points and matching logic are exactly what needs tests | Add SQL tests or a small set of integration tests for the points and match functions |

---

## 7. Recommended Build Order

1. **Stabilise (done in the cleanup commit):** type errors fixed, chat crash fixed, R3 grants repaired, R1 closed. Remaining: verify the migrations on a clean Supabase project.
2. **Language rules (2–3 days):** B1–B3. Single native + single learning, DB constraints, drop the open write policy, new onboarding steps.
3. **Matching (2–3 days):** F2, B4–B7. New `home_feed`, reasons on cards, empty-state waiting list, focus language list.
4. **Study partners (1 day):** F3. Replace follows, delete dead UI.
5. **Points economy done safely (3–4 days):** R1, R2, R6, F7. Ledger, internal-only point function, caps, points display on profile.
6. **Message language and correction rules (1–2 days):** F4, B8.
7. **Bounties (2–3 days):** F8, escrow, queue page.
8. **Unsplash (1–2 days):** F9, proxy, search box on the phrasebook card.
9. **Polish for the demo (2 days):** seed demo accounts, update README, prepare the Kenya–Vietnam walkthrough.

**What makes this stand out as a second-year project:** a real data model with constraints, a security-aware points economy (ledger, escrow, anti-abuse rules), reciprocal matching you can explain with a query, and a working live demo with two real users on two devices.

---

## 8. Open Decisions for the Team

1. Is "one native language" strict, or do we allow a second one later?
2. Do we launch with a small language list or all 100?
3. Should the Bridge match tier (shared third language) be on by default?
4. What are the final point values and daily caps?
5. Is a bounty answerable by anyone native in that language, or only partners the asker has chatted with?

---

*Next step:* pick which piece to produce first. The one that pays off most is the **Supabase migration** for §5 and §6 (language constraints, ledger, locked-down points function, grants fix), followed by the Zustand store changes.
