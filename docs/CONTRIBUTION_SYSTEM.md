# The contribution system

How posting, corrections, levels and accountability work together, what can happen to a member, and why. This is the specification: if the app disagrees with it, one of them is wrong.

**The rule behind all of it:** every learner can take part from day one, and taking part counts toward learning.

**The limit on that rule:** activity never proves ability. Posting a lot or being saved doesn't promote anyone, because a level is what lets someone correct others.

## Three separate things

| | What it says | What moves it | Where it shows |
|---|---|---|---|
| **Learning progress** | What you can do in the language | Your writing and chat, once a qualified person has reviewed them | Verified level |
| **Community contribution** | How much you help | Posts, corrections, points | "Your contribution", under your level |
| **Responsiveness** | Whether you answer corrections on your teaching posts | Decisions, on time or late | "Answered N of M on time" |

They never feed each other. Being slow to answer can't lower a level, and helping a lot can't raise one beyond the rules below.

## Post types

There are two families. **Practice** is for learners and is always in the language you are learning, chosen by the server. **Teaching** claims to be right, so it needs a qualified author: a native speaker, or a learner verified at B1 or above in that language.

| Type | Family | Who can post | Length | How readers respond |
|---|---|---|---|---|
| Correct me | Practice | Anyone learning a language | 280 | Fix it, or confirm it's right |
| How do I say…? | Practice | Anyone learning a language | 280 | Answer with the phrase |
| Story or journal | Practice | Anyone learning a language | Title 280, text 5,000 | Fix one sentence at a time |
| Photo and caption | Practice | Anyone learning a language | 280, or 120 on the image | Fix the caption |
| Question or discussion | Practice | Anyone learning a language | 280, detail 2,000 | Anyone can reply. No corrections |
| Phrase, idiom, usage, grammar | Teaching | Qualified | 500 each field | Confirm, correct, ask |
| Lesson or explanation | Teaching | Qualified | Title 500, text 5,000 | Confirm, correct one sentence at a time, ask |

- **Limits:** 5 practice posts a day, 20 of any kind a day.
- **Where they appear:** practice is on the Library's Practice tab and in Home. Teaching is on All posts, in search and in Home. Unreviewed learner writing stays out of the Library and out of search, so nobody learns from mistakes presented as reference.
- **Images:** any member can use one. There's nothing to earn. Images come from Unsplash only, so there's nothing to host or moderate. Text on an image has a dark layer behind it and a 120-character limit, so it stays readable on any photo.

**Why a beginner can't post a Phrase or Lesson in their learning language.** The Library is where people go to find out what's correct. A beginner can publish anything they want, the same day, as practice. What waits for B1 is the claim that it's right.

## Statuses

Every post uses the same four. None of them suggests the author did something wrong.

| Status | Means | Set when |
|---|---|---|
| Awaiting feedback | Nobody has responded usefully yet | New, or the only fix was marked not helpful |
| Corrections received | Something is waiting to be read or decided. Questions and "How do I say…?" read **Answers received** | A correction or clarification is open, or a question has a reply |
| Under review | A moderator has been asked to look | A decision went past its deadline and escalated |
| Reviewed | Someone qualified confirmed it, or a correction was accepted | Nothing is open, and at least one was accepted or confirmed |

## The correction lifecycle

1. **A member publishes.**
2. **Qualified people suggest corrections.** Each needs an explanation. On a story or lesson a correction covers one sentence: the reader taps it, and only those words change. Someone else's identical pending suggestion is refused, with a prompt to agree with it instead.
3. **Others weigh in.** Anyone can agree. Qualified people can offer a better version, or flag it as wrong. A flag replaces that person's agreement, and the count is shown to the author.
4. **The author responds.**
   - On **practice** posts: thank a fix, mark it not helpful with an optional reason, or do nothing. There's no deadline.
   - On **teaching** posts: accept, decline with an optional reason, or ask about it.
   - Declining is a real answer. Nobody has to accept a correction that's wrong, a matter of style, or from another dialect.
