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
import { takeSsrSeo } from '@/hooks/useSeo';
import { tokenCss } from '@/theme/inject';

/**
 * Build-time only (see scripts/prerender.mjs): renders the public pages to HTML so search engines and
 * AI crawlers that do not run JavaScript still see the real content. The browser app replaces it on load.
 */
export interface PublicPage { path: string; priority: number; changefreq: 'weekly' | 'monthly'; lastmod?: string }

export const PUBLIC_PAGES: PublicPage[] = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  // The posts themselves come from the database: worker/index.ts adds them to the sitemap.
  { path: '/blog', priority: 0.8, changefreq: 'weekly' },
  { path: '/languages', priority: 0.8, changefreq: 'monthly' },
  ...LANGUAGES.map((l) => ({ path: `/languages/${l.slug}`, priority: 0.6, changefreq: 'monthly' as const })),
  // Its <lastmod> comes from the database: worker/index.ts adds it to the sitemap.
  { path: '/faq', priority: 0.8, changefreq: 'monthly' },
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
/** Public values, already in the site's JavaScript. The Worker reads them from dist/blog-config.json. */
export const blogConfig = { url: import.meta.env.VITE_SUPABASE_URL, key: import.meta.env.VITE_SUPABASE_ANON_KEY };
