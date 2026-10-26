import { supabase } from '@/lib/supabase';

export interface UnsplashPhoto {
  id: string;
  url: string;      // full image to show and store (text only: nothing is uploaded or copied)
  small: string;    // grid thumbnail
  thumb: string;
  alt: string;
  credit: string;   // photographer, shown as attribution (Unsplash API guidelines)
  creditUrl: string;
}

interface RawPhoto {
  id: string; alt_description: string | null;
  urls: { regular: string; small: string; thumb: string };
  user: { name: string; links: { html: string } };
}

/**
 * Searches Unsplash through the `unsplash-proxy` Edge Function, so the access key never reaches the
 * browser (a VITE_ variable is public: anyone could read and abuse it).
 * Throws a readable Error when search is unavailable.
 */
export async function searchUnsplashPhotos(query: string, perPage = 12): Promise<UnsplashPhoto[]> {
  const search = query.trim();
  if (search.length < 2) return [];
  const { data, error } = await supabase.functions.invoke('unsplash-proxy', { body: { search, perPage } });
  if (error) throw new Error('Image search is unavailable right now.');
  const results = (data as { results?: RawPhoto[] } | null)?.results ?? [];
  return results.map((p) => ({
    id: p.id, url: p.urls.regular, small: p.urls.small, thumb: p.urls.thumb,
    alt: p.alt_description ?? search, credit: p.user.name, creditUrl: p.user.links.html,
  }));
}

/** The first matching photo, or null when there is none. */
export async function searchUnsplash(query: string): Promise<UnsplashPhoto | null> {
  return (await searchUnsplashPhotos(query, 1))[0] ?? null;
}
