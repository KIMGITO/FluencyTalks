import { renderToString } from 'react-dom/server';
import { Route, Routes } from 'react-router-dom';
import { StaticRouter } from 'react-router-dom/server';
import Landing from '@/pages/public/Landing';
import Privacy from '@/pages/public/Privacy';
import Terms from '@/pages/public/Terms';
import DataDeletion from '@/pages/public/DataDeletion';
import Blog from '@/pages/public/Blog';
import BlogPost from '@/pages/public/BlogPost';
import LanguagesIndex from '@/pages/public/LanguagesIndex';
import LanguagePage from '@/pages/public/LanguagePage';
import About from '@/pages/public/About';
import FaqPage from '@/pages/public/FaqPage';
import NotFound from '@/pages/public/NotFound';
import { LANGUAGES } from '@/content/languages';
import { POSTS } from '@/content/blog';
import { FAQ_UPDATED } from '@/content/faq';
import { takeSsrSeo } from '@/hooks/useSeo';
import { tokenCss } from '@/theme/inject';

/**
 * Build-time only (see scripts/prerender.mjs): renders the public pages to HTML so search engines and
 * AI crawlers that do not run JavaScript still see the real content. The browser app replaces it on load.
 */
export interface PublicPage { path: string; priority: number; changefreq: 'weekly' | 'monthly'; lastmod?: string }

const newest = POSTS.map((p) => p.updated).sort().pop();

export const PUBLIC_PAGES: PublicPage[] = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/blog', priority: 0.8, changefreq: 'weekly', lastmod: newest },
  ...POSTS.map((p) => ({ path: `/blog/${p.slug}`, priority: 0.7, changefreq: 'monthly' as const, lastmod: p.updated })),
  { path: '/languages', priority: 0.8, changefreq: 'monthly' },
  ...LANGUAGES.map((l) => ({ path: `/languages/${l.slug}`, priority: 0.6, changefreq: 'monthly' as const })),
  { path: '/faq', priority: 0.8, changefreq: 'monthly', lastmod: FAQ_UPDATED },
  { path: '/about', priority: 0.5, changefreq: 'monthly' },
  { path: '/privacy', priority: 0.3, changefreq: 'monthly' },
  { path: '/terms', priority: 0.3, changefreq: 'monthly' },
  { path: '/data-deletion', priority: 0.2, changefreq: 'monthly' },
];

export function render(path: string) {
  const html = renderToString(
    <StaticRouter location={path}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/data-deletion" element={<DataDeletion />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/languages" element={<LanguagesIndex />} />
        <Route path="/languages/:slug" element={<LanguagePage />} />
        <Route path="/about" element={<About />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </StaticRouter>,
  );
  return { html, seo: takeSsrSeo() };
}

export { tokenCss };
