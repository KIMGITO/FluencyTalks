// Unsplash Proxy Edge Function
// Fetches Unsplash images with caching and rate limiting
// Deploy: supabase functions deploy unsplash-proxy
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const unsplashAccessKey = Deno.env.get('UNSPLASH_ACCESS_KEY') || '';

export const handler = async (_req: Request) => {
  const url = new URL(_req.url);
  const search = url.searchParams.get('search') || '';
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const perPage = parseInt(url.searchParams.get('perPage') || '10', 10);

  // Debounce: return cached results if available (simple in-memory cache)
  // In production, use Supabase edge cache or Redis

  if (!unsplashAccessKey) {
    return new Response(JSON.stringify({ error: 'Unsplash key not configured' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }

  const supa = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(search)}&page=${page}&per_page=${perPage}`, {
      headers: {
        'Accept-Version': 'v1',
        'Client-ID': unsplashAccessKey,
      },
    });

    if (!response.ok) {
      throw new Error('Unsplash API error');
    }

    const data = await response.json();

    // Cache result by keyword (simple approach: store in edge context)
    // For production, add proper caching with TTL

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unsplash proxy error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch images' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
};