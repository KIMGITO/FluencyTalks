# SEO and AI visibility: The Fluency Talks (`thefluencytalks.com`)

This file is the plan for getting found on Google and cited by AI assistants
(ChatGPT, Gemini, Claude, Perplexity, Copilot, Google AI Overviews).
The step-by-step for Google Search Console is in
[`GOOGLE_SEARCH_CONSOLE.md`](./GOOGLE_SEARCH_CONSOLE.md). Which URLs to submit: [`INDEXING_CHECKLIST.md`](./INDEXING_CHECKLIST.md).
AI assistants: [`AI_VISIBILITY.md`](./AI_VISIBILITY.md). Making member-created content searchable: [`PUBLIC_CONTENT_SEO.md`](./PUBLIC_CONTENT_SEO.md).
Every rule in this file that can be checked by a program is checked by `npm run check:seo` after a build, and in CI.

Single source of truth for brand strings: **`src/lib/site.ts`** (`BRAND`,
`SITE_URL`, `TAGLINE`, `DEFAULT_TITLE`, `DEFAULT_DESCRIPTION`, `OG_IMAGE`).
Per-page titles and descriptions are set with `useSeo()` from
`src/hooks/useSeo.ts`.

---

## 1. Pages: what gets indexed and what does not

### 1a. Index these (submit in the sitemap, request indexing in Search Console)

| URL | Status | Purpose | Priority |
|---|---|---|---|
| `https://thefluencytalks.com/` | ✅ live | Home page: what it is, who it is for, how it works, sign-up | 1.0 |
| `https://thefluencytalks.com/privacy` | ✅ live | Privacy policy (trust signal) | 0.3 |
| `https://thefluencytalks.com/terms` | ✅ live | Terms of service (trust signal) | 0.3 |
| `https://thefluencytalks.com/data-deletion` | ✅ live | Account / data deletion (required by Google & Facebook login reviews) | 0.2 |
| `https://thefluencytalks.com/blog` | ✅ live | Blog index: learning guides | 0.8 |
| `https://thefluencytalks.com/blog/<slug>` | ✅ live (3 articles) | One URL per article (see §5) | 0.7 |
| `https://thefluencytalks.com/languages` | ✅ live | All 40 languages you can practise, each linking to its page | 0.8 |
| `https://thefluencytalks.com/languages/<language>` | ✅ live (40 pages, from `src/content/languages.ts`) | e.g. `/languages/vietnamese`: "Practise Vietnamese with native speakers" | 0.7 |
| `https://thefluencytalks.com/how-it-works` | 🟡 optional | Longer version of the 3 steps, corrections, points & bounties | 0.6 |
| `https://thefluencytalks.com/about` | ✅ live | Who built it, why, contact. Strong trust signal for Google and AI answers | 0.5 |

> **Rule:** a URL only goes into `public/sitemap.xml` once the page exists and
> returns real HTML content. Never list a page that 404s or is a login wall.

### 1b. Never index these

