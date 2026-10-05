/**
 * =============================================================================
 * componentStyles.js — central registry for every component stylesheet
 * =============================================================================
 * WHY THIS EXISTS
 *   Component CSS used to live inside each component as a private
 *   `const CSS = \`...\`` string (or an inline <style> tag). That made styles
 *   impossible to reuse, easy to duplicate (reduced-motion and focus rules
 *   existed twice) and hard to review. All component sheets now live here,
 *   sectioned and commented, and are imported by the components that render
 *   them.
 *
 * HOW TO USE
 *   import { legalCSS } from '@/theme/componentStyles';
 *   ...                                            // relative: '../../theme/componentStyles'
 *   <style>{legalCSS}</style>                      // render with the component
 *
 *   Mounting many instances? `COMPONENT_CSS` (bottom of file) is every sheet
 *   concatenated, ready to inject exactly once from a root layout instead.
 *
 * CONVENTIONS
 *   - `ft-` prefix : landing / shared chrome (see also theme.js `CSS`)
 *   - `lg-` prefix : legal shell (Privacy / Terms / Data deletion)
 *   - `tst-` prefix: testimonial carousel — namespaced so its once-generic
 *                    .nav-btn / .dot / keyframes can never collide with
 *                    another component's when loaded globally.
 *   - Colours/type come from injected design tokens (`--c-*`, tokens.ts +
 *     inject.ts) or the raw palette exported by theme.js (`C`, `FONT`, `DISPLAY`).
 *
 * Every sheet is self-contained: base rules, hover/focus states, dark-theme
 * overrides and media queries travel together in one commented block.
 */
import { C, FONT, DISPLAY } from './theme';

/* ========================================================================== *
 * LEGAL PAGES — src/components/legal/LegalLayout.tsx        classes: `lg-*`
 * Sticky top bar, split media/panel stage with frosted content panel,
 * section pager, dark-theme overrides and responsive fallbacks.
 * ========================================================================== */

/**
 * Horizontal offset that keeps the content panel aligned with the 1240px
 * header on wide screens. Used by `.lg-panel` and both `.lg-content` paddings.
 */
const LEGAL_OFFSET = 'max(0px, calc((100vw - 1240px) / 2))';

