# Keyword and content plan: The Fluency Talks

This plan picks keywords and pages based only on features the app actually
has. Its main rule: **we never target a search the product can't satisfy.**
Someone who searches "language exchange video call" and lands on a text-only
app leaves right away, and that tells Google the page doesn't answer the query.

How this fits with the other docs:
- [`SEO.md`](./SEO.md): technical setup, titles, structured data, pre-rendering (§5a).
- [`GOOGLE_SEARCH_CONSOLE.md`](./GOOGLE_SEARCH_CONSOLE.md): indexing and the weekly checks.
- This file: **what to write, for which searches, in what order.** It
  replaces the article list in SEO.md §5c.

> **About demand and competition:** the *High / Medium / Low* ratings below are
> estimates, not measured search volumes. Check them in Google Keyword Planner
> (free with a Google Ads account) or Search Console → Performance before
> spending a lot of time on one page. After 3 months, real Search Console
> queries count for more than this table.

---

## 1. Fact sheet: what we can and can't claim

Every page, article, FAQ and `llms.txt` must match this list. Checked against
the code on 2026-11-01.

### ✅ Real features (OK to target and promote)

| Feature | Facts to state | Where in code |
|---|---|---|
| **Free** | No paid plans, no premium tier | — |
| **Language-pair matching** | You pick 1 native + 1 learning language (+ CEFR level). The home feed puts language matches (native speakers of your target language, and learners of your language) ahead of everyone else; within matches it does not rank natives first | `home_feed`, `MatchBadge` |
| **Text chat** | One-to-one, real time, message requests, reactions, read receipts, edit/delete | `services/messaging.ts` |
| **Inline corrections** | A native speaker, or a learner at B1+, edits your sentence in the chat; you see red → green word-level changes plus a note; you accept or dismiss | `CorrectionDialog`, `DiffText`, `can_correct_language` |
| **Phrasebook** | Accepted corrections are saved automatically; save any other message with one tap; review on the Learning page (phrases, corrections, translations). Phrases have no images; images are only on library posts | `services/phrasebook.ts`, `Learning.tsx` |
| **Tap to translate** | Translate a message; history is saved | `lib/translate.ts` (MyMemory) |
| **Points** | Start with 100; +5 when your correction is accepted (rewarded up to 10 times a day, 3 from the same learner); full ledger | `PointsHistory.tsx` |
| **Bounties** | 50 points to put a question in front of qualified speakers; the helper gets the 50 when the asker accepts; refunded if no answer is accepted within 48 h; max 3 open | `BountyQueue.tsx` |
| **Community library** | Eligible speakers post phrases, idioms, usage and grammar notes with an image; others save them | `pages/features/library` |
| **Safety** | Message requests, block, report (9 reasons), admin review, auto-suspend after 5 reports in 7 days | `services/safety.ts` |
| **Saved partners** | Private bookmarks, no follower counts | `Partners.tsx` |
| **Data control** | Export your data, delete your account | `/data-deletion` |
| **40 launch languages** | English, Vietnamese, Swahili, Spanish, French, German, Portuguese, Italian, Dutch, Polish, Ukrainian, Russian, Greek, Swedish, Czech, Romanian, Turkish, Arabic, Hebrew, Persian, Hindi, Bengali, Urdu, Tamil, Punjabi, Chinese, Cantonese, Japanese, Korean, Thai, Indonesian, Malay, Tagalog, Amharic, Somali, Yoruba, Igbo, Hausa, Zulu, Kinyarwanda. Always say **"40 languages"**, never "40+" or "100" | `migrations/20261101000003_launch_languages.sql`, `seed.sql`, `src/content/languages.ts` |

### ❌ Not in the product: don't target these searches

