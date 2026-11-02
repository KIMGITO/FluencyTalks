# Public pages: design notes

Every public page (home, privacy, terms, delete my data, log in, sign up, forgot and reset password, 404) uses one shell:
`PublicShell` in `src/components/landing/` gives the same header, footer and look. All styles live in `src/styles/landing.css`,
scoped under `.lp`, so nothing leaks into the app. The mood is a university prospectus rather than a software template:
a serif for headlines, hairline rules, square-ish corners, photos pinned at slight angles, layouts that do not repeat.
The reference was the Open University of Kenya site (structure and tone only; no text or images were copied).

## Colour: 60-30-10
| Share | Colour | Used for |
|---|---|---|
| 60% | **Paper** (warm off-white) | page background, cards, whitespace, reading text |
| 30% | **Deep indigo** | mobile menu, the "what you get" band, the greeting ticker, the speaker card, the closing call to action, the footer, active section chips |
| 10% (a ceiling) | **Coral** | primary buttons, link underlines, the active-nav mark, the "40 languages" badge, focus rings. Nothing else. |

Measured on the rendered landing page: paper 62 to 68%, deep 26 to 28%, coral 0.4 to 1.4%. Coral is never used as text on paper
(it fails contrast); text on coral is always deep indigo. Dark mode swaps paper and deep and keeps the coral.

## Type
Newsreader for headlines, Source Sans 3 for body (both from Google Fonts, set in `src/theme/tokens.ts`, so the app uses them too).
Reading text has a line height of 1.6; large headlines are tighter on purpose.

## Mobile first
- Hero: a large headline with a hand-drawn underline, two photos pinned at angles, and a badge. Below it, a slow ticker of greetings.
- "What you get" is a swipe carousel of five cards of different widths and heights; on a laptop it becomes an uneven grid.
- The three steps are a numbered timeline on a phone and staggered columns on a laptop.
- The menu is a full-screen deep sheet with large serif links.
- A slim "Start free" bar appears once the hero button has scrolled away, and hides at the footer.
- Tap targets are at least 44px; no page scrolls sideways at 360px.

## Motion
Cards lift 4px with a soft shadow and buttons 2px on hover; sections fade in once on scroll; the nav shows which section you are reading.
With `prefers-reduced-motion`, all transitions and animation are off and the ticker becomes static. Content is visible without JavaScript.

## Legal pages
Privacy, terms and data deletion are long documents with a contents list (a sticky column on a laptop, a strip of chips on a phone), not slides.
Their text was corrected to match the app: no "audio clips" or "recordings" (there are none), deletion is immediate (not a 30-day purge),
and the age matches the sign-up checkbox (16). **Please have the wording reviewed before launch:** the "GDPR and CCPA principles" sentence in
`Privacy.tsx` is a legal claim only you can confirm, and the consent kind stored in the database is still named `age_18`.
The old "delete my data" form was fake (it only pretended to send an email); the page now deletes the account for real when you are logged in.

## Content rules
Every claim describes something the app does. Invented testimonials, made-up "online now" counts, a Premium plan, voice or video, and streaks were removed.
Photos are Unsplash images, decorative (empty alt text) and credited in the footer; change them in `src/components/landing/Hero.jsx`.

---

# Inside the app (signed-in screens)

The signed-in screens share the public pages' look. It comes from the design tokens (`src/theme/tokens.ts`) and the shared components
(`src/components/ui/`), so a new screen picks it up without extra work.

| Part | Style |
|---|---|
| Page background, cards | Paper background; white cards with a hairline border and 4px corners; flat shadows |
| Primary button | **Coral** with deep-indigo text (`<Button>`, or `buttonClass()` for links). One per screen. Lifts 2px on hover. |
| Everything else | Outlined buttons (`secondary`), plain text (`ghost`), outlined red (`danger`) |
| Inputs, selects, text areas | White, hairline border, 4px corners, coral focus ring, labels in ink |
| Tabs | Underlined, the open tab gets a coral rule (`Tabs`, `tabClass`, `tabsClass`) |
| Tags (levels, categories, status) | Small outlined squares (`.ft-tag`); "native" is filled deep indigo |
| Navigation | Dark indigo sidebar on a laptop, dark indigo tab bar on a phone; the current page has a coral mark |
| Chat | Sent bubbles deep indigo, received paper; corrections show red and green |
| Clickable cards | `.ft-lift`: rise 4px with a soft shadow |
| Page titles | Serif (Newsreader), sentence case |

**A trap in this project's Tailwind setup:** `tailwind.config.ts` replaces the default palette with the tokens, so classes such as
`text-white`, `bg-black/40`, `bg-indigo-100` or `text-aqua` generate **nothing** and the text silently falls back to the default colour.
Use token colours only (`text-on-deep`, `bg-deep`, `text-on-brand`, `bg-brand-soft`, ...). To see which exist, read `themes.light` in `tokens.ts`.


---

# Checks that keep the design honest

Three automated checks run against the built site and the app (they were used to fix the drift described below):

| Check | What it enforces |
|---|---|
| `npm run check:seo` | Every public page: one unique title (60 characters or fewer), a description, a canonical URL, one `<h1>`, social tags, valid structured data, alt text, no broken internal links, and `robots.txt` blocking only what it should |
| Contrast audit (in a browser, light and dark) | Every piece of text meets WCAG AA (4.5:1, or 3:1 for large text). Result at the last run: 11/11 public pages in light, 7/7 in dark, 13/13 signed-in screens in both |
| `npm run test:db` | The database matches what the app calls |

**Rules that had drifted and were put back:**
- **Coral is not a text colour.** Coral on paper is about 2.6:1, below the 3:1 floor even for large text. Category labels ("kickers"), bullets, quote bars, the greeting cloud and the comparison table highlight had turned coral; they are muted ink or indigo again. Coral stays on buttons, link underlines, the active mark, the badge and focus rings.
- **Text in the indigo colour must use the `brand` token**, not `deep`: in dark mode `deep` is a dark surface and text set in it disappears. (`--on-accent` is the same indigo as `--deep`, so using it for text on the indigo band made it invisible.)
- Anything coloured with a fixed value (like the green correction example) must use the theme tokens so it adapts to dark mode.
