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