| Don't target | Why | If a reader asks |
|---|---|---|
| voice chat, video call, speaking practice, pronunciation | Chat is text only | Say plainly: "Practice is in writing. That's where corrections are easiest to see." |
| tutors, lessons, courses, teachers for hire | Peer exchange, no paid tutors | — |
| certificates, exams, "get certified" | None issued | CEFR level is self-reported |
| iOS / Android app, "download" | Web app only (installable PWA via `manifest.webmanifest`) | "Works in your phone's browser; add it to your home screen" |
| AI tutor, AI chatbot, speech recognition | Not built | — |
| "learn X in 30 days", "fluent fast" | Can't be promised | — |
| dating, meet people, make friends abroad | Wrong intent, and a safety risk | — |

### ✍️ The example reader

Every example (articles, FAQ, landing page, placeholders, screenshots)
assumes the reader **speaks English and is learning Vietnamese**. Use the
same correction everywhere so the brand has one recognisable example:

> <del>Tôi là đói</del> → <ins>Tôi đói</ins> ("I am hungry"). In Vietnamese,
> words like "hungry" work like verbs and take no "to be"; *là* joins two
> nouns, as in *Tôi là sinh viên* ("I am a student").

Named partners in examples: **Tom** (native English, learning Vietnamese,
A2) and **Linh** (native Vietnamese, learning English). Articles about
another language (e.g. Spanish mistakes) may use that language, but the
reader is still an English speaker.

### ✅ Wording rules (already applied to the site on 2026-11-01)

- Say **"no followers or likes"**, not "no feed": signed-in members see a community library of posts.
- The library is for **signed-in members**, not "public".
- Bounty: refunded if **no answer is accepted** within 48 hours (not "if nobody helps").
- Matching: language matches (native speakers of your target language and people learning your language) come before everyone else, in one list. A perfect swap (their native is my target and their target is my native) ranks first, but a swap is never required. Never write "people who want the opposite" or imply both sides must want something from each other.

---

## 2. Keyword clusters: feature → searches → page

Each cluster has **one pillar page** (the URL meant to rank for the main
term) and supporting articles that link to it. Priority = how well the
feature fits × how winnable the search is.

| # | Cluster (feature) | Primary keyword | Secondary keywords | Intent | Demand / Competition (est.) | Pillar page | Priority |
|---|---|---|---|---|---|---|---|
| **A** | Core: language exchange | free language exchange | language exchange app, language exchange website, language exchange partner online, find a language partner | Sign-up / compare | High / High | `/` | 1 |
| **B** | Inline corrections | get my writing corrected by native speakers | native speaker correct my sentence, language exchange with corrections, check my grammar native speaker, is this sentence correct in [language] | Solve a problem | Medium / Medium | `/how-it-works#corrections` | **1** (our hero feature) |
| **G** | Focus languages: Vietnamese and Swahili | learn Vietnamese online | Vietnamese language exchange, practise Vietnamese with native speakers, Vietnamese for English speakers, Vietnamese tones, Vietnamese greetings, common Vietnamese mistakes, learn Swahili online, Swahili language exchange | Learn | Medium / **Low–Medium** | `/languages/vietnamese`, `/languages/swahili` | **1** (our example pair, easiest to win) |
| **L** | Language pages | practise [language] with native speakers | [language] language exchange, [language] conversation partner | Sign-up | Varies | `/languages/<language>` | 2 |
| **J** | Native speakers who help (the other side of every match) | help someone learn my language | volunteer to teach English online free, how to correct someone's grammar politely, become a language exchange partner | Contribute | Low / Low | `/how-it-works#help` | 2 |
| **C** | Text-first, low pressure | text language exchange | language exchange without video, language practice for shy people, writing practice in a foreign language | Compare / reassure | Low / Low | `/how-it-works` | 2 |
| **F** | CEFR levels | CEFR levels explained | what is B1 level, A2 vs B1, how long from B1 to B2 | Learn | High / Medium | blog pillar | 2 |
| **D** | Ask a native speaker (bounties, library) | ask a native speaker | how do you say ___ in ___, what does ___ mean in Vietnamese, native speaker question | Solve a problem | Medium / High | `/how-it-works#bounties` | 3 |
| **E** | Phrasebook / remembering | how to remember vocabulary | remember phrases from conversations, personal phrasebook, sentence mining | Learn | Medium / Medium | blog pillar | 3 |
| **I** | Safety | is language exchange safe | language exchange scams, safe language exchange app | Reassure | Low / Low | `/safety` (new) or `/#faq` | 3 |
| **K** | Brand | the fluency talks | fluency talks app, thefluencytalks | Navigate | — | `/` | ongoing |

