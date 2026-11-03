/**
 * The one place a blog post becomes HTML, used by the public pages, the admin preview and worker/index.ts, so all
 * three show the same thing. No DOM and no framework, because it runs in the Worker.
 *
 * The body is editor JSON, and this is an allow-list: a node, mark, URL or font not named here is dropped and all text
 * is escaped, so nothing stored in a post can put a script on a public page.
 */
export const BRAND = 'The Fluency Talks';
export const SITE = 'https://thefluencytalks.com';
const AUTHOR = 'The Fluency Talks team';
const DEFAULT_IMAGE = `${SITE}/og-image.png`;

export interface DocNode { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: DocNode[]; content?: DocNode[] }
export interface PostCard { slug: string; title: string; description: string; kicker: string | null; cover_url: string | null; cover_alt: string | null; read_minutes: number | null; published_at: string; updated_at: string }
export interface Post extends PostCard { seo_title: string | null; summary: string; body: DocNode | null }

export const POST_CARD_COLUMNS = 'slug,title,description,kicker,cover_url,cover_alt,read_minutes,published_at,updated_at';
export const POST_COLUMNS = `${POST_CARD_COLUMNS},seo_title,summary,body`;
/** Replaced with a post or the list of posts in the page shells that scripts/prerender.mjs builds. */
export const BLOG_MARK = '<!--ft-blog-->';

