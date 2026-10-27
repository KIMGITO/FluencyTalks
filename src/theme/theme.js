export const NAME = 'The Fluency Talks';

const tok = (name) => `rgb(var(--c-${name}))`;
export const alpha = (token, a) => `rgb(var(--c-${token}) / ${a})`;

export const C = {
  indigo: tok('brand'), deep: tok('deep'), coral: tok('accent'), teal: tok('aqua'),
  sun: tok('sun'), sky: tok('brand-soft'), blush: 'rgb(var(--c-accent) / 0.12)',
  ink: tok('ink'), muted: tok('muted'),
  white: '#ffffff', surface: tok('surface'),
};

export const FONT = 'var(--font-sans)';
export const DISPLAY = 'var(--font-display)';
export const SERIF = 'var(--font-serif)';


const img = (id, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&auto=format&fit=crop&q=75`;
export const unsplash = img;
export const IMG = {
  hero: img('photo-1543269865-cbf427effbad'), friends: img('photo-1529156069898-49953e39b3ac'),
  team: img('photo-1522071820081-009f0129c71c'), online: img('photo-1516321318423-f06f85e504b3'), talk: img('photo-1517048676732-d65bc937f952'),
};

export const CSS = `
html{scroll-behavior:smooth; font-family: ${FONT};}
h1, h2, h3, h4, .ft-display { font-family: ${DISPLAY}; }
@keyframes ftFill{from{width:0}to{width:100%}}
a[style*="999px"]{transition:transform .25s,box-shadow .25s}
a[style*="999px"]:hover{transform:translateY(-3px);box-shadow:0 12px 24px rgba(0,0,0,.28)}
.ft-pop{transition:transform .3s cubic-bezier(.3,1.6,.5,1),box-shadow .3s;cursor:pointer}
.ft-pop:hover{transform:translateY(-8px) rotate(-2deg) scale(1.06);box-shadow:0 14px 28px rgba(0,0,0,.35)}
.ft-lift{transition:transform .3s}.ft-lift:hover{transform:translateY(-8px)}
.ft-nav a{position:relative; font-weight: 600;}.ft-nav a:after{content:'';position:absolute;left:0;bottom:-5px;height:3px;width:0;background:${C.coral};transition:width .25s}.ft-nav a:hover:after{width:100%}
.ft-arrow{transition:background .25s,transform .25s}.ft-arrow:hover{background:${C.sun}!important;color:${C.ink}!important;transform:scale(1.1)}
details summary{transition:color .2s}details summary:hover{color:${C.coral}}
section[id]{scroll-margin-top:72px}
@keyframes ftDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
a:focus-visible,button:focus-visible,[role=button]:focus-visible,summary:focus-visible{outline:3px solid ${C.sun};outline-offset:3px;border-radius:8px}
.ft-burger{display:none;place-items:center;width:44px;height:44px;border-radius:12px;border:2px solid ${C.indigo};background:transparent;color:${C.indigo};font-size:20px;font-weight:800;cursor:pointer}
.ft-drawer{display:none}
.ft-fm{display:none}
@media(max-width:900px){.ft-desk{display:none!important}.ft-burger{display:grid}.ft-drawer{display:block}}
@media(max-width:800px){.ft-bub{display:none}.ft-frost{display:none}.ft-fm{display:block}}
@media(max-width:700px){.ft-span{grid-column:1/-1}}
@media(max-width:560px){.ft-arrow{display:none}.ft-bar{font-size:12px!important;padding:8px 12px!important}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

export const wrap = { maxWidth: 1160, margin: '0 auto', padding: '0 24px' };
export const descStyle = { gridColumn: '1 / -1',margin: '16px 0 0',paddingTop: 24,borderTop: '1px solid rgba(255, 255, 255, 0.1)',lineHeight: 1.65,font: FONT,opacity: 0.85};
export const h2 = { fontFamily: DISPLAY, fontWeight: 700, fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.15, margin: '0 0 14px', color: C.ink, letterSpacing: '-0.02em' };
export const lead = { fontFamily: FONT, fontWeight: 400, fontSize: 'clamp(16px, 2vw, 18px)', lineHeight: 1.65, color: C.muted, maxWidth: 560, margin: 0 };
export const btn = (bg, color, extra = {}) => ({ display: 'inline-block', background: bg, color, padding: 'clamp(8px, 1.6vw, 10px) clamp(20px, 3vw, 30px)', borderRadius: 999, fontWeight: 700, fontSize: 16, textDecoration: 'none', border: '2px solid transparent', fontFamily: FONT, ...extra });
export const photo = (src, extra = {}) => ({ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center', ...extra });
export const grid = (min, gap = 28) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap });

