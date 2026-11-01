# Google Search Console: setup and routine for `thefluencytalks.com`

Search Console is free. It tells Google your site exists, shows which
searches bring people to it, and warns you when pages can't be indexed.
Go to **https://search.google.com/search-console** and sign in with the
Google account that should own the site (use a shared/team account, not a
personal one, so access survives team changes).

---

## Step 1: Add the property (do once)

1. Click **Add property** → choose **Domain** (left box) → type
   `thefluencytalks.com` (no `https://`, no `www`).
   A *Domain* property covers `https`, `http`, `www` and every subdomain at once.
2. Google shows a **TXT record** like `google-site-verification=abc123…`. Copy it.
3. In **Cloudflare → your domain → DNS → Records → Add record**:
   - Type: `TXT`  · Name: `@`  · Content: the value you copied · TTL: Auto
4. Back in Search Console click **Verify**. If it fails, wait 10–30 minutes and try again.
   Leave the TXT record in place forever; removing it un-verifies the site.

> Optional: also add a **URL-prefix** property for `https://thefluencytalks.com/`.
> Some tools (e.g. the Bing import) work more smoothly with one.

---

## Step 2: Submit the sitemap

1. Left menu → **Sitemaps**.
2. Under *Add a new sitemap* type `sitemap.xml` → **Submit**.
3. Status should become **Success** with the number of discovered URLs
   (currently 4: `/`, `/privacy`, `/terms`, `/data-deletion`).
   If it says *Couldn't fetch*, open `https://thefluencytalks.com/sitemap.xml`
   in a browser. It must show XML, not the app.

Resubmit only when you add new sections (blog, languages); Google re-reads
the sitemap by itself after that.

---

## Step 3: Request indexing of the key pages

1. Paste `https://thefluencytalks.com/` into the **search bar at the top** (URL Inspection).
2. Click **Test live URL** → then **View tested page → Screenshot / HTML**.
   Check the screenshot shows the real home page and the HTML contains the
   headline text. If it's blank, Google can't render the app (see SEO.md §5a).
3. Click **Request indexing**.
4. Repeat for `/privacy`, `/terms`, and later for `/blog` and each new article.
   (There's a daily limit of ~10 requests; the sitemap covers the rest.)

---

## Step 4: Check settings that block indexing by mistake

- **URL Inspection** of `/login` should say *Excluded by 'noindex' tag*. That's correct.
- **URL Inspection** of `/home` should say *Blocked by robots.txt*. That's correct.
- **Settings → robots.txt** report: should show the file fetched successfully
  with the `Disallow` lines from `public/robots.txt`.
- Inspect `https://www.thefluencytalks.com/`. It should redirect (301) to the
  apex. If not, add the Cloudflare redirect rule (SEO.md §7).

---

## Step 5: Link other Google tools (optional, 5 minutes)

- **Settings → Associations**: link Google Analytics if you add it later.
- **Bing Webmaster Tools** (https://www.bing.com/webmasters): *Import from
  Google Search Console*. One click copies the site and sitemap. This is
  how ChatGPT search and Microsoft Copilot find you.

---

## What to check and when

### Week 1 after launch (daily, 2 minutes)
- **Pages** report (left menu → *Indexing → Pages*): are `/`, `/privacy`, `/terms` moving to **Indexed**? First indexing usually takes 2–14 days.

### Every week (10 minutes)
| Report | Where | What to look for | What to do |
|---|---|---|---|
| **Performance** | *Performance → Search results* | Queries, clicks, impressions, CTR, average position | Note queries where you get impressions but few clicks → improve that page's title/description (SEO.md §3). Queries you don't have a page for → blog ideas |
| **Pages** | *Indexing → Pages* | "Why pages aren't indexed" list | See the table below |
| **Core Web Vitals** | *Experience → Core Web Vitals* | Mobile URLs marked *Poor* / *Needs improvement* | Fix LCP (big images), CLS (layout jumps). Test in PageSpeed Insights |

### Every month
- **Enhancements → FAQ / Breadcrumbs / Articles**: structured data errors. Fix and click *Validate fix*.
- **Links** report: which sites link to you; which internal pages get the most links.
- Ask AI assistants the test questions in SEO.md §4.7 and compare.

### Every time you publish an article
1. Add it to the sitemap (automatic once the build generates it).
2. URL Inspection → **Request indexing**.
3. Link to it from at least one older article and from `/blog`.

---

## Common "not indexed" reasons and what they mean here

| Message | Meaning for this site | Action |
|---|---|---|
| Excluded by 'noindex' tag | Login / sign-up / 404 pages | ✅ Expected, ignore |
| Blocked by robots.txt | App routes (`/home`, `/messages`…) | ✅ Expected, ignore |
| Page with redirect | `www` or old domain URLs | ✅ Expected if they redirect to the apex |
| Alternate page with proper canonical tag | Same page reached by another URL (e.g. `?ref=`) | ✅ Expected |
| Discovered – currently not indexed | Google knows the URL but hasn't crawled it yet | Wait; add internal links to it; request indexing |
| Crawled – currently not indexed | Google saw it and judged it thin/low value | Add more useful text, internal links; make sure it's pre-rendered |
| Soft 404 | Page returned 200 but looks empty or like an error | Usually the SPA shell rendering blank. Pre-render the page, or check that the route exists |
| Duplicate without user-selected canonical | Two URLs with the same content | Make sure `useSeo({ path })` is set on that page |
| Not found (404) | A URL in the sitemap or linked from somewhere doesn't exist | Remove it from the sitemap or add a redirect in `public/_redirects` |

---

## Don'ts

- Don't submit app or auth URLs, or individual user profiles.
- Don't change URLs of indexed pages without a 301 redirect (`public/_redirects`).
- Don't remove the DNS TXT verification record.
- Don't use the **Removals** tool unless a page must disappear from Google urgently (it's temporary, ~6 months).
- Don't panic over day-to-day ranking swings; look at 28-day trends.
