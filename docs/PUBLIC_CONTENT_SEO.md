# Making content created in the app searchable on the web (the Facebook model)

## Where things stand today

| Content | Who can see it | In Google? |
|---|---|---|
| Community library posts (`contribution_posts`) | Signed-in members only (RLS policy is `to authenticated`) | **No.** `/library` is also blocked in `robots.txt` |
| Profiles (`/u/<username>`) | Signed-in members only | No (blocked, and behind login) |
| Chats, corrections, phrasebooks, points | The people involved | No, and must never be |

So nothing members create is searchable yet. That is correct for private data. The question is how to make **content people choose to publish** findable, as public posts on Facebook are.

## What Facebook actually does (and what to copy)

A public Facebook post is findable because of five things, none of which is magic:
1. **A stable public URL per item** that anyone can open without logging in.
2. **The full content is in the HTML the server sends** (not only drawn by JavaScript afterwards).
3. **It is public because the author chose that**, and private items never get a public URL.
4. **Search engines can discover it**: sitemaps and links from other crawlable pages.
5. **It can be removed**, and when it is, the URL stops working (HTTP 410/404).

Do **not** copy a login wall that shows crawlers more than visitors. Showing different content to Googlebot and to people is cloaking and is penalised. A post that is public should be fully readable by everyone; a "sign up to practise this" box next to it is fine.

## Decide what is public (do this before any code)

| Content | Recommendation | Why |
|---|---|---|
| **Library posts** (phrases, idioms, usage, grammar) | **Make public, with the author's opt-in at posting time** | This is the best fit: short, useful, unique and searchable ("Swahili idiom pole pole ndio mwendo meaning"). It feeds the 40 language pages. |
| **Profiles** | **Keep private. Do not index.** At most, a member-chosen public card showing first name, country and languages | Members can be 16 and 17, and profile pages are thin content that search engines treat as low value anyway. The privacy risk outweighs the traffic. |
| **Chats, corrections, phrasebooks** | **Never public** | Personal data |

Only index adults' content under a display name the member chose, never an email or username unless they opt in. If a member is under 18, do not index their posts at all.

## The build (in the order to do it)

### 1. Database: a safe public view
Do not open the table to the public. Expose a view with only safe columns and only opted-in, non-removed rows. Sketch (untested; write it as a new migration and add a test to `supabase/tests/app_flow.sql`):

```sql
alter table public.contribution_posts
  add column if not exists is_public boolean not null default false;     -- the author's opt-in, set when posting
-- No "removed" column is needed: admin_remove_post() and the author's delete already DELETE the row.

create view public.public_posts with (security_invoker = off) as
  select p.id, p.language_id, p.phrase, p.translation, p.category, p.source_context,
         p.unsplash_image_url, p.created_at, p.updated_at,
         left(pr.display_name, 40) as author_name            -- never email, never username
  from public.contribution_posts p
  join public.profiles pr on pr.id = p.user_id
  where p.is_public
    and pr.status = 'active'
    -- a post with an open report drops out of search at once, before a moderator has looked at it
    and not exists (select 1 from public.reports r where r.post_id = p.id and r.status in ('open', 'reviewing'));
grant select on public.public_posts to anon;
```
Index only posts that pass a quality gate (for example translation present and phrase length at least a few characters). Posts that fail still render for people but carry `noindex`.

### 2. Server-rendered pages for each post
The site is a static single-page app on a Cloudflare Worker. Static prerendering cannot handle a post created five minutes ago, so render these URLs **on the server at request time** in `worker/index.ts`, which already does this for the blog. Add the paths to `run_worker_first` in `wrangler.toml`. The Worker should:
1. reads the post from `public_posts` using the Supabase anon key,
2. returns a complete HTML page (title, description, canonical, Open Graph tags, JSON-LD, the post text),
3. returns a real **404 status for an unknown or deleted post** (the single-page app cannot do that: it answers 200 for every URL). Deleted posts are hard-deleted today, so they simply stop existing; if you later want the slightly faster 410, keep a small `removed_posts(id)` table,
4. sets `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` so Cloudflare caches it.

URL shape: `https://thefluencytalks.com/phrases/<language>/<slug>-<id>` (readable, stable, language in the path). Redirect to the canonical form if the slug is wrong. Keep `/library` (signed-in, noindex) separate from `/phrases` (public, indexable).

### 3. A dynamic sitemap
Add a second sitemap generated by the Worker (`/sitemap-phrases.xml`), listing public, indexable posts with `<lastmod>`, up to 50,000 URLs per file. Turn `sitemap.xml` into a **sitemap index** pointing at the static one and the phrases one. Submit the index once in Search Console and Bing; they re-read it on their own afterwards.

### 4. Make the posts discoverable by links
A sitemap alone is weak. Crawlers also need ordinary `<a href>` links, in the HTML:
- each language page (`/languages/vietnamese`) lists the latest and best phrases for that language, with links,
- paginated, crawlable index pages (`/phrases/vietnamese?page=2`), real links, not infinite scroll,
- each post links to related posts and back to its language page.

### 5. Quality, moderation and removal
- `rel="ugc nofollow"` on any link a member typed.
- Reported posts drop out of the sitemap immediately (the view above hides them while a report is open). Admin removal (`admin_remove_post`) and the author's delete already remove the row, so the URL then returns 404. `report_post` and the moderator queue already exist; this reuses them.
- Deleting an account deletes its posts. Update the **Delete my data** page to say so, and say that search engines and AI tools may keep a cached copy for a while after deletion. For an urgent removal use Search Console's Removals tool.
- Add a clear sentence at the moment of posting: "Public posts can be found on Google and shared. Your display name is shown." The checkbox is the opt-in.

### 6. Sharing (the other half of "like Facebook")
Each public post needs its own `og:title`, `og:description` and `og:image` so a link pasted into WhatsApp, Facebook or X shows a proper card. Add a Share button that uses the browser's Web Share API with a copy-link fallback.

### 7. Measure
Add a Search Console **URL-prefix property** for `https://thefluencytalks.com/phrases/` to see how this section performs on its own. Watch "Crawled, currently not indexed": it means the posts are too thin; improve the quality gate instead of resubmitting.

## Honest expectations
- Google indexes a small fraction of user-generated pages from a new domain at first. Quality and links decide, not volume. A few hundred good phrase pages beat thousands of near-empty ones.
- Each public post is a legal and moderation responsibility. Do steps 1 and 5 before step 2.
- This is two to three days of work for one person, plus a migration with tests. It is not started.
