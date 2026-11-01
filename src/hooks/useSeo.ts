import { useEffect } from 'react';
import { BRAND, DEFAULT_DESCRIPTION, DEFAULT_TITLE, OG_IMAGE, SITE_URL_WITH_SLASH } from '@/lib/site';

export type SeoOpts = {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
  image?: string;
  type?: 'website' | 'article';
};

export type ResolvedSeo = { title: string; description: string; url: string; image: string; robots: string; type: string };

const INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

export function resolveSeo({ title, description, path = '/', noIndex = false, image = OG_IMAGE, type = 'website' }: SeoOpts = {}): ResolvedSeo {
  const fullTitle = !title ? DEFAULT_TITLE : title.includes(BRAND) ? title : `${title} | ${BRAND}`;
  const url = path.startsWith('http') ? path : `${SITE_URL_WITH_SLASH}${path.replace(/^\//, '')}`;
  return { title: fullTitle, description: description ?? DEFAULT_DESCRIPTION, url, image, robots: noIndex ? 'noindex, nofollow' : INDEX, type };
}

/** During the build-time prerender (no document) the last page's SEO is kept here, so the script can write it into <head>. */
let ssrSeo: ResolvedSeo | null = null;
export const takeSsrSeo = () => { const s = ssrSeo; ssrSeo = null; return s; };

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}


export function useSeo(opts: SeoOpts = {}) {
  const { title, description, path, noIndex, image, type } = opts;
  if (typeof document === 'undefined') ssrSeo = resolveSeo(opts);
  useEffect(() => {
    const s = resolveSeo({ title, description, path, noIndex, image, type });
    document.title = s.title;
    upsertMeta('name', 'title', s.title);
    upsertMeta('name', 'description', s.description);
    upsertMeta('property', 'og:type', s.type);
    upsertMeta('property', 'og:title', s.title);
    upsertMeta('property', 'og:description', s.description);
    upsertMeta('property', 'og:url', s.url);
    upsertMeta('property', 'og:image', s.image);
    upsertMeta('name', 'twitter:url', s.url);
    upsertMeta('name', 'twitter:title', s.title);
    upsertMeta('name', 'twitter:description', s.description);
    upsertMeta('name', 'twitter:image', s.image);
    upsertLink('canonical', s.url);
    upsertMeta('name', 'robots', s.robots);
  }, [title, description, path, noIndex, image, type]);
}
