
import { C, FONT, DISPLAY } from './theme';




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



export const footerCSS = `.ft-foot {
  display: grid;width: 100%;box-sizing: border-box;gap: clamp(28px, 4vw, 56px);align-items: start;grid-template-columns: 1fr;
}/* Brand spans full width on mobile, sits beside links on desktop */.ft-foot .ft-fbrand {grid-column: 1 / -1;}@media (min-width: 640px) {.ft-foot {  grid-template-columns: repeat(2, 1fr);}}
/* Desktop: brand + 3 link columns side by side */
@media (min-width: 1024px) {.ft-foot {  grid-template-columns: 1.3fr 1fr 1fr 1fr;}.ft-foot .ft-fbrand {grid-column: auto;}}
/* Footer Links & Hover States */
.ft-flink {display: inline-block;padding: 6px 0;color: rgba(255, 255, 255, 0.78);text-decoration: none;overflow-wrap: anywhere;transition: color 0.2s, transform 0.2s;
}
.ft-flink:hover {color: ${C.sun};transform: translateX(3px);
}
/* Bottom Bar */
.ft-fbar {display: flex;justify-content: space-between;align-items: center;flex-wrap: wrap;gap: 12px 24px;
}
@media (max-width: 560px) {.ft-foot {  gap: 32px 20px;}.ft-fbar {  flex-direction: column-reverse;  text-align: center;}
}`;


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


export const statsCSS = `
.ft-st-short{display:none}
@media(max-width:600px){.ft-st-long{display:none}.ft-st-short{display:inline}}
`;



export const howItWorksCSS = `
/* -- Eyebrow pill: same voice as Hero tag + CTA labels -------------------- */
.ft-how-eyebrow {
  display: inline-block;
  padding: 8px 18px;
  border-radius: 999px;
  background: rgb(var(--c-brand-soft));
  border: 1px solid rgb(var(--c-brand) / 0.22);
  color: ${C.indigo};
  font-family: ${FONT};
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* -- Layout: a wrapping flex row (4-up -> 2x2 -> stacked) ------------------- */
.ft-steps-container {
  position: relative;
}

.ft-steps {
  display: flex;
  flex-wrap: wrap;
  gap: clamp(20px, 2.5vw, 32px);
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

/* -- Step card: chat bubble with accent rail ------------------------------- */
.ft-step-card {
  --ft-accent: ${C.coral};
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: clamp(20px, 2.4vw, 28px);
  border-radius: 26px;
  background: rgb(var(--c-surface));
  border: 1px solid rgb(var(--c-ink) / 0.09);
  border-top: 5px solid var(--ft-accent);
  box-shadow: 0 4px 20px rgb(var(--c-ink) / 0.05);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.35s ease;
}

/* Alternate the chat tail, like the Languages pills + Hero bubbles */
.ft-steps > li:nth-child(odd) .ft-step-card {
  border-radius: 26px 26px 26px 8px;
}
.ft-steps > li:nth-child(even) .ft-step-card {
  border-radius: 26px 26px 8px 26px;
}

.ft-step-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 18px 40px rgb(var(--c-ink) / 0.12);
  border-color: rgb(var(--c-ink) / 0.14);
  border-top-color: var(--ft-accent);
}

/* -- Top row: icon badge + step kicker ------------------------------------- */
.ft-step-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ft-step-icon {
  flex: none;
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  border-radius: 15px;
  box-shadow: 0 6px 16px rgb(var(--c-ink) / 0.16);
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.ft-step-card:hover .ft-step-icon {
  transform: scale(1.08) rotate(-5deg);
}

.ft-step-kicker {
  font-family: ${FONT};
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${C.muted};
}

/* -- Copy: display title + muted body -------------------------------------- */
.ft-step-title {
  font-family: ${DISPLAY};
  font-size: clamp(19px, 1.9vw, 22px);
  font-weight: 800;
  line-height: 1.25;
  color: ${C.ink};
  margin: 0;
  letter-spacing: -0.02em;
}

.ft-step-body {
  font-family: ${FONT};
  font-size: clamp(14px, 1.5vw, 15.5px);
  line-height: 1.65;
  color: ${C.muted};
  margin: 0;
}

/* Tablet (641–1024px): two per row */
@media (max-width: 1024px) and (min-width: 641px) {
  .ft-steps > li { flex: 1 1 18rem; }
  .ft-steps { gap: 24px; }
}

/* Mobile (≤640px): stacked thread with left accent rail */
@media (max-width: 640px) {
  .ft-steps {
    gap: 14px;
    max-width: 480px;
    margin: 0 auto;
  }
  .ft-steps > li { flex: 1 1 100%; }

  .ft-step-card,
  .ft-steps > li:nth-child(odd) .ft-step-card,
  .ft-steps > li:nth-child(even) .ft-step-card {
    border-radius: 18px;
    border-top: 1px solid rgb(var(--c-ink) / 0.09);
    border-left: 5px solid var(--ft-accent);
    padding: 18px;
  }

  .ft-step-icon {
    width: 42px;
    height: 42px;
  }
}
`;



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

/* -- Solid content card: guarantees text sits on surface, never on the photo */
.tst-card {
  text-shadow: none;
}
@media (max-width: 640px) {
  .tst-card {
    padding: 20px !important;
    border-radius: 20px !important;
  }
}
`;




export const legalPage = {
  fontFamily: 'var(--font-sans)',
  color: 'rgb(var(--c-ink))',
  background: 'rgb(var(--c-surface))',
};


export const legalText = {
  margin: '0 0 14px',
  lineHeight: 1.7,
  fontSize: 'clamp(15px, 1.7vw, 16.5px)',
  color: 'rgb(var(--c-ink))',
};


export const legalList = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'grid',
  gap: 10,
};


export const legalListItem = {
  display: 'flex',
  gap: 12,
  lineHeight: 1.6,
  fontSize: 'clamp(15px, 1.7vw, 16.5px)',
};


export const legalBulletDot = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: 'rgb(var(--c-accent))',
  marginTop: 9,
  flex: 'none',
};


export const COMPONENT_CSS = [
  legalCSS,
  footerCSS,
  heroCSS,
  howItWorksCSS,
  languagesCSS,
  statsCSS,
  testimonialCSS,
].join('\n');