5. **The record updates.** The original is never changed. An accepted fix goes to the author's phrasebook, as in chat, and the post shows a corrected reading beside the original. Progress is re-checked at each step.

## What can happen

| Situation | What happens |
|---|---|
| A beginner writes a story with mistakes on day one | It's published. Up to 5 qualified people are notified. No level is needed |
| Nobody qualified exists in that language yet | The composer says so honestly, and the post stays open |
| Ten people correct a beginner's post | They get ten notifications and no duty. Nothing can pause them because of it |
| A beginner ignores every fix | Nothing happens to them |
| Two people fix the same sentence and the author thanks both | Both stay on record. The corrected reading uses the newest thanks |
| A correction on a lesson is accepted, then a newer one for the same sentence | The older one is marked superseded, and its author is told |
| The author of a teaching post doesn't understand a correction | They tap **Ask about it**. The person is notified and the deadline restarts, once per correction |
| The author accepts by mistake | **Go back to the original** on a teaching post undoes it and keeps the history. A thank-you on a practice post is final |
| Someone edits a story after a reply | The text is locked, because corrections point at exact words. Other details can still change |
| The author deletes a practice post | It goes, with its thread. A teaching post with open decisions has to be answered first |
| A teaching post's author goes quiet | See the timeline below |

### When a teaching post's author goes quiet

Only corrections on teaching posts create a duty. These are the defaults, which admins can change on the Decisions page:

| When | What happens |
|---|---|
| A correction arrives | The author is notified, and it appears in their decision list and the Home banner |
| After 48 hours, then every 48 hours | A reminder |
| Day 7 | The deadline passes. Author and corrector are both told |
| 72 hours later | A moderator is told, and the post shows **Under review** |
| 3 or more overdue for 72 hours | A **warning**: teaching posts pause in 3 days unless these are answered |
| 72 hours after the warning, if still 3 or more | **New teaching posts pause** |
| 2 or fewer overdue | The pause lifts by itself |

At any point the author can decide, ask about it, take one 7-day extension, or appeal to a moderator. A pause never touches practice posts, chat, replies, or anything else.

## How levels work

