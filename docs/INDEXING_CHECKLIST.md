# Indexing checklist: what to submit, where, and in what order

Everything here is for `https://thefluencytalks.com` (the apex domain; `www` should redirect to it).
The list below is **generated from the real sitemap** (`dist/sitemap.xml`, built by `scripts/prerender.mjs`); 50 URLs at the time of writing.
If this file and the sitemap ever disagree, the sitemap is right. Re-check with:

```bash
npm run build && npm run check:seo      # fails if a page lacks a title, description, canonical, a single H1, or is blocked
grep -o '<loc>[^<]*</loc>' dist/sitemap.xml
```

## The short version

1. **Submit one thing: the sitemap** (`https://thefluencytalks.com/sitemap.xml`) in Google Search Console and Bing Webmaster Tools. It lists every page below, and Google and Bing find the rest by following links.
2. **Then use "Request indexing" on about ten pages** (the *Day 1* list below). It speeds up the first crawl. It is not required for the other pages, and Google limits how many you can request per day.
3. **Do not submit anything else.** Not login, sign-up, app screens, or profiles (see "Never submit").

## Every URL that should be indexed (50)

### Core pages (7)

| URL |
|---|
| `https://thefluencytalks.com/` |
| `https://thefluencytalks.com/languages` |
| `https://thefluencytalks.com/blog` |
| `https://thefluencytalks.com/about` |
| `https://thefluencytalks.com/faq` |
| `https://thefluencytalks.com/privacy` |
| `https://thefluencytalks.com/terms` |
| `https://thefluencytalks.com/data-deletion` |

### Blog articles (3)

| URL |
|---|
| `https://thefluencytalks.com/blog/corrections-from-native-speakers` |
| `https://thefluencytalks.com/blog/find-a-language-exchange-partner` |
| `https://thefluencytalks.com/blog/what-is-a-language-exchange` |

### Language pages (40)

| URL |
|---|
| `https://thefluencytalks.com/languages/swahili` |
| `https://thefluencytalks.com/languages/amharic` |
| `https://thefluencytalks.com/languages/somali` |
| `https://thefluencytalks.com/languages/yoruba` |
| `https://thefluencytalks.com/languages/igbo` |
| `https://thefluencytalks.com/languages/hausa` |
| `https://thefluencytalks.com/languages/zulu` |
| `https://thefluencytalks.com/languages/kinyarwanda` |
| `https://thefluencytalks.com/languages/english` |
| `https://thefluencytalks.com/languages/french` |
| `https://thefluencytalks.com/languages/spanish` |
| `https://thefluencytalks.com/languages/portuguese` |
| `https://thefluencytalks.com/languages/german` |
| `https://thefluencytalks.com/languages/italian` |
| `https://thefluencytalks.com/languages/dutch` |
| `https://thefluencytalks.com/languages/polish` |
| `https://thefluencytalks.com/languages/ukrainian` |
| `https://thefluencytalks.com/languages/russian` |
| `https://thefluencytalks.com/languages/greek` |
| `https://thefluencytalks.com/languages/swedish` |
| `https://thefluencytalks.com/languages/czech` |
| `https://thefluencytalks.com/languages/romanian` |
| `https://thefluencytalks.com/languages/arabic` |
| `https://thefluencytalks.com/languages/hebrew` |
| `https://thefluencytalks.com/languages/persian` |
| `https://thefluencytalks.com/languages/turkish` |
| `https://thefluencytalks.com/languages/chinese` |
| `https://thefluencytalks.com/languages/cantonese` |
| `https://thefluencytalks.com/languages/japanese` |
| `https://thefluencytalks.com/languages/korean` |
| `https://thefluencytalks.com/languages/vietnamese` |
| `https://thefluencytalks.com/languages/thai` |
| `https://thefluencytalks.com/languages/indonesian` |
| `https://thefluencytalks.com/languages/malay` |
| `https://thefluencytalks.com/languages/tagalog` |
| `https://thefluencytalks.com/languages/hindi` |
| `https://thefluencytalks.com/languages/urdu` |
| `https://thefluencytalks.com/languages/bengali` |
| `https://thefluencytalks.com/languages/tamil` |
| `https://thefluencytalks.com/languages/punjabi` |

## What to request manually, in order

Open Search Console, paste the URL into the bar at the top (URL Inspection), click **Test live URL**, check the screenshot shows the real page, then **Request indexing**.

