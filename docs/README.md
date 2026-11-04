# Documentation index

Every document about [The Fluency Talks](https://thefluencytalks.com), by what it explains.

**Want the whole picture?** Read [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md), or share the [PDF version](The-Fluency-Talks-Project-Documentation.pdf). To rebuild the PDF after changing that file, run `npm run docs:pdf`.

## Product: what the app is and does

| Document | What it explains |
|---|---|
| [PRODUCT_OVERVIEW.md](PRODUCT_OVERVIEW.md) | What it is, who it's for, principles, and the facts to keep consistent |
| [FEATURES.md](FEATURES.md) | Every feature: what it does, how it helps, how it works, what it depends on |
| [CORRECTIONS_AND_BOUNTIES.md](CORRECTIONS_AND_BOUNTIES.md) | The two correction systems, bounty rules and state machines |
| [CONTRIBUTION_SYSTEM.md](CONTRIBUTION_SYSTEM.md) | Post types, corrections, levels and accountability: the rules, and what can happen |
| [POST_TYPES_AND_UNLOCKS.md](POST_TYPES_AND_UNLOCKS.md) | Post type ideas not built, and what replaced the original plan |
| [ROADMAP.md](ROADMAP.md) | What's built, what isn't, known gaps, decisions made and still open |
| [PRODUCT_ANALYSIS.md](PRODUCT_ANALYSIS.md) | The original analysis and plan, kept as a historical record |

## Engineering: how it's built

| Document | What it explains |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | Stack, folder map, request flow, Worker, Edge Functions, scripts, portability |
| [DATABASE.md](DATABASE.md) | Migrations, tables, rules for changing the database, limits, scheduled jobs |
| [APP_WIDE_RULES.md](APP_WIDE_RULES.md) | Errors, validation, data checks and phone keyboard behaviour on every screen |
| [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) | Tokens, responsive layout, public and in-app design, colour rules, Tailwind traps |
| [URLS_AND_ACCESS.md](URLS_AND_ACCESS.md) | Every route and who can reach it |
| [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) | Running the app and a local Supabase stack, test users |
| [TESTING.md](TESTING.md) | What to run and when, what CI covers, common traps |

## Operations: how to run it

| Document | What it explains |
|---|---|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Deploying, first-time setup, environment variables, domains, push, history repair |
| [ADMIN_SETUP.md](ADMIN_SETUP.md) | Creating the super admin, MFA, inviting staff, recovery, what staff can see |
| [SECURITY.md](SECURITY.md) | Pausing the app, rate limits, data access, images, incident steps |
| [DATA_RETENTION.md](DATA_RETENTION.md) | What we keep, for how long, archiving, tamper protection, legal holds, member requests |
| [LEGAL_COMPLIANCE.md](LEGAL_COMPLIANCE.md) | The Vietnamese legal regime, consent versions, open legal items, sources |

## Growth: how people find it

| Document | What it explains |
|---|---|
| [SEO.md](SEO.md) | Indexing rules, titles, structured data, prerendering, the on-page checklist |
| [INDEXING_CHECKLIST.md](INDEXING_CHECKLIST.md) | Which URLs to submit, in what order, and the Cloudflare settings that can break SEO |
| [GOOGLE_SEARCH_CONSOLE.md](GOOGLE_SEARCH_CONSOLE.md) | Search Console setup and routine |
| [AI_VISIBILITY.md](AI_VISIBILITY.md) | How ChatGPT, Gemini, Claude, Perplexity and AI Overviews find a site |
| [CONTENT_PLAN.md](CONTENT_PLAN.md) | The fact sheet, keyword clusters, page order and article calendar |
| [PUBLIC_CONTENT_SEO.md](PUBLIC_CONTENT_SEO.md) | A plan for making opted-in member posts searchable. Not built |

## Where the old files went

Reorganised on 3 November 2026.

| Old file | New home |
|---|---|
| `README.md` (long version) | Short [README](../README.md). Details moved to Architecture, Database, Design system, Features, Deployment, Testing and Roadmap |
| `features.md`, `FEATURES_DESCRIPTION.md` | Merged into [FEATURES.md](FEATURES.md) |
| `LOCAL_SUPABASE_DEV.md` | [LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md) |
| `docs/DEPLOY_REVIEW_AND_PUSH.md` | [DEPLOYMENT.md](DEPLOYMENT.md) |
| `docs/LANDING_DESIGN.md` | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |
| `docs/URL_ACCESS_ADMIN.md` | [URLS_AND_ACCESS.md](URLS_AND_ACCESS.md) |
| Legal sections of `docs/DATA_RETENTION.md` | [LEGAL_COMPLIANCE.md](LEGAL_COMPLIANCE.md) |

## Keeping these accurate

- The code is the truth. If a document and the code disagree, fix the document.
- When a feature changes, update [FEATURES.md](FEATURES.md), the [fact sheet](CONTENT_PLAN.md#1-fact-sheet-what-we-can-and-cant-claim) if a public fact changed, and [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md), then run `npm run docs:pdf`.
- Always link to `https://thefluencytalks.com`, and write the name as **The Fluency Talks**.
