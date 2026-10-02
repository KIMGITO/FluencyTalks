export const NAME = 'FluencyTalks';
export const C = { indigo: '#2b2a7a', deep: '#1b1a55', coral: '#ff6a4d', teal: '#12b5a6', sun: '#ffc83d', sky: '#e6f4ff', blush: '#fff0ea', ink: '#17163a', muted: '#5b5a7e', white: '#ffffff' };
export const FONT = "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif";
export const SERIF = "Georgia, 'Times New Roman', serif";
const img = (id, w = 1600) => `https://images.unsplash.com/${id}?w=${w}&auto=format&fit=crop&q=75`;
export const IMG = {
  hero: img('photo-1543269865-cbf427effbad'), friends: img('photo-1529156069898-49953e39b3ac'),
  team: img('photo-1522071820081-009f0129c71c'), online: img('photo-1516321318423-f06f85e504b3'), talk: img('photo-1517048676732-d65bc937f952'),
};

/* Keyframes, hover states and media queries cannot be written inline, so they live here. */
export const CSS = `
html{scroll-behavior:smooth}
@keyframes ftWord{from{opacity:0;transform:translateY(70%) rotate(5deg);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes ftUp{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:none}}
@keyframes ftZoom{from{transform:scale(1)}to{transform:scale(1.14)}}
@keyframes ftDrift{from{transform:scale(1.04) translateX(0)}to{transform:scale(1.12) translateX(-1.5%)}}
@keyframes ftFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-16px)}}
@keyframes ftFill{from{width:0}to{width:100%}}
a[style*="999px"]{transition:transform .25s,box-shadow .25s}
a[style*="999px"]:hover{transform:translateY(-3px);box-shadow:0 12px 24px rgba(0,0,0,.28)}
.ft-pop{transition:transform .3s cubic-bezier(.3,1.6,.5,1),box-shadow .3s;cursor:pointer}
.ft-pop:hover{transform:translateY(-8px) rotate(-2deg) scale(1.06);box-shadow:0 14px 28px rgba(0,0,0,.35)}
.ft-lift{transition:transform .3s}.ft-lift:hover{transform:translateY(-8px)}
.ft-nav a{position:relative}.ft-nav a:after{content:'';position:absolute;left:0;bottom:-5px;height:3px;width:0;background:#ff6a4d;transition:width .25s}.ft-nav a:hover:after{width:100%}
.ft-arrow{transition:background .25s,transform .25s}.ft-arrow:hover{background:#ffc83d!important;color:#17163a!important;transform:scale(1.1)}
details summary{transition:color .2s}details summary:hover{color:#ff6a4d}
section[id]{scroll-margin-top:72px}
a:focus-visible,button:focus-visible,[role=button]:focus-visible,summary:focus-visible{outline:3px solid #ffc83d;outline-offset:3px;border-radius:8px}
.ft-burger{display:none;place-items:center;width:44px;height:44px;border-radius:12px;border:2px solid #2b2a7a;background:transparent;color:#2b2a7a;font-size:20px;font-weight:800;cursor:pointer}
.ft-fm{display:none}
@media(max-width:900px){.ft-desk{display:none!important}.ft-burger{display:grid}}
@media(max-width:800px){.ft-bub{display:none}.ft-frost{display:none}.ft-fm{display:block}}
@media(max-width:700px){.ft-span{grid-column:1/-1}}
@media(max-width:560px){.ft-arrow{display:none}.ft-bar{font-size:12px!important;padding:8px 12px!important}}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`;

export const wrap = { maxWidth: 1160, margin: '0 auto', padding: '0 24px' };
export const h2 = { fontFamily: SERIF, fontSize: 'clamp(28px, 4vw, 42px)', lineHeight: 1.15, margin: '0 0 14px', color: C.ink };
export const lead = { fontSize: 'clamp(16px, 2vw, 18px)', lineHeight: 1.65, color: C.muted, maxWidth: 560, margin: 0 };
export const btn = (bg, color, extra = {}) => ({ display: 'inline-block', background: bg, color, padding: 'clamp(8px, 1.6vw, 10px) clamp(20px, 3vw, 30px)', borderRadius: 999, fontWeight: 800, fontSize: 16, textDecoration: 'none', border: '2px solid transparent', ...extra });
export const photo = (src, extra = {}) => ({ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center', ...extra });
export const grid = (min, gap = 28) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap });
export const blob = (color, size, pos) => ({ position: 'absolute', width: size, height: size, borderRadius: '50%', background: color, filter: 'blur(70px)', opacity: 0.35, animation: 'ftFloat 9s ease-in-out infinite', pointerEvents: 'none', ...pos });
export const bubble = (bg, color, extra) => ({ position: 'absolute', background: bg, color, padding: '12px 20px', borderRadius: '22px 22px 22px 4px', fontWeight: 800, fontSize: 18, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', animation: 'ftFloat 5s ease-in-out infinite', ...extra });