| Day | Request indexing for |
|---|---|
| **Day 1** (10) | `/`, `/languages`, `/languages/vietnamese`, `/languages/swahili`, `/languages/english`, `/blog`, the three `/blog/...` articles, `/about` |
| **Day 2** | `/languages/french`, `/languages/spanish`, `/languages/japanese`, `/languages/arabic`, `/languages/chinese`, `/languages/korean`, `/languages/german`, `/languages/portuguese`, `/privacy`, `/terms` |
| **After that** | Nothing. The sitemap covers the rest. Only request a page again after you change it a lot, or when you publish a new article. |

Start with Vietnamese, Swahili and English because they are the languages your project names first; start with the blog because it is where search traffic actually comes from.

## Never submit (and how each is kept out)

| URL | How it is kept out of search |
|---|---|
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding` | `X-Robots-Tag: noindex` header (`public/_headers`) **and** a `noindex` tag set by the page. **Not** blocked in `robots.txt`, because Google can only obey a `noindex` it is allowed to read. |
| `/home`, `/search`, `/messages/...`, `/profile/...`, `/u/<username>`, `/settings`, `/learning`, `/library/...`, `/partners`, `/bounty-queue`, `/points-history`, `/admin` | `Disallow` in `public/robots.txt`, and they need a login anyway |
| Any URL with `?utm_...`, `?ref=...` | The page's `<link rel="canonical">` points at the clean URL |

User profiles, chats, phrasebooks and corrections are private and must stay out of search. See `PUBLIC_CONTENT_SEO.md` for how content that members choose to publish can be searchable.

## One-time setup

### Google Search Console (free)
Follow `GOOGLE_SEARCH_CONSOLE.md` (add a **Domain** property, verify with a DNS TXT record in Cloudflare, submit `sitemap.xml`).

### Bing Webmaster Tools (free)
1. Go to https://www.bing.com/webmasters and choose **Import from Google Search Console**. It copies the site and its sitemap in one click.
2. Check **Sitemaps** shows `sitemap.xml` as successful.
3. Bing is also where Microsoft Copilot and several AI search tools get their web results, so do not skip it.

### Instant notification for Bing and others (optional): IndexNow
Bing, Yandex and a few other engines support IndexNow, a one-line ping that says "this URL changed". **Google does not use it.** If you use Cloudflare, *Caching → Configuration → Crawler Hints* sends these pings for you; turn it on. Otherwise skip it: the sitemap is enough at this size.

### Cloudflare settings that quietly break SEO
| Check | Where | Why |
|---|---|---|
| `www.thefluencytalks.com` redirects (301) to `thefluencytalks.com` | *Rules → Redirect Rules*. `vercel.json` is ignored by Cloudflare | Two versions of every page split your ranking |
| "Block AI bots" / "AI Labyrinth" are **off** | *Security → Bots* | Cloudflare blocks AI crawlers before they read `robots.txt` |
| The live `https://thefluencytalks.com/robots.txt` equals `public/robots.txt` | open it in a browser | Cloudflare's *managed robots.txt* can add rules in front of yours |
| `https://thefluencytalks.com/sitemap.xml` shows XML, not the app | open it in a browser | If it shows the app, the file is not being served |

### Check the live site once after each deploy
```bash
curl -sI https://thefluencytalks.com/login | grep -i x-robots-tag       # expect: noindex, nofollow
curl -s  https://thefluencytalks.com/robots.txt | head -30
curl -s  https://thefluencytalks.com/languages/vietnamese | grep -o '<title>[^<]*</title>'
curl -sI https://www.thefluencytalks.com/ | grep -i '^location'         # expect: https://thefluencytalks.com/
```
The third command matters: it shows the title *without running JavaScript*, which is what most AI crawlers see.

## After you request indexing
| When | What to look at (Search Console) |
|---|---|
| Days 2 to 14 | *Indexing → Pages*: the Day 1 URLs should move to **Indexed** |
| Weekly | *Performance*: queries with impressions but no clicks mean the title or description needs work |
| Monthly | *Enhancements*: FAQ and Breadcrumbs errors; *Experience → Core Web Vitals* |
| Every new article | Add it to `src/content/blog/`, build, deploy, then request indexing once |

New domains are slow. Indexing in days and ranking in months is normal. "Discovered, currently not indexed" in the first weeks is expected and is solved by internal links and time, not by re-submitting.
