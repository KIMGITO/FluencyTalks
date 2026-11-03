// Serves the blog from the database as real HTML, so a post is on the site, in the sitemap and in llms.txt as soon as
// it is published, with no deploy. wrangler.toml sends only these paths here; everything else is a static file.
import { BLOG_MARK, POST_CARD_COLUMNS, POST_COLUMNS, SITE, esc, jsonForScript, postCardsHtml, postHtml, type Post, type PostCard } from '../src/lib/blogHtml';

interface Env { ASSETS: { fetch: (req: Request | string) => Promise<Response> } }
interface Ctx { waitUntil: (p: Promise<unknown>) => void }

/** Long enough to spare the database when a crawler arrives, short enough that a change shows up quickly. */
const EDGE_SECONDS = 60;
const SHELL_PATH = '/blog/__post__';

const asset = (env: Env, req: Request, path: string) => env.ASSETS.fetch(new Request(new URL(path, req.url), { method: 'GET' }));

async function query<T>(env: Env, req: Request, params: string): Promise<T[]> {
  // The public URL and key, written by scripts/prerender.mjs: both are in the site's JavaScript already.
  const { url, key } = await (await asset(env, req, '/blog-config.json')).json() as { url: string; key: string };
  const res = await fetch(`${url}/rest/v1/blog_posts?${params}`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`database answered ${res.status}`);
  return res.json() as Promise<T[]>;
}
const listPosts = (env: Env, req: Request, limit = 100) => query<PostCard>(env, req, `select=${POST_CARD_COLUMNS}&order=published_at.desc&limit=${limit}`);

function setMeta(html: string, attr: string, key: string, value: string) {
  return html.replace(new RegExp(`(<meta ${attr}="${key}" content=")[^"]*(")`), (_m, a, b) => `${a}${esc(value)}${b}`);
}

const dataScript = (data: unknown) => `<script id="ft-blog-data" type="application/json">${jsonForScript(data)}</script>`;
const html = (body: string, status = 200) => new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } });

async function indexPage(env: Env, req: Request) {
  const shell = await (await asset(env, req, '/blog')).text();
  const path = '/blog';
  const posts = await listPosts(env, req);
  return html(shell.replace(BLOG_MARK, postCardsHtml(posts)).replace('</head>', `${dataScript({ path, posts })}\n  </head>`));
}

async function postPage(env: Env, req: Request, slug: string) {
  const [post] = await query<Post>(env, req, `select=${POST_COLUMNS}&slug=eq.${encodeURIComponent(slug)}&limit=1`);
  if (!post) return asset(env, req, '/__no_such_page__');
  const more = (await listPosts(env, req, 4)).filter((p) => p.slug !== slug).slice(0, 3);
  const path = `/blog/${slug}`;
  const title = (post.seo_title || post.title).includes('The Fluency Talks') ? (post.seo_title || post.title) : `${post.seo_title || post.title} | The Fluency Talks`;
  const url = `${SITE}${path}`;
  const image = post.cover_url || `${SITE}/og-image.png`;
  let out = (await (await asset(env, req, '/blog-post-shell')).text())
    .replaceAll(SHELL_PATH, path)
    .replace(BLOG_MARK, postHtml(post, more))
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, (_m, a, b) => `${a}${esc(url)}${b}`)
    .replace('</head>', `${dataScript({ path, post, more })}\n  </head>`);
  for (const [attr, key, value] of [
    ['name', 'title', title], ['name', 'description', post.description], ['name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'],
    ['property', 'og:type', 'article'], ['property', 'og:url', url], ['property', 'og:title', title], ['property', 'og:description', post.description], ['property', 'og:image', image],
    ['name', 'twitter:url', url], ['name', 'twitter:title', title], ['name', 'twitter:description', post.description], ['name', 'twitter:image', image],
  ]) out = setMeta(out, attr, key, value);
  return html(out);
}

/** The static sitemap, plus the posts. */
async function sitemap(env: Env, req: Request) {
  const res = await asset(env, req, '/sitemap.xml');
  const posts = await listPosts(env, req, 1000);
  const entries = posts.map((p) => `  <url><loc>${SITE}/blog/${esc(p.slug)}</loc><lastmod>${p.updated_at.slice(0, 10)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`).join('\n');
  const newest = posts.map((p) => p.updated_at.slice(0, 10)).sort().pop();
  const body = (await res.text())
    .replace(`<loc>${SITE}/blog</loc>`, `<loc>${SITE}/blog</loc>${newest ? `<lastmod>${newest}</lastmod>` : ''}`)
    .replace('</urlset>', `${entries}\n</urlset>`);
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } });
}

async function llms(env: Env, req: Request) {
  const res = await asset(env, req, '/llms.txt');
  const posts = await listPosts(env, req);
  const lines = posts.map((p) => `- [${p.title.replace(/[[\]]/g, '')}](${SITE}/blog/${p.slug})`).join('\n');
  const body = (await res.text()).replace(/^(- \[Blog:.*)$/m, (line) => (lines ? `${line}\n${lines}` : line));
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } });
}

async function route(env: Env, req: Request, pathname: string): Promise<Response> {
  if (pathname === '/blog') return indexPage(env, req);
  if (pathname === '/sitemap.xml') return sitemap(env, req);
  if (pathname === '/llms.txt') return llms(env, req);
  const slug = pathname.match(/^\/blog\/([a-z0-9]+(?:-[a-z0-9]+)*)$/)?.[1];
  return slug ? postPage(env, req, slug) : asset(env, req, '/__no_such_page__');
}

export default {
  async fetch(req: Request, env: Env, ctx: Ctx): Promise<Response> {
    const { pathname, origin } = new URL(req.url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD' } });
    if (pathname.length > 1 && pathname.endsWith('/')) return Response.redirect(`${origin}${pathname.slice(0, -1)}`, 301);

    const cache = (caches as unknown as { default: Cache }).default;
    const key = new Request(`${origin}${pathname}`);
    const hit = await cache.match(key);
    if (hit) return req.method === 'HEAD' ? new Response(null, hit) : hit;
    try {
      const res = await route(env, req, pathname);
      if (res.status === 200) {
        const stored = new Response(res.clone().body, res);
        stored.headers.set('cache-control', `public, s-maxage=${EDGE_SECONDS}`);
        ctx.waitUntil(cache.put(key, stored));
      }
      return req.method === 'HEAD' ? new Response(null, res) : res;
    } catch (e) {
      // Not a 404: a database hiccup must not tell search engines the post is gone. The list page can still load its posts in the browser.
      console.error('blog', pathname, e);
      if (pathname === '/blog') return asset(env, req, '/blog');
      return new Response('Temporarily unavailable. Please try again in a moment.', { status: 503, headers: { 'retry-after': '120', 'content-type': 'text/plain; charset=utf-8' } });
    }
  },
};
