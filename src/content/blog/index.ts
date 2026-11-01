import type { ReactNode } from 'react';
import whatIsALanguageExchange from './what-is-a-language-exchange';
import findALanguageExchangePartner from './find-a-language-exchange-partner';
import correctionsFromNativeSpeakers from './corrections-from-native-speakers';

/**
 * A blog article. `title` is the H1 and the start of the <title>; `description` is the meta description
 * (aim for 140-160 characters). Dates are ISO (YYYY-MM-DD). Every article is prerendered to static HTML
 * and added to sitemap.xml by scripts/prerender.mjs, so publishing one is: add a file, list it below.
 */
export interface Post {
  slug: string;
  title: string;
  description: string;
  kicker: string;
  published: string;
  updated: string;
  readMinutes: number;
  /** The answer in two or three sentences. Shown first: search snippets and AI answers quote it. */
  summary: string;
  body: ReactNode;
}

/** Newest first. */
export const POSTS: Post[] = [
  correctionsFromNativeSpeakers,
  findALanguageExchangePartner,
  whatIsALanguageExchange,
];

export const postBySlug = (slug?: string) => POSTS.find((p) => p.slug === slug);

export const AUTHOR = 'The Fluency Talks team';
