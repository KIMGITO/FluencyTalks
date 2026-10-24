import { supabase } from '@/lib/supabase';

export interface UnsplashPhoto {
  url: string;               
  alt: string;
  credit: string;            
  creditUrl: string;
}

interface RawPhoto { urls: { regular: string }; alt_description: string | null; user: { name: string; links: { html: string } } }


export async function searchUnsplashPhotos(query: string, perPage = 6): Promise<UnsplashPhoto[]> {
  const search = query.trim();
  if (search.length < 2) return [];
  const { data, error } = await supabase.functions.invoke('unsplash-proxy', { body: { search, perPage } });
  if (error) throw new Error('Image search is unavailable right now.');
  const results = ((data as { results?: RawPhoto[] } | null)?.results ?? []);
  return results.map((p) => ({
    url: p.urls.regular, alt: p.alt_description ?? search, credit: p.user.name, creditUrl: p.user.links.html,
  }));
}


export async function searchUnsplash(query: string): Promise<UnsplashPhoto | null> {
  return (await searchUnsplashPhotos(query, 1))[0] ?? null;
}
