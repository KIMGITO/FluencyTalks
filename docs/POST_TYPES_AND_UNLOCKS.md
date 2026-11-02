# Post types and unlocks: what we found and what we propose

**Status:** proposal for discussion, 2026-11-02. Nothing here is built yet.
**Numbers:** every limit and threshold in the proposal is a starting value to tune later.
**Not checked:** production data. We don't yet know how many people post today (see section 9).

## 1. The short version

Today, posting means teaching. The app only offers phrase, idiom, usage and grammar posts, so a beginner has nothing to post in the language they are learning until they reach verified B1.

We propose three changes, and they only work together:

1. **Beginners get posts that ask for help.** The first type is "Correct me". No level is needed.
2. **Each level unlocks new post types and better-looking posts.** People can see what comes next and how to reach it.
3. **Contributing counts toward levels.** Today it almost never does. This is the real reason nothing advances.

**One warning about looks.** Better styling will attract people, but it probably won't be what brings a beginner back. What brings them back is a quick answer from a real person. If "Correct me" posts go unanswered, the rest of this plan won't matter, so the first release has to focus on getting answers (section 6).

## 2. What we found in the code

| # | Finding | Why it matters | Where |
|---|---|---|---|
| 1 | A learner can't post in their learning language below **verified B1**. | B1 needs 80 messages, 7 active days and 2 native partners, so a beginner waits a long time. | `can_correct_language`, `post_contribution` |
| 2 | Anyone can post in their **native** language from day one. | Beginners are only blocked in the language they care about. It also means natives have nothing to unlock (section 4). | same |
| 3 | Levels only rise from **chat messages**. Posts add nothing until C1, which needs 3 saves of your posts. | This is "nothing advances": contributing doesn't move you up. | `level_evidence` |
| 4 | Corrections on **posts** don't count toward levels. Only corrections in chat do. | Someone who helps a lot in the Library gets points but makes no progress toward B2. | `level_evidence` (`given`) |
| 5 | Level checks only run when you **send a chat message** or load your level progress. | Even if posts counted, they wouldn't trigger a promotion. | `trg_check_level`, `my_level_progress` |
| 6 | A2 and above need a **native partner who replied** in chat, and that partner must have been on the app for 7+ days. | In a language with few natives, a learner can get stuck at A1. | `level_evidence`, `level_rules` |
| 7 | Each correction gives the post owner a **decision with a 7-day deadline**. Three overdue decisions can pause their posting. | **This would hurt beginners if reused as is.** A popular "Correct me" post could get them restricted. | `submit_discussion`, `accountability_policy` |
| 8 | A post with open corrections shows as **"disputed"**. | That's the wrong message for someone who asked to be corrected. | `refresh_post_review` |
| 9 | Accepting a correction in chat saves it to the **phrasebook**. Accepting one on a post doesn't. | A learner would lose the most useful thing they got from the post. | `accept_correction`, `apply_accept` |
| 10 | Post text is **plain text, 500 characters at most**. A correction replaces the whole text. | Stories and lessons need more room, and correcting a long story needs to work sentence by sentence. | `contribution_posts`, `post_discussion` |
| 11 | **Text never sits on the image.** The photo is on top with the caption below it. | "Image as background" is new work, not a setting we can switch on. | `PostCard.tsx` |
| 12 | Every category **looks almost the same**: only the small label's text changes. | Nothing you can see makes one post more desirable than another. | `CATEGORY_COLORS` in `PostCard.tsx` |
| 13 | Anyone with an eligible language can already add an Unsplash image. | Images aren't a reward today. Making them one means deciding who keeps them (decision 3). | `ContributePage.tsx` |
| 14 | Home's composer says "Share a phrase, idiom or example…". | It tells beginners this isn't for them. | `Home.tsx` |

**Already there to build on:**

- Anyone can comment on a post, whatever their level.
- Threaded discussion on posts.
- The word-level diff (`DiffText`).
- Point limits that stop people farming rewards.
- The `level_rules` table, which holds thresholds as data.
- Reports, moderation and the Unsplash proxy.
- The "I can answer" queue, nav badges and web push.

## 3. The ladder

**The main rule:** the post types you get follow what you know, and the better looks reward what you do. The server enforces this for each person and each language, using a rules table like `level_rules`.