Levels rise on their own and never fall, except that changing your learning language starts again. The thresholds in `level_rules` are listed in [Features](FEATURES.md#4-earned-levels-and-vouches).

| Activity | Counts toward |
|---|---|
| Chat messages in the language | Messages, active days, and reviewed work when a qualified person replied or corrected |
| Correct me, stories, photo captions | Messages and active days. A review counts as reviewed work up to A2 |
| Questions, How do I say…? | Nothing. They may be written in any language, so they don't show ability |
| Corrections accepted or thanked, in chat or on posts | "Corrections accepted", from B2 |
| Saves of your teaching posts | "Post saves", from C1 |
| Likes, post counts, points | Nothing |

- **Who counts as a reviewer:** a native speaker, or someone verified at B2 or above in that language. A language with few natives no longer traps its learners at A1.
- **New reviewers count at once for A1 and A2,** which give no rights. From B1 up, where a level lets someone correct others, a reviewer counts once they've been here 7 days. Nothing is lost: earlier messages count from that day, and the progress panel says who is waiting. The error rate for B1 and up leaves new reviewers out, so a new account can't dilute it.
- **Anyone qualified can vouch from day one.** A vouch starts counting once its author has been here 7 days, with nothing more to do. The screen says when.
- **B1 stays anchored in chat.** It's where someone gets the right to correct others, so its partner, review and error-rate needs must come from real conversation.
- **Asking never hurts you.** Fixes on posts stay out of the error rate. Only corrections on chat messages count.
- **Not every correction weighs the same.** A chat correction with no explanation counts as half.
- **Checks follow events.** Database triggers re-check after a post, a correction, a decision, a rating, a confirmation or a save. Checks can safely repeat, because they only read the evidence and a promotion happens once. Chat messages check at most hourly, and opening your progress always checks.

## Keeping it fair

| Abuse | What stops it |
|---|---|
| Spam from accounts with no level | 5 practice posts a day, reports, and automatic suspension at 5 reporters in 7 days |
| The same correction twice | Refused for anyone, while one is pending |
| Two friends correcting each other for levels | A person counts for at most 3 corrections a day and 10 overall. From B1 up, reviewers must be 7+ days old. Points have their own daily limits |
| A second account promoting the first | Its reviews and vouches don't count toward B1 until it's 7 days old, and blocked pairs don't count. Waiting costs a genuine person nothing, because their vouch is already recorded |
| Low-quality corrections | Mostly "not helpful" ratings pause rewards. Explanations are required on posts |
| Claiming a level | The level you pick unlocks nothing. Only the verified level does |

## Data model

| Thing | Where |
|---|---|
| Type, long text, corrected reading, image layout | `contribution_posts.post_type`, `body`, `current_body`, `image_layout` |
| The words a correction covers | `post_discussion.target_start`, `target_end`, `target_text`. Positions count characters from 0, as Postgres does |
| Corrected reading | `applied_body()`, recomputed by `refresh_post_review()`. Never stored over the original |
| Agree or flag | `correction_agreements.stance`, one per person per correction |
| Where a saved phrase came from | `saved_phrases.source_post_id` or `source_message_id` |
| The warning before a pause | `accountability_warnings` |
| Asking about a correction | `ask_about_correction()`, `decision_items.clarification_asked_at` |
| Level re-checks | `trg_recheck_level()` on posts, corrections, confirmations and saves |

**Sentence positions.** The browser splits sentences (`src/lib/sentences.ts`, using `Intl.Segmenter`), and the server only sees a range. It reads the words itself and refuses a range outside the text, so a poor split can only give an awkward selection, never change the wrong words. An emoji counts as one character on both sides.

**On screen.** Type rules are in `src/lib/postTypes.ts` and each type's look in `postLooks.ts`. Each category and type has its own colour and mark, built from design tokens so both themes work.

## How it's tested

`supabase/tests/app_flow.sql`, section "THE WHOLE CONTRIBUTION SYSTEM", replays these journeys against a real database with the RPCs the app calls. Run it with `npm run test:db`.

| Journey | Checks |
|---|---|
| Beginner | Every practice type with no level, limits for each, refused from teaching types, kept out of Library search |
| Correcting a story | Whole-text correction refused, range checked, emoji positions right, no duty created |
| Author | Original untouched, corrected reading right, newest wins on the same words, phrasebook filled, text locked |
| Native speaker and B2 reviewer | B2 counts as a reviewer, a new account counts toward A2 only, flags and improvements work, beginners can't flag |
| Teaching post author | Decision created, asking restarts the clock once, Under review on escalation, going back undoes every sentence |
| Being paused | Warning first, notice period respected, practice posts still work, teaching posts don't |
| Levels | Promotion from writing alone with no chat, half weight, the per-person limit |

`tests/unit/sentences.test.ts` and `postTypes.test.ts` cover the pure helpers.

## Not built, on purpose or not yet

- **Rich text in lessons.** Text and line breaks only. Headers and lists would need a small renderer.
- **Games and locked looks.** Spot the mistake, Fill the gap, Dialogue, Series and the level-gated looks were dropped from the near-term plan. See [Post type ideas](POST_TYPES_AND_UNLOCKS.md).
- **Correcting a story's title.** Only the text takes corrections. A reply can mention the title.
- **AI fallback when nobody answers.** Real people correcting each other is the product.
- **Time to first fix.** Still not measured, and it's the number that matters most. A beginner whose first post gets no answer is the biggest risk to this design.

## Decisions for the owner

1. **Launch in every language, or only where helpers exist?** No per-language gate is built. A language with no native or B2+ speakers still can't move anyone past A1.
2. **Are the numbers right?** 5 practice posts a day, the 3-overdue pause, 10 corrections per person and half weight are all starting values. Measure them after launch.
