// Unsplash search proxy. The access key stays on the server; the browser never sees it.
// Deploy:  supabase functions deploy unsplash-proxy
// Secret:  supabase secrets set UNSPLASH_ACCESS_KEY=your-key      (NOT in .env, NOT VITE_*)
// Called from the app with: supabase.functions.invoke('unsplash-proxy', { body: { search, page, perPage } })
// JWT verification stays ON (default), so only signed-in users can spend the Unsplash quota.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', ...extra } });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);

  const key = Deno.env.get('UNSPLASH_ACCESS_KEY');
  if (!key) return json({ error: 'Image search is not configured' }, 503);

  let body: { search?: unknown; page?: unknown; perPage?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }

  const search = typeof body.search === 'string' ? body.search.trim().slice(0, 80) : '';
  if (search.length < 2) return json({ error: 'Type at least 2 characters' }, 400);
  const page = Math.min(Math.max(Number(body.page) || 1, 1), 20);
  const perPage = Math.min(Math.max(Number(body.perPage) || 10, 1), 20);

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(search)}&page=${page}&per_page=${perPage}&content_filter=high`,
      { headers: { 'Accept-Version': 'v1', Authorization: `Client-ID ${key}` } },
    );
    if (!res.ok) return json({ error: 'Image search is unavailable right now' }, 502);
    // Same keyword = same answer for an hour: protects the small Unsplash demo quota.
    return json(await res.json(), 200, { 'Cache-Control': 'private, max-age=3600' });
  } catch (err) {
    console.error('unsplash-proxy', err);
    return json({ error: 'Image search is unavailable right now' }, 502);
  }
});