export const legalCSS = `
/* -- Motion -------------------------------------------------------------- */
@keyframes lgIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes lgDrift{from{transform:scale(1.03)}to{transform:scale(1.09) translateX(-1%)}}

/* -- Sticky header: logo, section links, home link ----------------------- */
.lg-bar{position:sticky;top:0;z-index:20;background:rgb(var(--c-surface) / .94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid rgb(var(--c-border))}
.lg-bar-in{max-width:1240px;margin:0 auto;padding:10px 24px;display:flex;align-items:center;gap:20px;min-height:68px}
.lg-links{display:flex;gap:6px;margin-left:auto}
.lg-link{padding:8px 14px;border-radius:999px;font-weight:700;font-size:14px;color:rgb(var(--c-muted));text-decoration:none;transition:background .2s,color .2s}
.lg-link:hover{background:rgb(var(--c-brand-soft));color:rgb(var(--c-brand))}
.lg-link.on{background:rgb(var(--c-brand));color:rgb(var(--c-on-brand))}
.lg-back{font-weight:800;font-size:14px;color:rgb(var(--c-brand));text-decoration:none;white-space:nowrap;transition:color .2s}
.lg-back:hover{color:rgb(var(--c-accent))}

/* -- Stage: full-height split of media (background) + content panel ------ */
.lg-stage{position:relative;display:flex;min-height:calc(100vh - 68px);min-height:calc(100dvh - 68px);overflow:hidden;scroll-margin-top:68px}
.lg-left{justify-content:flex-start}.lg-right{justify-content:flex-end}
.lg-media{position:absolute;inset:0;overflow:hidden;background:rgb(var(--c-deep))}
.lg-panel{position:relative;display:flex;width:max(60%, calc(clamp(460px,46vw,640px) + ${LEGAL_OFFSET}))}
.lg-frost{position:absolute;inset:0;backdrop-filter:blur(6px) saturate(0.6);-webkit-backdrop-filter:blur(6px) saturate(0.6)}
.lg-content{position:relative;width:100%;display:flex;flex-direction:column;justify-content:center;padding:clamp(28px,4vw,48px) 0}
.lg-left .lg-content{padding-left:calc(24px + ${LEGAL_OFFSET});padding-right:clamp(56px,12vw,170px)}
.lg-right .lg-content{padding-right:calc(24px + ${LEGAL_OFFSET});padding-left:clamp(56px,12vw,170px)}

/* -- Meta row: breadcrumb chip (tinted via --lg-tint) + "Updated" -------- */
.lg-meta{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;font-size:13px;font-weight:700}
.lg-crumb{padding:6px 14px;border-radius:999px;background:var(--lg-tint);color:rgb(var(--c-deep));white-space:nowrap;box-shadow:0 1px 2px rgb(var(--c-ink) / .12)}
.lg-upd{color:rgb(var(--c-muted));white-space:nowrap}

/* -- Article: tagline chip, serif heading, section entrance animation ---- */
.lg-tag{display:inline-block;margin:0 0 12px;padding:6px 13px;border-radius:999px;background:rgb(var(--c-surface-2));color:rgb(var(--c-ink));font-weight:800;font-size:12.5px;line-height:1.3;letter-spacing:.08em;text-transform:uppercase}
.lg-tag::before{content:'';display:inline-block;width:7px;height:7px;border-radius:50%;background:rgb(var(--c-accent));margin-right:8px;vertical-align:1px}
.lg-h{font-family:var(--font-serif);font-size:clamp(26px,3.6vw,38px);line-height:1.2;margin:0 0 16px;color:rgb(var(--c-brand))}
.lg-in{animation:lgIn .45s cubic-bezier(.2,.8,.2,1) both}

/* -- Controls: prev/next pager, counter row, contact note ---------------- */
.lg-ctl{margin-top:clamp(22px,3vw,34px);padding-top:18px;border-top:1px solid rgb(var(--c-ink) / .12)}
.lg-row{display:flex;align-items:center;justify-content:space-between;gap:12px;font-weight:700;font-size:14px;color:rgb(var(--c-muted))}
.lg-nb{height:42px;padding:0 18px;border-radius:999px;border:2px solid rgb(var(--c-brand));background:transparent;color:rgb(var(--c-brand));font-weight:800;font-size:14px;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.lg-nb:hover{background:rgb(var(--c-brand));color:rgb(var(--c-on-brand))}
.lg-nb.p{background:rgb(var(--c-brand));color:rgb(var(--c-on-brand))}
.lg-nb.p:hover{background:rgb(var(--c-accent));border-color:rgb(var(--c-accent));color:rgb(var(--c-deep))}
.lg-fine{margin:14px 0 0;font-size:13px;color:rgb(var(--c-muted))}
.lg-fine a{color:rgb(var(--c-brand));font-weight:800;transition:color .2s}
.lg-fine a:hover{color:rgb(var(--c-accent))}

/* -- Utilities + focus ring (legal pages are keyboard-heavy) ------------- */
.lg-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap} /* visually hidden page <h1> */
a:focus-visible,button:focus-visible{outline:3px solid rgb(var(--c-sun));outline-offset:2px;border-radius:8px}

/* -- Dark theme overrides (tokens flip under :root[data-theme="dark"]) ---- */
:root[data-theme="dark"] .lg-link:hover{color:rgb(var(--c-aqua))}
:root[data-theme="dark"] .lg-link.on,:root[data-theme="dark"] .lg-nb.p{color:rgb(var(--c-deep))}
:root[data-theme="dark"] .lg-back{color:rgb(var(--c-aqua))}
:root[data-theme="dark"] .lg-back:hover{color:rgb(var(--c-sun))}
:root[data-theme="dark"] .lg-h{color:rgb(var(--c-accent))}
:root[data-theme="dark"] .lg-nb{color:rgb(var(--c-aqua))}
:root[data-theme="dark"] .lg-nb:hover{color:rgb(var(--c-deep))}
:root[data-theme="dark"] .lg-fine a{color:rgb(var(--c-aqua))}
:root[data-theme="dark"] .lg-fine a:hover{color:rgb(var(--c-sun))}

/* -- Breakpoints: 900px hide section links / 820px stack / 520px slim bar  */
@media(max-width:900px){.lg-links{display:none}.lg-back{margin-left:auto}}
@media(max-width:820px){
  .lg-stage{flex-direction:column;min-height:0}
  .lg-media{position:relative;inset:auto;height:clamp(190px,46vw,300px);flex:none}
  .lg-panel{width:100%;background:rgb(var(--c-surface))}.lg-frost{display:none}
  .lg-left .lg-content,.lg-right .lg-content{padding:24px 20px 36px}
  .lg-nb{height:44px}
}
@media(max-width:520px){.lg-bar .ft-logo-text{display:none}.lg-bar-in{gap:12px}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;


/* ========================================================================== *
 * LANDING FOOTER — src/components/landing/Footer.jsx    classes: `ft-foot*`
 * Link columns, hover slide on links, bottom legal bar + responsive stacks.
 * ========================================================================== */
export const footerCSS = `.ft-foot {
  display: grid;width: 100%;box-sizing: border-box;gap: clamp(28px, 4vw, 56px);align-items: start;/* Small screens (mobile): 3 grid columns */grid-template-columns: repeat(3, 1fr);
}/* Brand logo section spans all 3 columns on mobile */.ft-foot .ft-fbrand {grid-column: 1 / -1;}/* Medium screens (tablets): 2 columns layout */@media (min-width: 640px) and (max-width: 1023px) {.ft-foot {  grid-template-columns: repeat(2, 1fr);}}

