# Landing page design

The landing page is meant to read like a university prospectus, not a software template. The reference for
the mood was the Open University of Kenya website (structure and tone only; no text or images were copied).
All landing styles live in `src/styles/landing.css`, scoped under `.lp`, so nothing leaks into the app.

## Type
- **Headings:** Newsreader (an editorial serif). **Body:** Source Sans 3. Both load from Google Fonts in `index.html`
  and are set in `src/theme/tokens.ts`, so the whole app uses them.
- **Line height 1.6** for reading text (body, cards, FAQ). Large headings stay tighter (1.0 to 1.12) on purpose.

## Layout rules
- Nothing is a row of equal boxes. The hero headline overlaps the photograph (it sits on paper-coloured strips so it stays readable);
  the three steps are different widths and staggered; the five service cards differ in width and height; the two roles are unequal columns.
- Section padding is deliberately uneven: a very large hero, a very airy languages section, medium roles and FAQ, and a tight footer.
- Colour: warm paper background, hairline rules instead of heavy borders, square-ish 2 to 4px corners, one inverted card, coral used sparingly.
  Light and dark mode both work because colours come from the same tokens as the app.

## Motion
- **Hover:** cards lift 4px with a soft shadow; buttons lift 2px.
- **Scroll reveal:** elements marked `data-reveal` fade and rise once. The hiding class is added by JavaScript, so content is visible without it.
- **Navigation:** the link for the section you are reading gets a coral rule (scroll-spy), and it clears when you return to the top.
- **Reduced motion:** with `prefers-reduced-motion`, every transition and animation is off and content is simply visible.

## Content rules
Every claim on the page describes something the app really does. The page used to contain invented testimonials, made-up "online now" counts,
a "Premium" plan, voice/video and daily streaks. None of those exist, so they were removed.
The "The project" section says the app started as a university project; edit `src/components/landing/Project.jsx` if you prefer different wording.

## Photos
Photos are Unsplash images, decorative (empty alt text), and credited in the footer. To change them, edit the ids in `src/components/landing/Hero.jsx`.