| Routes | How they are kept out |
|---|---|
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding` | `X-Robots-Tag: noindex, nofollow` (`public/_headers`, works without JavaScript) **and** `useSeo({ noIndex: true })` → `<meta name="robots" content="noindex, nofollow">`. Not blocked in `robots.txt` |
| `/404` / unknown URLs | `noIndex: true` |
| `/onboarding`, `/home`, `/search`, `/discover`, `/messages/*`, `/profile/*`, `/u/*`, `/settings`, `/learning`, `/phrasebook`, `/library/*`, `/partners`, `/bounty-queue`, `/points-history`, `/admin` | `Disallow` in `public/robots.txt` + behind login |

Private user content (profiles, chats, phrasebooks) must never be public. It
is personal data, and it would be thin, duplicate content anyway.

> **Note on `noindex` + `Disallow`:** Google can't read a `noindex` tag on a
> page that robots.txt blocks. That's fine here because the auth pages are
> *not* disallowed (Google reads their `noindex`), and the app pages are
> disallowed *and* behind login.

---

## 2. The home page: answer six questions in the first screen

A visitor (and a crawler, and an AI model) should get all six answers from
the first ~150 words. Current state and the wording to use:

| Question | Where it is answered | Copy to use |
|---|---|---|
| **What is The Fluency Talks?** | Hero H1 + lead | *"The Fluency Talks is a free language exchange where you chat with native speakers who correct your messages as you write."* |
| **Who is it for?** | Hero kicker / lead, Roles section | *"For anyone learning a language, from A1 beginners to C1, and for native speakers who want to help."* |
| **What can users do on it?** | Services cards | *"Find a language partner, chat, get corrections inside the chat, save them to a phrasebook, and earn points for helping others."* |
| **How does it work?** | Intro 3 steps | *"1. Pick your native and target language. 2. Message a matched partner. 3. They correct you in the chat; you keep the phrase."* |
| **Why choose it over alternatives?** | Services + FAQ | *"Corrections happen inside the conversation, matches are by language not popularity, there are no followers or likes, and it's completely free."* |
| **How do I start?** | Hero CTA, final CTA | *"Create a free account in a minute: choose your languages and send your first message today."* |

### Recommended home-page copy changes

The current H1, *"Speak a language with the people who speak it."*, is
memorable but never says *language exchange*, *practice* or *native
speakers*, which are the words people actually search for. Keep the tone
and add the keywords:

- **Kicker (above H1):** `Free language exchange · 40 languages`
- **H1:** `Practise a language with native speakers who correct you as you chat`
  *(or keep the current H1 and put the keyword sentence in the lead paragraph
  as the very first words)*
- **Lead paragraph (first sentence must stand alone as a definition):**
  `The Fluency Talks is a free language exchange app. Tell us the language you speak and the one you're learning, we match you with people who want the opposite, and they correct your messages right inside the chat.`
- **Under the CTA:** `Free forever · No paid plans · A1 to C2 welcome`
- **Add a "Why The Fluency Talks" comparison block** (3–4 rows) above the FAQ:

  | | The Fluency Talks | Flashcard apps | Paid tutors |
  |---|---|---|---|
  | Real conversations | ✅ | ❌ | ✅ |
  | Corrections in context | ✅ inside the chat | ❌ | Sometimes |
  | Cost | Free | Freemium | Per hour |
  | Native speakers | ✅ | ❌ | ✅ |

  Name categories, not competitors. It's fairer and it ages better.

### FAQ additions (each becomes FAQPage structured data automatically)

Add to `faqs` in `src/components/landing/Faq.jsx`. These match real search
and AI-assistant questions:

- *What is a language exchange?* "A language exchange is when two people who speak different languages help each other practise. On The Fluency Talks you chat in writing and correct each other's messages."
- *How is The Fluency Talks different from other language exchange apps?* "Corrections are built into the chat, you're matched by language rather than popularity, there are no followers or likes, and it's free with no paid tier."
- *Can I practise English with native speakers for free?* "Yes. Choose English as the language you're learning, and native English speakers who are learning your language will see you as a match."
- *Do I have to speak on video?* "No. Practice happens in text chat, so you can take your time and see every correction written out."
- *What level do I need?* (already covered: keep it)

---

## 3. Titles, descriptions and H1s, page by page

Rules: one unique `<title>` per page (50–60 characters, main keyword first,
brand last); one meta description (140–160 characters, says what the reader
gets and invites the click); exactly one `<h1>` describing the page's purpose.

| URL | `<title>` | Meta description | H1 |
|---|---|---|---|
| `/` | `Free Language Exchange: Practise with Native Speakers \| The Fluency Talks` | `Chat with native speakers in 40 languages and get your mistakes corrected inside the conversation. Free language exchange for A1 to C2 learners. Start today.` | `Practise a language with native speakers who correct you as you chat` |
| `/privacy` | `Privacy Policy \| The Fluency Talks` | *(current is good)* | `Privacy Policy` |
| `/terms` | `Terms of Service \| The Fluency Talks` | *(current is good)* | `Terms of Service` |
| `/data-deletion` | `Delete Your Account and Data \| The Fluency Talks` | `How to permanently delete your The Fluency Talks account, messages and phrasebook, and what happens to your data afterwards.` | `Delete your account and data` |
| `/languages` | `Practise 40 Languages with Native Speakers \| The Fluency Talks` | `Find a language exchange partner for Vietnamese, Swahili, English, French, Spanish, Japanese, Arabic and 33 more languages. Free, with corrections in every chat.` | `Languages you can practise` |
| `/languages/vietnamese` *(pattern)* | `Practise Vietnamese with Native Speakers, Free \| The Fluency Talks` | `Find a Vietnamese language exchange partner. Chat with native Vietnamese speakers, get your sentences corrected in the conversation, and save phrases. Free.` | `Practise Spanish with native speakers` |
| `/blog` | `Language Learning Guides and Tips \| The Fluency Talks Blog` | `Practical guides on language exchange, speaking confidence and learning with native speakers, written for real learners from A1 to C2.` | `Language learning guides` |
| `/blog/<slug>` | `<Article title> \| The Fluency Talks` | Article summary, 150 chars, answers the question in the title | Article title |
| `/about` | `About The Fluency Talks: Who We Are` | `The Fluency Talks started as a university project and is now a free language exchange used by learners in 40 languages. Meet the people behind it.` | `About The Fluency Talks` |

To apply the home-page title/description: update `TAGLINE`,
`DEFAULT_TITLE`, `DEFAULT_DESCRIPTION` in `src/lib/site.ts` **and** the
hard-coded copies in `index.html` (title, `og:*`, `twitter:*`). The
`index.html` copies are what non-JS crawlers and link previews see.

---

## 4. Getting seen by AI assistants (ChatGPT, Gemini, Claude, Perplexity, AI Overviews)

AI answers draw from (a) search indexes (Google, Bing) and (b) their own
crawlers. They quote pages that state facts plainly and that other sites
mention. What to do:

1. **Let the AI crawlers in.** `public/robots.txt` allows everyone (`User-agent: *`),
   which includes `GPTBot`, `OAI-SearchBot`, `ChatGPT-User`, `ClaudeBot`,
   `Claude-SearchBot`, `PerplexityBot`, `Google-Extended`, `Applebot-Extended`, `Bingbot`.
   They are also listed explicitly so the intent is clear. If you use
   **Cloudflare**, check *Security → Bots → "Block AI bots"* is **off**, or
   Cloudflare will block them before robots.txt is even read.
2. **Be in Bing.** ChatGPT search and Copilot use Bing's index. Set up
   **Bing Webmaster Tools** (it can import your Google Search Console property
   in one click) and submit the sitemap there too.
3. **`/llms.txt` exists (`public/llms.txt`), but do not expect it to do much.** Google says its Search
   ignores the file, and there is little evidence the main AI crawlers read it. It costs nothing; keep it
   accurate, and spend the time on indexing and on getting mentioned elsewhere. See `AI_VISIBILITY.md`.
4. **Write "quotable" sentences.** One-sentence definitions near the top of
   each page: *"The Fluency Talks is a free language exchange app where native
   speakers correct your messages inside the chat."* AI models lift
   sentences like this verbatim.
5. **State facts as facts:** number of languages (40), price (free, no paid
   plans), levels (A1–C2), points (start with 100, +5 per accepted correction,
   bounties cost 50 and are refunded if no answer is accepted within 48 hours). Consistent numbers across
   the home page, FAQ, `llms.txt` and structured data build trust.
6. **Get mentioned elsewhere.** AI assistants trust brands other sites talk
   about. Free options: a Product Hunt launch, r/languagelearning and
   language subreddits (be helpful, not spammy), a university / department
   showcase page, GitHub README, LinkedIn post, AlternativeTo listing,
   language-learning directories. Each mention should use the exact name
   **"The Fluency Talks"** and link to `https://thefluencytalks.com/`.
7. **Test it.** Every month ask ChatGPT, Perplexity, Gemini and Claude:
   *"free language exchange app with corrections"*, *"where can I practise
   Vietnamese with native speakers"*, *"what is The Fluency Talks"*. Note what
   they say and which pages they cite.

---

## 5. The learning blog

**Why:** most people searching are not ready to sign up yet. They're asking
"how do I get better at Vietnamese?" A blog lets you show up for those
questions and lead the reader to the product.

### 5a. How it is built (crawlable HTML) ✅

The site is a Vite SPA: without help, crawlers see an empty `<div id="root">`
until JavaScript runs. Google *can* render JS, but slowly and not always, and
**most AI crawlers do not run JavaScript at all.** So the public pages are
**prerendered to static HTML at build time**:

- `npm run build` = `vite build` → `vite build --ssr src/entry-server.tsx --outDir dist-ssr` → `node scripts/prerender.mjs`.
- `src/entry-server.tsx` lists the public pages (`PUBLIC_PAGES`) and renders each with `renderToString`.
  `useSeo()` records the page's title/description/canonical during that render.
- `scripts/prerender.mjs` writes `dist/index.html`, `dist/blog.html`, `dist/blog/<slug>.html`,
  `dist/privacy.html`, … each with its own `<title>`, description, canonical, `og:*`/`twitter:*`,
  the design tokens inlined, and the full page HTML inside `#root`. Cloudflare serves
  `/blog` from `blog.html` without a redirect, so canonicals have no trailing slash.
- The same script generates **`dist/sitemap.xml`** from `PUBLIC_PAGES` (with `<lastmod>` for articles).
  `public/sitemap.xml` was removed. **Never edit the sitemap by hand.** Add a page to `PUBLIC_PAGES`.
- Each article renders `BlogPosting` + `BreadcrumbList` JSON-LD in its body.
- The browser app replaces the prerendered HTML when it starts. Cloudflare serves `index.html`
  for unknown URLs (e.g. `/home`), so a tiny inline script clears the prerendered home page
  on any other path before it paints.

**Publishing an article:** add `src/content/blog/<slug>.tsx` (copy an existing one), import it
in `src/content/blog/index.ts` at the top of `POSTS`, add it to `public/llms.txt`, build, deploy,
then request indexing in Search Console.

**Adding another public page** (e.g. `/about`, `/languages/vietnamese`): add the route to
`src/router/index.tsx`, to the `<Routes>` and `PUBLIC_PAGES` in `src/entry-server.tsx`, and
make sure the page calls `useSeo()` and does not touch `window`/`document` while rendering.

### 5b. Article checklist

- One H1 = the question or promise in the title.
- Answer the question in the **first 2–3 sentences** (featured snippets and AI answers take this).
- 800–1,500 words, H2s phrased the way people search ("How long does it take to…").
- Real examples, including a correction example in the "red → green" style the app uses.
- **2–4 internal links** with descriptive anchor text, e.g. *"find a
  [Vietnamese language exchange partner](/languages/vietnamese)"*, never *"click here"*.
- One CTA box at the end: *"Practise this with a native speaker, free →"* linking to `/signup`.
- Author name + short bio (a real person, e.g. the student team), and the date published/updated.
- Every meaningful image has alt text describing it (see §6).

### 5c. First 12 articles (titles match real searches)

> **Superseded:** the full keyword plan and the 24-article calendar are now
> in [`CONTENT_PLAN.md`](./CONTENT_PLAN.md). The list below is kept for reference.

| # | Title (H1) | Target search | Links to |
|---|---|---|---|
| 1 | What Is a Language Exchange and How Does It Work? | what is a language exchange | `/`, `/how-it-works` |
| 2 | How to Find a Language Exchange Partner Online (Free) | find language exchange partner | `/languages`, `/signup` |
| 3 | 10 Ways to Practise Speaking a Language When You Have No One to Talk To | practise speaking a language alone | `/` |
| 4 | How to Get Corrections from Native Speakers Without Feeling Embarrassed | get corrected by native speakers | `/#services` |
| 5 | A1 to C2 Explained: What Each CEFR Level Means for Conversation | CEFR levels explained | `/languages` |
| 6 | Your First Message to a Language Partner: 15 Openers That Work | how to start a conversation with a language partner | `/signup` |
| 7 | How to Learn Swahili Online: A Beginner's Guide | learn Swahili online | `/languages/swahili` |
| 8 | Practise English with Native Speakers for Free: A Practical Guide | practise English with native speakers free | `/languages/english` |
| 9 | Spanish Phrases Learners Get Wrong (and the Native Way to Say Them) | common Spanish mistakes | `/languages/spanish` |
| 10 | Why Flashcard Apps Alone Won't Make You Fluent | why can't I speak after Duolingo | `/` |
| 11 | How to Build a Personal Phrasebook That You'll Actually Remember | how to remember vocabulary | `/#services` |
| 12 | Language Exchange Safety: How to Practise Online Safely | is language exchange safe | `/#faq` |

Publish 2 a month, update older ones, and link new articles to older ones.

---

## 6. On-page checklist (status)

| Element | What good looks like | Status / action |
|---|---|---|
| **Page titles** | Unique per page, keyword first, brand last, ≤ 60 chars | ✅ unique via `useSeo`; home is now `Free Language Exchange with Native Speakers \| The Fluency Talks` |
| **Meta descriptions** | 140–160 chars, says who it's for and what they get | ✅ all public pages; home rewritten. data-deletion rewritten too |
| **H1 headings** | Exactly one per page, describes the purpose | ✅ one per page (Hero, LegalLayout, NotFound, blog, each article). Home H1 kept for its voice; the keyword kicker ("Free language exchange · 40 languages") and the definition sentence opening the lead carry the search terms |
| **Internal links** | Descriptive anchors between home, languages, blog, sign-up | ✅ Blog in header, drawer and footer; FAQ links to the language-exchange article; articles link to each other, home and sign-up. ✅ Languages index + 40 language pages, linked from the home Languages section, footer and each other |
| **Image alt text** | Meaningful images described; decorative images `alt=""` | ✅ Hero photos are decorative (`alt=""`, `aria-hidden`), logo has `alt`. 🔧 Blog/language page images need real descriptions, e.g. `alt="Two students chatting over coffee while practising French"`, not keyword lists |
| **Structured data** | Accurate Organization, WebSite, SoftwareApplication, FAQPage | ✅ `index.html` has WebSite, WebApplication, Organization. ✅ FAQPage (rendered by React). ✅ `BlogPosting` + `BreadcrumbList` per article. Validate at search.google.com/test/rich-results |
| **Mobile performance** | LCP < 2.5 s, CLS < 0.1, INP < 200 ms on mobile | ✅ Hero image has `fetchpriority`, `srcset`, sizes; logo is 5–9 KB. 🔧 `favicon.png` (100 KB) and `favicon-dark.png` (164 KB): shrink to 32/180/512 px versions. Check PageSpeed Insights + Search Console Core Web Vitals after launch |
| **Public HTML content** | Crawler sees real text without running JS | ✅ Public routes are prerendered to static HTML (§5a). The bare SPA shell keeps a `<noscript>` summary |
| **Canonical URLs** | One version per page, apex domain, https | ✅ `useSeo` sets canonical. 🔧 `www` and old-domain 301s are in `vercel.json`, which **Cloudflare ignores**. Add Cloudflare *Rules → Redirect Rules* (`www.thefluencytalks.com/*` → `https://thefluencytalks.com/$1`, 301) |
| **robots.txt / sitemap** | App routes blocked, public pages listed | ✅ Updated: now also blocks `/library`, `/partners`, `/bounty-queue`, `/points-history` and names AI crawlers |
| **Social card** | 1200×630 designed image | ✅ Designed card (`public/og-image.png`); source in `scripts/og-image.html` |
| **`llms.txt`** | Plain summary for AI models | ✅ `public/llms.txt` |

---

## 7. Off-site / ops to-do

1. **Google Search Console:** follow [`GOOGLE_SEARCH_CONSOLE.md`](./GOOGLE_SEARCH_CONSOLE.md).
2. **Bing Webmaster Tools:** import from Search Console, submit sitemap (feeds ChatGPT search & Copilot).
3. **Cloudflare:** add www → apex redirect rule; make sure "Block AI bots" / "AI Labyrinth" are off; confirm `robots.txt` isn't replaced by Cloudflare's managed robots.txt.
4. ✅ **Social card** designed (`public/og-image.png`, source `scripts/og-image.html`).
5. **Supabase Auth URL config / Google & Facebook OAuth:** apex domain only (unchanged from the rebrand notes).
6. **Email sender domain (DKIM/SPF)** for `@thefluencytalks.com`.
7. **Analytics:** add a privacy-friendly one (Cloudflare Web Analytics is free and cookieless) to see which pages and searches bring sign-ups.
8. **Backlinks/mentions:** see §4.6.
