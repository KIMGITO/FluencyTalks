# Being found in AI answers (ChatGPT, Gemini, Claude, Perplexity, Copilot, Google AI Overviews)

This is the honest version. Parts of it contradict popular advice, and that is deliberate: it is based on what
the AI companies themselves publish. Checked against their documentation when this was written; vendors rename
crawlers, so re-check the links in "Sources" before you rely on a name.

## 1. How each assistant finds a site like ours

| Assistant | Where its web answers come from | What controls it | What you must do |
|---|---|---|---|
| **Google AI Overviews and AI Mode** | Google's own search index. There is no separate AI index and no separate submission. | A page must be **indexed** and **eligible to show a snippet**. Google states there are no extra requirements and no special markup. | Get indexed (see `INDEXING_CHECKLIST.md`); never use `nosnippet` on public pages. |
| **ChatGPT search** | OpenAI's search crawler `OAI-SearchBot` (and other sources). | `robots.txt` token `OAI-SearchBot`. Changes take about 24 hours to apply. | Do not block `OAI-SearchBot`. Blocking `GPTBot` (model training) does **not** remove you from ChatGPT search. |
| **ChatGPT when a user pastes or asks for a URL** | `ChatGPT-User` fetches that page live. | OpenAI says robots.txt rules may not apply to user-initiated fetches. | Make sure public pages load fast and as plain HTML. |
| **Claude** | Anthropic's crawlers (`ClaudeBot` for training, `Claude-SearchBot` for search, `Claude-User` for user requests) and web search results. | Separate `robots.txt` tokens for each. | Do not block them. |
| **Perplexity** | `PerplexityBot` (search index) and `Perplexity-User` (user requests). | `robots.txt`; the user fetcher generally ignores it. | Do not block them. |
| **Microsoft Copilot, Bing** | Bing's index. | Bing Webmaster Tools, `Bingbot`. | Import the site into Bing Webmaster Tools. |

`public/robots.txt` allows all of these (it has a single `User-agent: *` group, which they all obey). Do not add an
empty `User-agent: GPTBot` group "to be explicit": a crawler with its own group **ignores** the `*` group and
would then ignore your `Disallow` lines for the app screens.

## 2. What does and does not matter

**Matters (all true for Google and for the other assistants):**
1. **The page is crawlable and its text is in the HTML.** This site prerenders its public pages (`scripts/prerender.mjs`), so the title, description and about 1,100 words of the home page are readable with JavaScript off. Many AI crawlers do not run JavaScript. Verify any time with `curl -s https://thefluencytalks.com/ | grep -o '<h1[^>]*>'`.
2. **The page is indexed.** Sitemap, internal links, Search Console, Bing. See `INDEXING_CHECKLIST.md`.
3. **The page states facts plainly and consistently.** Assistants quote sentences like "The Fluency Talks is a free language exchange where native speakers correct your messages inside the chat." Keep the numbers identical everywhere: 40 languages, free with no paid plans, levels A1 to C2, 100 starting points, +5 per accepted correction, a bounty costs 50 points and is refunded after 48 hours without an accepted answer.
4. **Other sites mention you.** This is the lever most under-used by small projects. A new brand with no mentions is rarely cited, however good its pages are. See section 3.
5. **The pages are genuinely useful.** Specific examples (a real correction, a real phrase) beat generic text. The blog and the 40 language pages are your best material.

**Does not matter (do not spend time here):**
- **`llms.txt`.** Google says its Search ignores it, and that it neither helps nor harms. There is no solid evidence that the main AI crawlers use it either. It is harmless and cheap (`public/llms.txt` exists), so keep it accurate, but it will not get you cited.
- **Special "AI schema", "chunking" your text into tiny pieces, or rewriting pages for AI.** Google says none is needed. Normal structured data (FAQ, Article, Breadcrumb) is fine for rich results, but is not an AI switch.
- **`Google-Extended` in robots.txt.** It controls whether Google uses content for Gemini training and grounding. It does **not** switch Google Search AI Overviews on or off.
- **Buying or faking mentions.** Google names this as something to ignore, and fake mentions can hurt.

## 3. Getting mentioned (the part that actually moves the needle)

Do these over the first three months. Each mention should use the exact name **The Fluency Talks** and link to `https://thefluencytalks.com/`.

| Where | What to post | Notes |
|---|---|---|
| Your university | A project page or showcase entry | A `.ac.ke` or other institutional link is a strong, free trust signal |
| GitHub | A README with a one-line description and the link; set the repo "Website" field | Already a public repo, so this is a 5-minute job |
| LinkedIn / X / Facebook | A launch post per team member | Link to a language page (for example `/languages/swahili`), not only the home page |
| Reddit (r/languagelearning, r/Swahili, r/vietnamese, r/LearnVietnamese) | A helpful post or answer, not an advert; read each sub's self-promotion rule first | One honest post beats ten spammy ones; moderators remove ads |
| Product Hunt, AlternativeTo, language-learning directories | A listing | Free; use the same description everywhere |
| Language communities and student groups | A short demo | Real users create real mentions |
| Wikipedia | Do **not** add the site | It is removed as spam unless independent sources already cover you |

## 4. Add the entity signals (small, free)

In `index.html`, the `Organization` JSON-LD can list your real profiles in `sameAs` once they exist, so assistants can connect
"The Fluency Talks" on your site with the same name elsewhere:

```json
"sameAs": ["https://github.com/KIMGITO/FluencyTalks", "https://www.linkedin.com/company/…", "https://x.com/…"]
```
Only list profiles that exist and carry the same name. Keep the name `The Fluency Talks` identical (not "FluencyTalks" or "Fluency Talk") in titles, headings and mentions.

## 5. Measure it

| How often | Do this |
|---|---|
| Monthly | Ask ChatGPT, Gemini, Claude and Perplexity: "free language exchange app with corrections", "where can I practise Vietnamese with native speakers", "what is The Fluency Talks". Write down what each says and which sites it cites, in a spreadsheet. |
| Monthly | Cloudflare dashboard → Analytics: look for requests from `OAI-SearchBot`, `GPTBot`, `ClaudeBot`, `PerplexityBot`. If one never appears after two months, check it is not being blocked (section 1) and that the site is indexed in Bing. |
| Weekly | Search Console → Performance: impressions grow before clicks do. |

Expect weeks to months for a new domain. If assistants answer "I don't have information about that" for the exact brand name, it usually means
"not enough independent sources yet", which section 3 fixes, not a technical fault.

## Sources (re-check; they change)
- Google, *AI features and your website*: https://developers.google.com/search/docs/appearance/ai-features
- OpenAI, *Overview of OpenAI crawlers*: https://developers.openai.com/docs/gptbot
- Anthropic and Perplexity: search their help centres for "crawler" or "bots" and copy the exact user-agent names from there (not verified here, so check before relying on the names in section 1).
