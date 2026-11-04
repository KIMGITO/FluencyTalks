import { createClient } from '@supabase/supabase-js';

/** Set by error reporting: this file can't import it, because reporting sends through this client. */
export const requestWatch = { onFailure: (_path: string, _status: number, _body: { code?: string; message?: string }) => {} };

/** Every read, write, function call and upload passes here, including the ones whose caller ignores the error. */
const watchedFetch: typeof fetch = async (input, init) => {
  const res = await fetch(input, init);
  if (!res.ok) {
    const { pathname } = new URL(input instanceof Request ? input.url : String(input));
    res.clone().json().catch(() => ({})).then((body) => requestWatch.onFailure(pathname, res.status, body ?? {}));
  }
  return res;
};

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, { global: { fetch: watchedFetch } });