| Tier | Learner reaches it by | New post types | New look |
|---|---|---|---|
| **Starter** | Nothing needed | Correct me, How do I say…? | Notebook |
| **A1** | Verified A1 | Describe this photo | Photo card |
| **A2** | Verified A2 | My story, Which sounds right? | Story page |
| **B1** | Verified B1 | Phrase, idiom, usage, grammar (today's types), Spot the mistake, Fill the gap | Text on a full image |
| **B2** | Verified B2 | Mini lesson (headers, lists, bold) | Lesson layout |
| **C1** | Verified C1 | Dialogue, Series (linked posts) | Cover image and themes |
| **C2** | Verified C2 | Challenge (a prompt others answer) | Custom accent and "Top contributor" frame |

Lower tiers stay open forever, so a C1 learner can still ask "Correct me".

**B1 stays the line for teaching.** It's where someone gets the right to correct others. "Spot the mistake" and "Fill the gap" sit here because the author has to know the right answer.

## 4. The problem with native speakers

Natives have no level, so a level-only ladder gives them everything on day one or nothing at all. Neither works.

**Proposal:** in their native language, natives get every post type straight away, because they already have the knowledge. The look tiers come from helping, using the numbers `level_rules` already has:

| Look tier | Accepted corrections given |
|---|---|
| Up to B1 looks | 0 |
| B2 look | 5 |
| C1 look | 20 |
| C2 look | 50 |

This gives natives a reason to answer beginners, which is exactly the behaviour the first release depends on.

## 5. The post types

"Story" came up in two different ways, and they're **two separate types**:

- **My story:** a learner writes a real story and asks for it to be fixed.
- **Spot the mistake:** a stronger writer posts a text with planted errors as a game for others.

| Type | Who writes it | What readers do | Notes |
|---|---|---|---|
| **Correct me** | Anyone | Fix it and explain | Up to 280 characters; offers sentence starters so the page is never blank |
| **How do I say…?** | Anyone | Answer with the phrase | Written in any language; asks about the learning language |
| **Describe this photo** | A1+ | Fix the caption | Suggests a photo, which also keeps Unsplash calls down |
| **My story** | A2+ | Fix one sentence at a time | Up to about 1,000 characters |
| **Which sounds right?** | A2+ | Vote A or B; natives explain | Quick to answer, so it gets people joining in |
| **Spot the mistake** | B1+ | Find and fix the errors, then see the answer | Anyone can play, including beginners |
| **Fill the gap** | B1+ | Choose or type the missing word | Same as above |
| **Phrase, idiom, usage, grammar** | B1+ (natives now) | Save, endorse, correct | Unchanged |
| **Mini lesson** | B2+ | Read, save, correct | Headers, lists and bold |
| **Dialogue** | C1+ | Read, save, correct | Two speakers, shown as chat bubbles |
| **Series** | C1+ | Follow the parts in order | Linked posts |
| **Challenge** | C2+ | Reply with their own attempt | Replies become "Correct me" posts, which brings in more beginners |

The games give beginners something to do besides post. They read and practise with content written by stronger learners, and those authors get an audience.

## 6. How a "Correct me" post has to behave

These are **requests for help**, not reference content, so they follow different rules from Library posts.

| | Library post today | Help post |
|---|---|---|
| Status shown | Unreviewed, confirmed, disputed, corrected | **Needs a fix**, then **Helped** |
| Owner's duty | Must decide, with a deadline and possible restriction | **None.** Thanking is optional, and nothing can restrict them |
| Several corrections | One accepted version replaces the text | The original stays visible, with each fix shown as a diff |
| Learner's reward | None | "Add to phrasebook" on any fix |
| Helper's reward | +5 points if accepted | +5 points, with the same limits, when thanked |
| Where it appears | Library and Home | **Practice** tab and Home, **not** the Library |

**Getting answers quickly matters most.** The plan for that:

- Add open help posts to the "I can answer" queue, with a nav badge.
- Send a push to a few qualified people, with a limit so nobody gets flooded.
- Be honest when a language has few helpers: "Few native speakers here yet. Your post stays open."
- Tell the author as soon as a fix arrives.
- Show helpers a counter, such as "3 fixes to your next look".

**Keeping it kind.** People are showing their mistakes in public, so:

- Keep the required explanation on every fix (the server already requires one).
- Show a short "be kind" prompt when someone writes a fix.
- Keep the helpful or not helpful rating, and add it for post fixes.
- Let authors delete their post at any time.

## 7. How contributing moves you up

**Learners:**

- Help posts count toward **messages** and **active days**.
- A native who fixes your post counts as a **partner** and a **review**. This fixes the A1 trap (finding 6).
- **Asking must never hurt you.** Fixes on help posts stay out of the error rate.
- **B1 stays anchored in chat.** Posts count fully up to A2. For B1 they only count toward messages and days, while the partner, review and error-rate needs still come from real chat. A1 and A2 give no power over others, but B1 does.

**Helpers:**

- Accepted fixes on posts count the same as those in chat for B2 and above.
- Post fixes get the same helpful rating as chat corrections.
- Only a limited number per author per day count, matching today's limit of 3 for points.

**Technical:**

- Run the level check after posting and after a fix is thanked, not only after chat messages.

## 8. The looks

These are built from the existing design tokens, and each must work in light and dark mode. A type should be recognisable before you read a word.

| Look | Idea | Details |
|---|---|---|
| **Notebook** | A learner's page | Ruled lines, "Correct me" stamp, a clear "Fix this" button |
| **Photo card** | Picture with a caption | Image on top, the caption in a framed strip |
| **Story page** | Reading experience | Larger type, drop cap, tap a sentence to fix it |
| **Full image** | Text on the photo | Dark overlay for contrast, up to about 120 characters, big type |
| **Lesson** | A small article | Headers, lists, bold, coloured key points |
| **Cover and themes** | Magazine feel | Cover image with several curated themes |
| **Top contributor** | Prestige | Author frame and chosen accent from a safe, tested list |

```
Starter: Correct me           B1: Full image            B2: Mini lesson
┌───────────────────────┐    ┌───────────────────────┐  ┌───────────────────────┐
│ CORRECT ME   ·  A1    │    │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  │ Author · C-level      │
│───────────────────────│    │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  │ # Saying "I'm hungry" │
│ Yesterday I go to the │    │▓▓  Break the ice    ▓▓│  │ You don't need "là":  │
│ market with my sister │    │▓▓  phá băng         ▓▓│  │  • Tôi đói  (right)   │
│───────────────────────│    │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  │  • Tôi là đói (wrong) │
│ [ Fix this ]  2 fixes │    │ IDIOM · Save · Review │  │ Save · Review         │
└───────────────────────┘    └───────────────────────┘  └───────────────────────┘
```

**The locked state is what makes people want the next step.** The composer shows all types, with locked ones visible and the exact missing step: "Mini lesson: 3 more accepted fixes". `LevelProgress` already shows the rest of the road, and `level_up` notifications can announce what just unlocked.

**How it's stored:**

- **Add a `post_type`** column and keep `category` for today's types.
- **Keep `phrase`** as the short title, because search, snippets and notifications depend on it.
- **Add a `body`** field for long text, using a small Markdown subset (headers, lists, bold).
- **Render it to React elements** with a small renderer, never as raw HTML, and with no new dependency.
- **Keep answer keys in their own table.** Posts are loaded with `select *`, so a key stored on the post could be read by anyone before they answer.
- **Stay on Unsplash only.** No uploads means no storage cost and no image moderation.

## 9. Risks

| Risk | What we do |
|---|---|
| **No one answers** | Queue, push, a target for time to first fix; launch only in languages with enough helpers (decision 5) |
| **Learners absorb wrong language** | Unfixed posts stay out of the Library; planted errors stay clearly labelled and are never saved to the phrasebook |
| **Beginner posts fill Home** | Limit how many appear per page; give them their own tab |
| **Spam from accounts that need no level** | 3 Starter posts a day (today's limit is 20), and new accounts stay under the existing report and auto-suspend rules |
| **Pasted translations** | Harmless below B1, and B1 stays anchored in chat |
| **Two accounts farming levels** | Partner must be 7+ days old (existing rule), daily caps per author |
| **Personal details in stories** | Posts are visible to all signed-in users, so prompts should avoid private details; report is available |
| **Errors reach search engines** | The planned public `public_posts` view (`docs/PUBLIC_CONTENT_SEO.md`) must exclude help posts and games |
| **Text on images can't be read** | Enforced overlay, length limit, contrast check in both themes |
| **Levels feel slower than the rewards promise** | Show progress bars, and use the helper counter between levels |
| **Language change resets the level** | Old posts keep their look; only new posts follow the new level |

**What to measure.** Get the baseline before building, because production data wasn't available for this document. We can write the query for you to run.

- Share of active users who posted in the last 30 days, by level and native or learner.
- **Time to first fix** on a help post, and the share answered within 24 hours. This is the main number.
- Share of new users who post in their first week.
- Share of beginners who post a second time after getting a fix.
- Share of help posts answered, per language.
- Time to reach A2 and B1, before and after.

## 10. Build order

Each step is usable alone. Migrations are new files only, as usual.

1. **Beginners and answers**
   - Correct me and How do I say…?
   - The help post rules (section 6) and the Notebook look
   - Practice tab, queue, push and a new Home composer
   - Post activity counted toward levels (section 7)
2. **The ladder you can see**
   - Rules table and unlock display in the composer
   - Photo card and Describe this photo
   - My story with sentence fixes
   - Which sounds right?
3. **Games**
   - Spot the mistake and Fill the gap, with protected answer keys
   - Full image look
4. **Rich content**
   - Mini lesson with the Markdown subset
   - Dialogue, Series, Challenge
   - Top tier looks

If step 1 doesn't get beginners answered, fix that before starting step 2.

## 11. Decisions we need from you

1. **Should "Correct me" need no level at all?** *Recommended: yes.* Requiring even A1 blocks a brand-new user until they have sent 5 chat messages, and that first post is the moment we're trying to win.
2. **Should posts count toward levels the way section 7 describes?** *Recommended: yes, with B1 anchored in chat.* The alternative, counting posts at B1 too, is faster but weakens the right to correct others.
3. **Who keeps images?** Anyone eligible can use them today. *Recommended: natives and B1+ keep them, existing posts stay as they are, and text on a full image is the new reward.*
4. **Should natives earn looks by helping (section 4)?** *Recommended: yes.* It gives us the helpers that step 1 needs.
5. **Launch in all languages or only where helpers exist?** *Recommended: only where helpers exist.* An unanswered first post is worse than no feature. This needs the production numbers first.
6. **Is an AI fallback acceptable when no human answers?** *Recommended: not in step 1.* Real people correcting each other is the product. Consider it later, clearly labelled, after 24 hours with no fix.
7. **Can points buy unlocks?** *Recommended: no.* If they can be bought, unlocks stop showing that someone earned them.
