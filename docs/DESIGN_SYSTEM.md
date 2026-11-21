# Design system

Everything visual comes from one file, `src/theme/tokens.ts`, so restyling the whole app means editing that one file. This document covers the token rules, the public pages and the signed-in screens.

## Theming rules

Tailwind, CSS variables and custom CSS work together, all fed by `src/theme/tokens.ts`:

| Need | Where it comes from |
|---|---|
| Colours (light and dark) | `themes` in tokens.ts, to `--c-*` variables, to Tailwind `bg-surface`, `text-muted`, `bg-brand/20` |
| Fonts, sizes, spacing, radii | tokens.ts, to the Tailwind theme and `--font-*`, `--space-*`, `--radius-*` |
| Gradients | **None, anywhere.** Every surface is one flat colour. `.ft-ruled` (notebook lines) is an SVG image. |
| Layout widths | `layout` in tokens.ts, to `--layout-*` |
| Light and dark | `data-theme` on `<html>`, set by `themeStore` |

**Never** write `#hex`, `px` font sizes or any gradient (`linear-`, `radial-`, `bg-gradient-*`) anywhere. Add a token instead. Custom CSS in `index.css` may only reference `var(--...)`.

## Responsive behaviour

| Width | Layout |
|---|---|
| Under 768px | One column, top bar, **bottom tab bar** |
| 768 to 1099px | Icon-only sidebar and content |
| 1100px and up | Sidebar with labels, content and right rail |

Breakpoints are defined once in tokens.ts.

## Tailwind traps

These look correct in code review and only show up as a layout bug on screen.

- **Colours:** see the trap under [Inside the app](#inside-the-app-signed-in-screens).
- **Spacing:** `spacing` in tokens.ts replaces Tailwind's scale, with only 0, px, 0.5 to 5 in steps, 6 to 10, 12, 14, 16, 20 and 24. Any other class (`min-h-11`, `h-11`, `basis-48`) generates no CSS and gives no error. Use arbitrary values such as `basis-[12rem]`, and check the screen.
- **Still live:** `Button` size md and `Select` use `min-h-11`, so they are shorter than the intended 44px. Adding 11 to the scale would fix that everywhere, but it also resizes learner screens.
- **Fonts:** `font-mono` doesn't exist, because `fontFamily` only defines sans and display.

---

# Public pages

Every public page (home, privacy, terms, delete my data, log in, sign up, forgot and reset password, 404) uses one shell:
`PublicShell` in `src/components/landing/` gives the same header, footer and look. All styles live in `src/styles/landing.css`,
scoped under `.lp`, so nothing leaks into the app. The mood is a university prospectus rather than a software template:
a serif for headlines, hairline rules, square-ish corners, photos pinned at slight angles, layouts that do not repeat.
The reference was the Open University of Kenya site (structure and tone only; no text or images were copied).

## Colour: 60-30-10 (since 2026-11-21, from the owner's print-advert reference)
| Share | Colour | Used for |
|---|---|---|
| 60% | **Off-white** `238 240 244` | page background, cards, whitespace |
| 30% | **Navy** `14 32 72` for text and bands; **royal blue** `23 78 210` for headlines and links |
| 10% (a ceiling) | **Red** `224 32 46` | primary buttons, star ratings, the short rule above a title (`.ft-rule`), focus rings |

No purple, violet or maroon anywhere (owner's decision, 2026-11-21): blues sit at a true blue hue, reds are bright reds, `danger` is `200 30 30`. Red is never small text on off-white (4.2:1). Text on red is white (4.8:1), and small red text uses `danger`. Dark mode swaps the ground to navy and keeps the red.

## Type
Headlines (`h1`, `h2`, `.font-display`) use Barlow Condensed 800 italic capitals in royal blue, like the reference poster. `h3` is Barlow Condensed 700, upright. Body text is Barlow. Both come from Google Fonts and are set in `src/theme/tokens.ts`.

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
and the age matches the sign-up checkbox (16). The privacy page now follows Vietnamese law. **Please have the wording reviewed before relying on it** ([Legal compliance](LEGAL_COMPLIANCE.md)): the consent kind stored in the database is still named `age_18`.
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
| Primary button | **Coral** with navy text (`<Button>`, or `buttonClass()` for links). One per screen. Lifts 2px on hover. |
| Everything else | Outlined buttons (`secondary`), plain text (`ghost`), outlined red (`danger`) |
| Inputs, selects, text areas | White, hairline border, 4px corners, red focus ring, labels in ink |
| Tabs | Underlined, the open tab gets a red rule (`Tabs`, `tabClass`, `tabsClass`) |
| Tags (levels, categories, status) | Small outlined squares (`.ft-tag`); "native" is filled navy |
| Post types and categories | Each has its own tint and mark (`postLooks.ts`). Ink text on tints only. Text on an image sits on a 70% navy layer |
| Navigation | Navy sidebar on a laptop, navy tab bar on a phone; the current page has a red mark |
| Chat | Sent bubbles navy, received paper; corrections show red and green |
| Clickable cards | `.ft-lift`: rise 4px with a soft shadow |
| Page titles | Barlow Condensed 800 italic capitals, royal blue |

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
- **Red is not a text colour.** Red on off-white is about 4.2:1, below AA for small text. Category labels ("kickers"), bullets, quote bars, the greeting cloud and the comparison table highlight had turned red; they are muted ink or blue again. Red stays on buttons, link underlines, the active mark, the badge and focus rings.
- **Text in the blue colour must use the `brand` token**, not `deep`: in dark mode `deep` is a dark surface and text set in it disappears. (`--on-accent` is the same blue as `--deep`, so using it for text on the navy band made it invisible.)
- Anything coloured with a fixed value (like the green correction example) must use the theme tokens so it adapts to dark mode.

## Shared components

Anything that appears more than twice is a component, and screens use the component instead of repeating the classes: `FormError` (an error under a form or action), `Checkbox` (a labelled tick box), `Notice` (info, warning, success or danger box), `Page` (the single-column screen container), `CharCount` ("120 / 500"), `MenuItem` (a row in a pop-up menu), plus the existing `Button`, `Input`, `Select`, `Textarea`, `Card`, `Modal` and the rest of `src/components/ui`. Date of birth and its agreements use `AgeAgreements` (components/features/age).