/* Laptops & Big Screens: 3 columns layout */
@media (min-width: 1024px) {.ft-foot {  grid-template-columns: repeat(3, 1fr);}
}

/* Description spans full width across all grid columns at the bottom */
.ft-foot .ft-fdesc {grid-column: 1 / -1;
}

/* Footer Links & Hover States */
.ft-flink {display: inline-block;padding: 6px 0;color: rgba(255, 255, 255, 0.78);text-decoration: none;overflow-wrap: anywhere;transition: color 0.2s, transform 0.2s;
}

.ft-flink:hover {color: ${C.sun};transform: translateX(3px);
}

/* Bottom Bar */
.ft-fbar {display: flex;justify-content: space-between;align-items: center;flex-wrap: wrap;gap: 12px 24px;
}

@media (max-width: 560px) {.ft-foot {  gap: 32px 20px;}.ft-fbar {  flex-direction: column-reverse;  text-align: center;}
}
`;

/* ========================================================================== *
 * HERO CAROUSEL CONTROLS — src/components/landing/Hero.jsx   classes: `ft-ctl*`
 * Prev/next/dots order + small-screen rules (inline styles can't do media
 * queries, hence this sheet).
 * ========================================================================== */
export const heroCSS = `
.ft-ctl{display:flex;align-items:center;gap:14px}
.ft-prev{order:0}.ft-next{order:1}.ft-dots{order:2;margin-left:8px}
@media(max-width:700px){
  .ft-hero{border-radius:0!important}
  .ft-hzoom{transform:scale(1.2)}
  .ft-ctlw{bottom:72px!important}
  .ft-ctl{justify-content:space-between;gap:8px}
  .ft-dots{order:1;margin-left:0}
  .ft-next{order:2}
  .ft-arrow{width:38px!important;height:38px!important;font-size:18px!important}
}
`;

/* ========================================================================== *
 * STATS BAR — src/components/landing/Stats.jsx      classes: `ft-st-long/short`
 * Swaps long stat labels for short ones under 600px.
 * ========================================================================== */
export const statsCSS = `
.ft-st-short{display:none}
@media(max-width:600px){.ft-st-long{display:none}.ft-st-short{display:inline}}
`;


/* ========================================================================== *
 * HOW-IT-WORKS TIMELINE — src/components/landing/HowItWorks.jsx
 * classes: `ft-steps*`, `ft-step-*`, `ft-num`
 * 4-column desktop grid with connector lines → 2x2 tablet → stacked mobile
 * timeline. Uses raw palette (C) + font constants from theme.js.
 * ========================================================================== */
export const howItWorksCSS = `
/* -- Layout: a wrapping flex row (4-up -> 2x2 -> stacked) ------------------- */
.ft-steps-container {
  position: relative;
}

.ft-steps {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(20px, 2.5vw, 36px);
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
  z-index: 1;
}

/* Each step grows to share the row, so one flex rule covers every breakpoint */
.ft-steps > li {
  flex: 1 1 15rem;
  min-width: 0;
  height: 100%;
}

/* -- Step card: frosted panel with lift on hover -------------------------- */
.ft-step-card {
  position: relative;
  background: rgb(var(--c-surface) / 0.7);
  backdrop-filter: blur(8px);
  border: 1px solid rgb(var(--c-surface) / 0.8);
  border-radius: 20px;
  padding: clamp(16px, 2vw, 24px);
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), 
              box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1), 
              border-color 0.35s ease;
  box-shadow: 0 4px 20px rgb(var(--c-ink) / 0.04);
}