**Why G is a top priority:** Vietnamese is the language every example on the
site uses, so a reader who arrives from "learn Vietnamese online" sees their
own situation on every page. The big language-exchange sites cover Spanish,
French and Japanese heavily but have little useful content for English
speakers learning Vietnamese (tones, pronouns, *là*, northern vs southern
accents), and the same is true for Swahili. Expect page-one results for
long-tail searches within months, not years. Cluster A is the opposite: worth
having, but the home page will take a long time to rank for "language exchange app".

---

## 3. Pages to build (in this order)

All of these must be pre-rendered HTML (SEO.md §5a) before they can rank.
Add each URL to `public/sitemap.xml` only once it's live.

| Order | URL | Cluster | Title (≤ 60 chars) | Must contain |
|---|---|---|---|---|
| 1 | `/how-it-works` | B, C, D, J | `How Language Exchange with Corrections Works \| The Fluency Talks` | Sections with stable anchors: `#matching`, `#corrections` (screenshot of red → green), `#phrasebook`, `#points`, `#bounties`, `#help` (for native speakers), `#safety`. Real numbers from §1 |
| 2 | `/languages` | L, G | per SEO.md §3 | Every offered language, grouped (African, European, Middle Eastern, Asian), linking to pages that exist |
| 3 | `/languages/vietnamese`, `/languages/swahili` | G | `Practise Vietnamese with Native Speakers, Free \| The Fluency Talks` | Template in §4, with the *Tôi là đói* example on the Vietnamese page |
| 4 | `/languages/english`, `/languages/spanish`, `/languages/french` | L | same pattern | Template in §4 |
| 5 | `/languages/japanese`, `/languages/korean`, `/languages/chinese` | L | same pattern | Template in §4 |
| 6 | `/blog` + first articles | all | per SEO.md §3 | — |
| 7 | `/safety` | I | `Safety on The Fluency Talks: Requests, Blocking, Reports` | Explains each safety feature in plain words; linked from the FAQ and footer |
| 8 | `/about` | K | per SEO.md §3 | Real people, the university origin, contact |
| 9 | More `/languages/<x>` | L, G | — | Only when the supply rule below is met |

### Supply rule for language pages

A page that says "practise Kamba with native speakers" when nobody on the
site speaks Kamba natively disappoints users. Before publishing a language
page, run this in the Supabase SQL editor:

```sql
select l.english_name,
       count(*) filter (where p.native_language_id   = l.id) as natives,
       count(*) filter (where p.learning_language_id = l.id) as learners
from public.languages l
join public.profiles p on l.id in (p.native_language_id, p.learning_language_id)
group by l.english_name
order by natives desc;
```

- **≥ 5 native speakers:** publish the full page with "practise with native speakers".
- **Fewer than 5:** publish a "learn / help build it" version instead.
  *"We're looking for native Kamba speakers. Join to help learners and be
  the first they meet."* That's honest, and it brings in native speakers
  as well as learners.

---

## 4. Language page template (`/languages/<language>`)

Every language page needs at least 400 words that are specific to that
language. A page that only swaps the language name is thin content and
won't get indexed.

1. **H1:** `Practise <Language> with native speakers`
2. **Definition sentence (quotable):** *"On The Fluency Talks you can practise <Language> for free in text chat with native speakers, who correct your messages right where you wrote them."*
3. **About the language (3–5 sentences, unique):** native name (`Gĩkũyũ`), where it's spoken, script/direction, a fact a learner would care about.
4. **5 starter phrases** with translation (greeting, thanks, "how do you say…?", "can you correct me?", goodbye).
5. **One real correction example** in the app's red → green style (a mistake learners at that level often make).
6. **How it works here** (3 steps, linking to `/how-it-works#corrections`).
7. **Who you'll meet:** the honest supply line from §3.
8. **FAQ (2–3 questions, specific to the language)** → `FAQPage` JSON-LD.
9. **CTA:** `Practise <Language> free →` → `/signup`.
10. **Links:** 1–2 related blog articles and `/languages`.

