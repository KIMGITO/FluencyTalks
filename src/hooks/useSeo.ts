import { useEffect } from 'react';
import { BRAND, DEFAULT_DESCRIPTION, OG_IMAGE, SITE_URL_WITH_SLASH, TAGLINE } from '@/lib/site';

export type SeoOpts = {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
  image?: string;
};

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


export function useSeo({ title, description, path = '/', noIndex = false, image = OG_IMAGE }: SeoOpts = {}) {
  useEffect(() => {
    const fullTitle = !title
      ? `${BRAND}, ${TAGLINE}`
      : title.includes(BRAND)
        ? title
        : `${title} | ${BRAND}`;
    const desc = description ?? DEFAULT_DESCRIPTION;
    const url = path.startsWith('http') ? path : `${SITE_URL_WITH_SLASH}${path.replace(/^\//, '')}`;

    document.title = fullTitle;
    upsertMeta('name', 'description', desc);
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:url', url);
    upsertMeta('property', 'og:image', image);
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', desc);
    upsertMeta('name', 'twitter:image', image);
    upsertLink('canonical', url);

    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', noIndex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  }, [title, description, path, noIndex, image]);
}