.ft-step-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 16px 36px rgb(var(--c-ink) / 0.1);
  border-color: rgb(var(--c-accent) / 0.3);
  background: rgb(var(--c-surface));
}

/* -- Header row: numbered badge + connector to the next card ------------- */
.ft-step-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  position: relative;
}

.ft-num {
  flex: none;
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 16px;
  background: ${C.indigo};
  color: ${C.white};
  font-family: ${DISPLAY};
  font-size: 20px;
  font-weight: 800;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
              background-color 0.3s ease, 
              box-shadow 0.3s ease;
  box-shadow: 0 6px 16px rgb(var(--c-brand) / 0.25);
}

.ft-step-card:hover .ft-num {
  background: ${C.coral};
  color: ${C.white};
  transform: scale(1.1) rotate(-4deg);
  box-shadow: 0 8px 20px rgb(var(--c-accent) / 0.35);
}

/* Horizontal connecting line (desktop only) */
.ft-step-connector {
  flex: 1;
  height: 3px;
  margin-right: calc(-1 * (clamp(20px, 2.5vw, 36px) + clamp(16px, 2vw, 24px)));
  background: linear-gradient(90deg, rgb(var(--c-brand) / 0.3) 0%, rgb(var(--c-brand) / 0.05) 100%);
  border-radius: 99px;
  transform-origin: left center;
  transition: background 0.3s ease;
}

.ft-step-card:hover .ft-step-connector {
  background: linear-gradient(90deg, ${C.coral} 0%, rgb(var(--c-accent) / 0.1) 100%);
}

/* -- Copy: serif-ish display title + muted body --------------------------- */
.ft-step-title {
  font-family: ${DISPLAY};
  font-size: clamp(18px, 1.8vw, 21px);
  font-weight: 800;
  line-height: 1.25;
  color: ${C.ink};
  margin: 0 0 10px;
  letter-spacing: -0.02em;
}

.ft-step-body {
  font-family: ${FONT};
  font-size: clamp(14px, 1.5vw, 15px);
  line-height: 1.6;
  color: ${C.muted};
  margin: 0;
}

/* Tablet (641–1024px): two per row, connectors off */
@media (max-width: 1024px) and (min-width: 641px) {
  .ft-steps > li { flex: 1 1 18rem; }
  .ft-steps { gap: 24px; }
  .ft-step-connector {
    display: none;
  }
}

/* Mobile (≤640px): vertical timeline card stack */
@media (max-width: 640px) {
  .ft-steps {
    gap: 14px;
    max-width: 480px;
    margin: 0 auto;
  }
  .ft-steps > li { flex: 1 1 100%; }

  .ft-step-connector {
    display: none;
  }

  .ft-step-card {
    padding: 16px;
    border-radius: 18px;
  }

  .ft-step-header {
    margin-bottom: 14px;
  }

  .ft-num {
    width: 42px;
    height: 42px;
    font-size: 18px;
    border-radius: 14px;
  }
}
`;


/* ========================================================================== *
 * LANGUAGES GRID — src/components/landing/Languages.jsx   classes: `ft-lang-*`
 * Greeting pills: centred flex row (3-col grid on mobile), tactile tap
 * feedback, selected outline and the "N speakers online" banner.
 * ========================================================================== */
export const languagesCSS = `
/* -- Grid: centred wrapping row of pills ---------------------------------- */
.ft-lang-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
  align-items: stretch;
  max-width: 960px;
  margin: 0 auto;
}

/* -- Pill: column stack (word + language label) --------------------------- */
.ft-lang-pill {
  position: relative;
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), 
              box-shadow 0.22s ease, 
              outline 0.15s ease;
}

/* Hover lift (desktop only, guarded so touch devices don't stick) */
@media (hover: hover) {
  .ft-lang-pill:hover {
    transform: translateY(-4px) scale(1.03);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.25);
  }
}

/* Tactile touch feedback on mobile tap */
.ft-lang-pill:active {
  transform: scale(0.95) !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2) !important;
}

/* Selected state (set when a greeting is picked) */
.ft-lang-pill.is-active {
  outline: 3px solid ${C.white};
  outline-offset: 3px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

/* "N speakers online now" confirmation banner */
.ft-online-banner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${C.white};
  font-family: ${FONT};
  font-size: 18px;
  animation: ftUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; /* ftUp lives in theme.js CSS */
}