---

## 5. Article calendar (2 per month, starting November 2026)

Every article follows the SEO.md §5b checklist. Each one also must:
- **Show one real feature in use**, with a screenshot or a red → green
  example (column "Shows").
- Link to its **pillar page** with descriptive anchor text.
- End with a CTA that matches the article, e.g. *"Get your Vietnamese sentences corrected by a native speaker, free →"*.

Funnel: **T** = top (just learning about the topic), **M** = middle
(comparing options), **B** = bottom (ready to sign up).

| Month | # | Title (H1) | Target search | Cluster | Funnel | Shows | Links to |
|---|---|---|---|---|---|---|---|
| Nov 2026 | 1 | What Is a Language Exchange and How Does It Work? | what is a language exchange | A | T | Matching + correction | `/how-it-works` |
| Nov 2026 | 2 | How to Get Your Writing Corrected by Native Speakers (Free) | get writing corrected by native speakers | B | M | Correction dialog, accept / dismiss | `/how-it-works#corrections` |
| Dec 2026 | 3 | How to Learn Vietnamese Online: A Beginner's Guide for English Speakers | learn Vietnamese online | G | T | *Tôi là đói* → *Tôi đói* | `/languages/vietnamese` |
| Dec 2026 | 4 | Vietnamese Greetings: Why "Xin chào" Isn't Enough (Pronouns Explained) | Vietnamese greetings | G | T | Phrasebook saving greetings | `/languages/vietnamese` |
| Jan 2027 | 5 | How to Find a Language Exchange Partner Online | find language exchange partner online | A | M | Home feed + match badges | `/languages` |
| Jan 2027 | 6 | CEFR Levels A1 to C2 Explained: What You Can Do at Each Level | CEFR levels explained | F | T | Level picker in onboarding | `/how-it-works#matching` |
| Feb 2027 | 7 | Your First Message to a Language Partner: 15 Openers That Work | first message language exchange partner | A | B | Message request flow | `/signup` |
| Feb 2027 | 8 | Vietnamese Tones Explained for English Speakers | Vietnamese tones | G | T | Correction of a wrong tone mark | `/languages/vietnamese` |
| Mar 2027 | 9 | How to Help Someone Learn Your Language (No Teaching Degree Needed) | help someone learn my language | J | M | Correcting a message, +5 points | `/how-it-works#help` |
| Mar 2027 | 10 | How to Correct Someone's Grammar Without Being Rude | how to correct someone's grammar politely | J/B | T | Correction note field | `/how-it-works#corrections` |
| Apr 2027 | 11 | Is Language Exchange Safe? How to Spot Scams and Stay in Control | is language exchange safe | I | M | Message requests, block, report | `/safety` |
| Apr 2027 | 12 | Common Vietnamese Mistakes English Speakers Make (and the Fix) | common Vietnamese mistakes | G/B | T | 5 red → green examples | `/languages/vietnamese` |
| May 2027 | 13 | Text or Video Language Exchange: Which Is Better for Beginners? | text vs video language exchange | C | M | Honest: we're text-first and why | `/how-it-works` |
| May 2027 | 14 | How to Remember the Phrases You Learn in Conversation | remember phrases from conversations | E | T | Phrasebook + translation history | `/how-it-works#phrasebook` |
| Jun 2027 | 15 | How to Learn Swahili Online: A Beginner's Guide | learn Swahili online | G | T | Swahili correction example | `/languages/swahili` |
| Jun 2027 | 16 | Practise English with Native Speakers for Free | practise English with native speakers free | L | B | English partner match | `/languages/english` |
| Jul 2027 | 17 | What Is B1 Level? What You Can Do and How to Reach It | what is B1 level | F | T | B1+ can correct others | `/how-it-works#help` |
| Jul 2027 | 18 | Spanish Mistakes Learners Make (and the Native Way to Say Them) | common Spanish mistakes | L/B | T | Spanish red → green examples | `/languages/spanish` |
| Aug 2027 | 19 | How to Ask Native Speakers a Question and Actually Get an Answer | ask a native speaker | D | M | Bounty (50 pts, 48 h refund) | `/how-it-works#bounties` |
| Aug 2027 | 20 | Northern or Southern Vietnamese: Which Should You Learn? | northern vs southern Vietnamese | G | T | Library "usage" post | `/languages/vietnamese` |
| Sep 2027 | 21 | Swahili Greetings: How to Say Hello (and Reply) Like a Local | Swahili greetings | G | T | Phrasebook saving greetings | `/languages/swahili` |
| Sep 2027 | 22 | Why You Can Read a Language but Can't Write It Yet | can understand but can't write a language | C | T | Writing practice + corrections | `/how-it-works` |
| Oct 2027 | 23 | Why Flashcard Apps Alone Won't Make You Fluent | why can't I speak after Duolingo | A/C | M | Real chat vs drills (name categories, not competitors) | `/` |
| Oct 2027 | 24 | Language Exchange Etiquette: 10 Rules for Good Partners | language exchange etiquette | A/I | T | Requests, saved partners | `/safety` |

