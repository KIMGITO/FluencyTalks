import { supabase } from './supabase';

export interface UnsplashImage {
  id: string;
  urls: {
    regular: string;
    full: string;
    thumb: string;
  };
  user: {
    username: string;
    name: string;
    profile_image: {
      small: string;
      medium: string;
    };
  };
  links: {
    html: string;
    download: string;
    self: string;
  };
  description: string | null;
}

export interface UnsplashResults {
  total: number;
  total_pages: number;
  results: UnsplashImage[];
}

/** Goes through the `unsplash-proxy` Edge Function, which holds the Unsplash key. */
export async function searchUnsplash(keyword: string, page = 1, perPage = 10): Promise<UnsplashResults> {
  const { data, error } = await supabase.functions.invoke('unsplash-proxy', {
    body: { search: keyword, page, perPage },
  });
  if (error) throw error;
  return data as UnsplashResults;
}
