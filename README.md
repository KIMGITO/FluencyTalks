# The Fluency Talks

> Practise a language by talking to people who speak it well, and get corrected right inside the conversation.

**Live site: [thefluencytalks.com](https://thefluencytalks.com)**

The Fluency Talks is a free language exchange web app. You tell it the one language you speak natively and the one you are learning. It shows you native speakers of the language you are learning and people learning the language you speak. A perfect swap ranks first but is never required.

You chat in text, and a qualified partner can correct your sentence where you wrote it. You see the old words in red and the new words in green, and accept or dismiss the change. Accepted corrections go to your phrasebook, and the person who helped earns points.

| At a glance | |
|---|---|
| **Price** | Free. No paid plans. |
| **Languages** | 40 at launch, with levels A1 to C2 |
| **Practice** | One-to-one text chat. No voice or video. |
| **Platform** | Web app, installable to a phone's home screen. Nothing to download. |
| **Age** | 16 or older |
| **Legal regime** | Vietnamese data law ([details](docs/LEGAL_COMPLIANCE.md)) |

## What's in the app

**For members**

- **Partner matching:** a ranked list that explains why each person was suggested.
- **Home feed:** posts and people mixed in one column, mostly posts.
- **Chat:** message requests, realtime messages, replies, reactions, read receipts, typing and online status.
- **Inline corrections:** a word-level diff with a note, which you accept or decline.
- **Phrasebook and translation:** saved phrases, the corrections you received, and your translation history.
- **Earned levels:** your level rises from real activity, and two native speakers can vouch you up to B1.
- **Points and bounties:** start with 100, earn +5 per accepted correction, or spend 50 to ask for urgent help.
- **Community library:** posts that qualified speakers publish and others review, plus a Practice tab where beginners ask for help.
- **Safety:** blocking, reporting, automatic suspension after 5 people report you in 7 days, and full data export and deletion.
- **Notifications:** in-app and web push.

**For staff**

- A separate admin area where every login needs a password and an authenticator code.
- Reports, decisions, people, the blog and FAQ editors, team management, health and logs.
- A switch that pauses the whole app in an incident.

**For visitors**

Prerendered public pages that search engines and AI crawlers can read: the home page, 40 language pages, blog, FAQ, About and legal pages.

The full list, with how each feature works, is in [docs/FEATURES.md](docs/FEATURES.md).

## How it's built

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind driven by one token file, Zustand |
| Backend | Supabase: Postgres, Auth, Realtime, Storage and 5 Edge Functions |
| Hosting | Cloudflare Worker `thefluencytalks` with static assets |
| Rich text | Tiptap, for the staff blog editor |
| Outside services | MyMemory (translation), Unsplash (post images), an S3 Object Lock store (tamper-proof archive) |

Production runs on the Worker, not Cloudflare Pages or Vercel. More in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start

You need Node 22, and Docker with the Supabase CLI if you want a local database.

```bash
npm install
cp .env.example .env        # add your Supabase URL and anon key
npm run dev
```

**Your `.env` probably points at the production database.** To run against the local stack instead, follow [docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Build the app, then prerender the public pages |
| `npm run check` | Type-check and build the client |
| `npm run deploy` | Build and publish the Worker **(production)** |
| `npm run test:unit` | Unit tests for pure helpers |
| `npm run test:auth` | Tests for the sign-in helpers |
| `npm run test:db` | Build a throwaway database and replay the app's flows |
| `npm run test:security` | Real API, Storage and Realtime access checks (local stack only) |
| `npm run test:admin` | Staff accounts and MFA, end to end (local stack only) |
| `npm run check:seo` | What a crawler sees on every public page (after a build) |
| `npm run check:legal` | Published legal text matches its recorded version (after a build) |
| `npm run indexnow` | Ask Bing and others to recrawl (after a deploy) |
| `npm run docs:pdf` | Rebuild the shareable PDF of the project documentation |

## Documentation

**Start with [docs/PROJECT_DOCUMENTATION.md](docs/PROJECT_DOCUMENTATION.md)**, which describes the whole application in one document. A shareable copy is at [docs/The-Fluency-Talks-Project-Documentation.pdf](docs/The-Fluency-Talks-Project-Documentation.pdf).

Each topic also has its own file, listed in the [documentation index](docs/README.md):

| Topic | Files |
|---|---|
| **Product** | [Overview](docs/PRODUCT_OVERVIEW.md) · [Features](docs/FEATURES.md) · [Corrections and bounties](docs/CORRECTIONS_AND_BOUNTIES.md) · [Contribution system](docs/CONTRIBUTION_SYSTEM.md) · [Post type ideas](docs/POST_TYPES_AND_UNLOCKS.md) · [Roadmap and known gaps](docs/ROADMAP.md) · [Original analysis](docs/PRODUCT_ANALYSIS.md) |
| **Engineering** | [Architecture](docs/ARCHITECTURE.md) · [Database](docs/DATABASE.md) · [App-wide rules](docs/APP_WIDE_RULES.md) · [Design system](docs/DESIGN_SYSTEM.md) · [URLs and access](docs/URLS_AND_ACCESS.md) · [Local development](docs/LOCAL_DEVELOPMENT.md) · [Testing](docs/TESTING.md) |
| **Operations** | [Deployment](docs/DEPLOYMENT.md) · [Admin setup and recovery](docs/ADMIN_SETUP.md) · [Security](docs/SECURITY.md) · [Data retention](docs/DATA_RETENTION.md) · [Legal compliance](docs/LEGAL_COMPLIANCE.md) |
| **Growth** | [SEO](docs/SEO.md) · [Indexing checklist](docs/INDEXING_CHECKLIST.md) · [Search Console](docs/GOOGLE_SEARCH_CONSOLE.md) · [AI visibility](docs/AI_VISIBILITY.md) · [Content plan](docs/CONTENT_PLAN.md) · [Public content plan](docs/PUBLIC_CONTENT_SEO.md) |

## Contact

Website: [thefluencytalks.com](https://thefluencytalks.com) · General: info@thefluencytalks.com · Support: support@thefluencytalks.com · Security: security@thefluencytalks.com · Reports: report@thefluencytalks.com