**Why this order:** Nov–Feb sets up the definitional pieces (A, B) that every
later article links back to, and starts the cluster we're most likely to win
(G, Vietnamese first) early, since rankings take 3–6 months to build. Supply-side articles (J)
come before the bigger "find a partner" content so new learners actually find
native speakers when they arrive.

**Internal linking:** each new article links to at least one older article in
the same cluster, and the oldest article in each cluster gets updated to link
forward to the new one.

---

## 6. Later option: public library pages (needs a team decision)

Library posts (phrase / idiom / usage / grammar, written by native speakers
with a translation and context) would make strong pages for searches like
*"what does 'phá băng' mean"* or *"Vietnamese idioms"*. Today `/library` is
blocked in `robots.txt` and behind login. Don't do this without deciding:

- **Consent:** authors agreed to share with signed-in members, not the open
  web. Add an opt-in ("Show this post publicly") and apply it only to new posts.
- **Moderation:** public pages must only show posts with no open reports.
- **Thin content:** publish only grouped pages (e.g. `/phrases/swahili/idioms`
  with 10+ posts), not one URL per post.
- **Attribution:** username only, linking to nothing private.

If the team agrees, this is the cheapest way to get hundreds of useful pages,
and those pages also bring in native speakers.

---

## 7. Measuring it

| When | Check | Where | Action |
|---|---|---|---|
| Monthly | Clicks and impressions **per cluster** (filter queries by keyword, e.g. "vietnamese", "correct") | Search Console → Performance → Queries | Put effort into clusters that are growing; rethink clusters with zero impressions after 4 months |
| Monthly | Queries with impressions where we rank 8–20 | Performance, sort by position | Expand that article, add internal links, improve the title |
| Monthly | Queries we have **no page for** | Performance → Queries | Add to the calendar (replace a lower-priority slot) |
| Monthly | Sign-ups from blog / language pages | Analytics (SEO.md §7.7), landing page = `/blog/*` or `/languages/*` | Improve CTAs on high-traffic, low-conversion pages |
| Quarterly | Re-run the supply query (§3) | Supabase | Publish or upgrade language pages |
| Quarterly | Ask AI assistants: "practise Vietnamese with native speakers for free", "free language exchange with corrections" | ChatGPT, Perplexity, Gemini, Claude | Note whether we're cited and which page they quote |
| Every feature change | Re-check §1 | This file | Update the fact sheet, then FAQ, `llms.txt`, and affected articles |