/** What the editor offers. The value goes into a style attribute, so only these can reach the page. */
export const BLOG_FONTS: { label: string; value: string }[] = [
  { label: 'Serif', value: 'Newsreader, Georgia, serif' },
  { label: 'Sans serif', value: '"Source Sans 3", Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Courier', value: '"Courier New", Courier, monospace' },
];
export const BLOG_SIZES: { label: string; value: string }[] = [
  { label: 'Small', value: '0.875rem' },
  { label: 'Large', value: '1.25rem' },
  { label: 'Larger', value: '1.5rem' },
  { label: 'Huge', value: '2rem' },
];
/** Theme variables from landing.css, not fixed colours: each has a shade for light mode and one for dark, so text stays readable in both. */
export const BLOG_COLORS: { label: string; value: string }[] = [
  { label: 'Red', value: 'var(--post-red)' },
  { label: 'Orange', value: 'var(--post-orange)' },
  { label: 'Green', value: 'var(--post-green)' },
  { label: 'Blue', value: 'var(--post-blue)' },
  { label: 'Purple', value: 'var(--post-purple)' },
  { label: 'Grey', value: 'var(--post-grey)' },
];
const FONT_VALUES = new Set(BLOG_FONTS.map((f) => f.value));
const SIZE_VALUES = new Set(BLOG_SIZES.map((f) => f.value));
const COLOR_VALUES = new Set(BLOG_COLORS.map((f) => f.value));
const ALIGN = new Set(['center', 'right', 'justify']);

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/** http(s), mailto and same-site paths. Control characters and spaces are removed first, as browsers ignore them in `java\nscript:`. */
export function safeUrl(url: unknown): string | null {
  const u = String(url ?? '').replace(/[\u0000- \u007f]/g, '');
  return /^(https?:\/\/|mailto:|\/(?![/\\])|#)/i.test(u) ? u : null;
}
const safeImage = (url: unknown) => { const u = safeUrl(url); return u && /^https?:\/\//i.test(u) ? u : null; };

function withMarks(text: string, marks: DocNode[] = []) {
  return marks.reduceRight((inner, m) => {
    switch (m.type) {
      case 'bold': return `<strong>${inner}</strong>`;
      case 'italic': return `<em>${inner}</em>`;
      case 'underline': return `<u>${inner}</u>`;
      case 'strike': return `<s>${inner}</s>`;
      case 'lang': { const l = String(m.attrs?.lang ?? ''); return /^[a-zA-Z-]{2,12}$/.test(l) ? `<span lang="${l}">${inner}</span>` : inner; }
      case 'textStyle': {
        const allowed = (name: string, value: unknown, list: Set<string>) => (list.has(String(value)) ? [`${name}:${esc(value)}`] : []);
        const style = [...allowed('font-family', m.attrs?.fontFamily, FONT_VALUES), ...allowed('font-size', m.attrs?.fontSize, SIZE_VALUES), ...allowed('color', m.attrs?.color, COLOR_VALUES)];
        return style.length ? `<span style="${style.join(';')}">${inner}</span>` : inner;
      }
      case 'link': {
        const href = safeUrl(m.attrs?.href);
        if (!href) return inner;
        return /^https?:/i.test(href) ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<a href="${esc(href)}">${inner}</a>`;
      }
      default: return inner;
    }
  }, esc(text));
}

const alignStyle = (n: DocNode) => { const a = String(n.attrs?.textAlign ?? ''); return ALIGN.has(a) ? ` style="text-align:${a}"` : ''; };

export function renderDoc(node?: DocNode | null): string {
  if (!node) return '';
  const kids = () => (node.content ?? []).map(renderDoc).join('');
  switch (node.type) {
    case 'text': return withMarks(node.text ?? '', node.marks);
    case 'paragraph': { const inner = kids(); return inner ? `<p${alignStyle(node)}>${inner}</p>` : ''; }
    case 'heading': {
      // The page's only h1 is the title.
      const level = Math.min(4, Math.max(2, Number(node.attrs?.level) || 2));
      const inner = kids();
      return inner ? `<h${level}${alignStyle(node)}>${inner}</h${level}>` : '';
    }
    case 'bulletList': return `<ul>${kids()}</ul>`;
    case 'orderedList': return `<ol>${kids()}</ol>`;
    case 'listItem': return `<li>${kids()}</li>`;
    case 'blockquote': return `<blockquote>${kids()}</blockquote>`;
    case 'horizontalRule': return '<hr>';
    case 'hardBreak': return '<br>';
    case 'image': {
      const src = safeImage(node.attrs?.src);
      return src ? `<figure class="lp-post__img"><img src="${esc(src)}" alt="${esc(node.attrs?.alt)}" loading="lazy" decoding="async"></figure>` : '';
    }
    case 'doc': return kids();
    default: return kids();
  }
}

export function docWords(node?: DocNode | null): number {
  if (!node) return 0;
  const own = node.type === 'text' ? (node.text ?? '').trim().split(/\s+/).filter(Boolean).length : 0;
  return own + (node.content ?? []).reduce((sum, c) => sum + docWords(c), 0);
}
export const readMinutes = (doc?: DocNode | null) => Math.max(1, Math.ceil(docWords(doc) / 200));

export const formatPostDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const dateTag = (iso: string) => `<time datetime="${esc(iso.slice(0, 10))}">${esc(formatPostDate(iso))}</time>`;
const coverOf = (p: PostCard) => safeImage(p.cover_url);

/** The cards on /blog. A post with no image gets a plain panel, so the grid stays even. */
export function postCardsHtml(posts: PostCard[]) {
  return posts.map((p) => {
    const cover = coverOf(p);
    const href = `/blog/${esc(p.slug)}`;
    const media = cover
      ? `<img src="${esc(cover)}" alt="${esc(p.cover_alt)}" loading="lazy" decoding="async">`
      : `<span class="lp-postcard__blank" aria-hidden="true">${esc(p.title.trim().charAt(0))}</span>`;
    return `<li class="lp-postcard"><article><a class="lp-postcard__media" href="${href}" tabindex="-1" aria-hidden="true">${media}</a><div class="lp-postcard__text">`
      + (p.kicker ? `<p class="lp-kicker">${esc(p.kicker)}</p>` : '')
      + `<h2><a href="${href}">${esc(p.title)}</a></h2><p class="lp-postcard__desc">${esc(p.description)}</p>`
      + `<p class="lp-doc__meta">${dateTag(p.published_at)} · ${esc(p.read_minutes ?? 1)} min read</p></div></article></li>`;
  }).join('');
}

/** The short list under a post: a thumbnail, the title, the date and the reading time. The row is one link and the title names it, so the image has no alt text. */
function moreLinksHtml(posts: PostCard[]) {
  return posts.map((p) => {
    const cover = coverOf(p);
    const media = cover
      ? `<img src="${esc(cover)}" alt="" loading="lazy" decoding="async">`
      : `<span class="lp-postcard__blank" aria-hidden="true">${esc(p.title.trim().charAt(0))}</span>`;
    return `<li><a class="lp-morelink" href="/blog/${esc(p.slug)}"><span class="lp-morelink__thumb">${media}</span><span class="lp-morelink__text">`
      + `<span class="lp-morelink__title">${esc(p.title)}</span><span class="lp-morelink__meta">${dateTag(p.published_at)} · ${esc(p.read_minutes ?? 1)} min read</span></span></a></li>`;
  }).join('');
}

const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');
export { jsonForScript };

/** The page's whole content: article, call to action and more posts. `preview` leaves out the structured data. */
export function postHtml(post: Post, more: PostCard[] = [], preview = false) {
  const url = `${SITE}/blog/${post.slug}`;
  const cover = coverOf(post);
  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'BlogPosting',
      headline: post.title, description: post.description, url, mainEntityOfPage: url,
      datePublished: post.published_at.slice(0, 10), dateModified: post.updated_at.slice(0, 10), inLanguage: 'en',
      image: cover ?? DEFAULT_IMAGE,
      author: { '@type': 'Organization', name: AUTHOR, url: `${SITE}/` },
      publisher: { '@type': 'Organization', name: BRAND, url: `${SITE}/`, logo: { '@type': 'ImageObject', url: `${SITE}/favicon.png` } },
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE}/blog` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ];
  return (preview ? '' : `<script type="application/ld+json">${jsonForScript(ld)}</script>`)
    + `<article class="lp-post"><header class="lp-post__head"><nav aria-label="Breadcrumb" class="lp-crumbs"><a href="/">Home</a> <span aria-hidden="true">/</span> <a href="/blog">Blog</a></nav>`
    + (post.kicker ? `<p class="lp-kicker">${esc(post.kicker)}</p>` : '')
    + `<h1>${esc(post.title)}</h1><p class="lp-doc__meta">By ${AUTHOR} · ${dateTag(post.updated_at)} · ${esc(post.read_minutes ?? 1)} min read</p></header>`
    + (cover ? `<figure class="lp-post__cover"><img src="${esc(cover)}" alt="${esc(post.cover_alt)}" width="1200" height="675" fetchpriority="high" decoding="async"></figure>` : '')
    + `<div class="lp-post__col">${post.summary ? `<p class="lp-article__summary">${esc(post.summary)}</p>` : ''}<div class="lp-article__body">${renderDoc(post.body)}</div>`
    + `<aside class="lp-doc__contact"><p>Practise this with a native speaker. It's free.</p><a class="lp-btn lp-btn--accent" href="/signup">Find a language partner</a></aside></div></article>`
    + (more.length ? `<nav class="lp-post__more" aria-labelledby="more-title"><h2 id="more-title">Keep reading</h2><ul class="lp-morelist">${moreLinksHtml(more)}</ul></nav>` : '');
}
