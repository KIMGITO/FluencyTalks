# SEO — The Fluency Talks (`thefluencytalks.com`)

Single source of truth: **`src/lib/site.ts`** (`BRAND`, `SITE_URL`, `TAGLINE`,
`DEFAULT_TITLE`, `DEFAULT_DESCRIPTION`, `OG_IMAGE`). Every SEO surface below
derives from it, so the next rebrand is a one-file change.

## What changed in this rebrand (FluencyTalks → The Fluency Talks)

| Area | File(s) | Change |
|---|---|---|
| Brand constant | `src/lib/site.ts` (new), `src/theme/theme.js` (`NAME`), `src/theme/tokens.ts` | `"The Fluency Talks"` everywhere; `NAME` drives footer tagline |
| Logo | `src/components/ui/Logo.tsx` | Renders "The Fluency…" text, `alt="The Fluency Talks Logo"`, `aria-label="The Fluency Talks Home"`; accepts `light` prop for dark footers |
| Page `<title>` / meta / canonical / OG / Twitter | `index.html`, `src/hooks/useSeo.ts` (new) | All point at `https://thefluencytalks.com/`; every public route sets its own title + canonical via `useSeo` |
| Structured data | `index.html` (WebSite + WebApplication + Organization), `src/components/landing/Faq.jsx` (FAQPage) | `name: "The Fluency Talks"`, `alternateName: ["Fluency Talks","FluencyTalks"]` keeps old-name traffic |
| `robots.txt` / `sitemap.xml` | `public/robots.txt`, `public/sitemap.xml` (new) | Index `/`, `/privacy`, `/terms`, `/data-deletion`; disallow all app/auth routes; sitemap URL uses apex domain |
| PWA manifest | `public/manifest.webmanifest` (new), linked from `index.html` | `name: "The Fluency Talks"`, `start_url: "/"` |
| Social card | `public/og-image.png` (new, 1200×630) | Referenced by `og:image` + `twitter:image`. **Replace with a designed card before launch** — current one is a generated placeholder |
| Domain + redirects | `vercel.json`, `src/store/authStore.ts` (`PROD_ORIGIN`), `supabase/config.toml` | Apex `thefluencytalks.com` canonical; `www.*` + legacy `fluencytalks.com` 301 → apex; auth redirects use apex origin |
| UI copy | Footer, FAQ, Header aria-label, Search, Settings, Login, 404, Terms | All user-visible strings use `BRAND` (`"The Fluency Talks"`); data-export filename `the-fluency-talks-data.json` |
| Docs | `README.md` | Brand + Supabase/Vercel domain instructions updated |

## Per-page SEO map (via `useSeo`)

| Route | Title | Indexed? |
|---|---|---|
| `/` | `The Fluency Talks, Practice Languages…` (default) | ✅ |
| `/privacy` | `Privacy Policy \| The Fluency Talks` | ✅ |
| `/terms` | `Terms of Service \| The Fluency Talks` | ✅ |
| `/data-deletion` | `Delete my data \| The Fluency Talks` | ✅ (low priority) |
| `/login`, `/signup`, `/forgot-password`, `/reset-password` | `… \| The Fluency Talks` | ❌ `noindex` |
| `/404` | `Page not found` | ❌ `noindex` |
| All app routes (`/home`, `/search`, …) | default (untouched) | ❌ blocked in `robots.txt` |

`useSeo` sets `document.title`, `description`, `og:*`, `twitter:*`,
`canonical`, and `robots` (`noindex, nofollow` when `noIndex: true`).

## Still to do (outside the codebase)

1. **Replace `public/og-image.png`** with a designed 1200×630 card (logo + tagline on brand background). Re-deploy after.
2. **Vercel → Domains:** add `thefluencytalks.com` (apex, A-record `76.76.21.21` or ANAME) + `www.thefluencytalks.com`; set apex as primary. `vercel.json` already 301s `www` → apex.
3. **Supabase Dashboard → Authentication → URL Configuration:** Site URL `https://thefluencytalks.com`; add `https://thefluencytalks.com/**` to Redirect URLs (keep `http://localhost:5173/**` for dev). Remove the old `fluency-talks.vercel.app` entry once DNS is live.
4. **Google OAuth:** authorized JavaScript origin `https://thefluencytalks.com`; redirect URI stays `https://<project-ref>.supabase.co/auth/v1/callback`.
5. **Google Search Console:** add the apex property, submit `https://thefluencytalks.com/sitemap.xml`, request indexing for `/`. Add 301s if the old domain ever served traffic.
6. **Apple / Facebook login:** update Return URLs / Valid OAuth Redirect URIs to the new domain if configured with domain restrictions.
7. **Transactional email (Supabase):** confirm sender domain / DKIM for `@thefluencytalks.com` so auth emails don't land in spam.
8. **Favicon:** `public/favicon.png` still shows the old mark — regenerate with the new wordmark if the logo changed, keeping the same filename.
9. **Analytics:** add Plausible / PostHog / Vercel Analytics *after* consent wording is in Privacy (currently no tracker installed).
10. **Ongoing:** one `<h1>` per route (landing Hero already has it); keep URLs stable; never index app routes; run Lighthouse SEO + Rich Results Test before launch.