/* Mobile (≤640px): keep the flex row, just tighten it. A 3-column grid is
   removed — flex-wrap reflows the pills naturally at any width and avoids the
   cramped 3-up look on small phones. */
@media (max-width: 640px) {
  .ft-lang-grid {
    gap: 8px;
    padding: 0 4px;
  }

  .ft-lang-pill {
    flex: 1 1 30%;
    min-width: 0 !important;
    padding: 10px 6px !important;
  }

  .ft-lang-word {
    font-size: clamp(14px, 4vw, 18px) !important;
    line-height: 1.15 !important;
  }

  .ft-lang-sub {
    font-size: 10px !important;
    margin-top: 2px !important;
    letter-spacing: 0.02em !important;
  }

  .ft-online-banner {
    flex-direction: column;
    gap: 12px;
    font-size: 15px;
    padding: 16px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(12px);
    width: 100%;
    box-sizing: border-box;
  }

  .ft-online-banner a {
    margin-left: 0 !important;
    width: 100%;
    text-align: center;
    box-sizing: border-box;
  }
}
`;


/* ========================================================================== *
 * TESTIMONIAL CAROUSEL — src/components/landing/Testimonial.jsx
 * classes: `testimonial-content-animate`, `tst-nav-btn`, `tst-dot`
 * NOTE: the original sheet used generic global names (.nav-btn, .dot,
 * fadeInSlide). They are namespaced `tst-` here so they can never style
 * another component's markup once loaded.
 * ========================================================================== */
export const testimonialCSS = `
/* -- Motion: quote fade-in when the slide changes ------------------------- */
@keyframes tstFadeIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.testimonial-content-animate {
  animation: tstFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* -- Round prev/next buttons ---------------------------------------------- */
.tst-nav-btn {
  background: rgb(var(--c-surface));
  border: 1px solid rgb(var(--c-ink) / 0.1);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px rgb(var(--c-ink) / 0.05);
  transition: all 0.2s ease;
  color: ${C.ink};
}
.tst-nav-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgb(var(--c-ink) / 0.12);
  background: rgb(var(--c-surface));
}

/* -- Pagination dots: active dot stretches into a pill -------------------- */
.tst-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgb(var(--c-ink) / 0.2);
  cursor: pointer;
  transition: all 0.3s ease;
  border: none;
  padding: 0;
}
.tst-dot.active {
  width: 28px;
  border-radius: 12px;
  background: ${C.coral};
}
`;

/* ========================================================================== *
 * LEGAL TEXT STYLE OBJECTS — back the exported P / Bullets helpers in
 * src/components/legal/LegalLayout.tsx. Reuse them for any page that renders
 * body copy inside the legal shell (Privacy, Terms, Data deletion, ...).
 * ========================================================================== */

/** Root wrapper of the legal shell: base font + light/dark surface colours. */
export const legalPage = {
  fontFamily: 'var(--font-sans)',
  color: 'rgb(var(--c-ink))',
  background: 'rgb(var(--c-surface))',
};

/** Body paragraph (the `<P>` helper). */
export const legalText = {
  margin: '0 0 14px',
  lineHeight: 1.7,
  fontSize: 'clamp(15px, 1.7vw, 16.5px)',
  color: 'rgb(var(--c-ink))',
};

/** Bullet list container (the `<Bullets>` helper): gap-only grid, no markers.
 *  Kept as a grid deliberately: `flexDirection`/`flexWrap` are strict literal
 *  unions in CSSProperties, and a one-column list needs no layout switching. */
export const legalList = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: 10,
};

/** One bullet row: accent dot + text. */
export const legalListItem = {
  display: 'flex',
  gap: 12,
  lineHeight: 1.6,
  fontSize: 'clamp(15px, 1.7vw, 16.5px)',
};

/** The accent dot marker of a bullet row. */
export const legalBulletDot = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: 'rgb(var(--c-accent))',
  marginTop: 9,
  flex: 'none',
};

/* ========================================================================== *
 * AGGREGATE — every sheet above concatenated.
 * Inject once from a root layout if you prefer a single global stylesheet
 * over rendering one <style> tag per mounted component:
 *
 *   import { COMPONENT_CSS } from '@/theme/componentStyles';
 *   ...<style>{COMPONENT_CSS}</style>
 * ========================================================================== */
export const COMPONENT_CSS = [
  legalCSS,
  footerCSS,
  heroCSS,
  howItWorksCSS,
  languagesCSS,
  statsCSS,
  testimonialCSS,
].join('\n');

