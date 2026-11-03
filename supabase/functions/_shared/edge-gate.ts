// Asks the API on the caller's behalf, so a pause or a rate limit stops an edge function the same way it stops
// everything else. Only those two answers block: if the check itself breaks, the function's own auth still applies.
declare const Deno: { env: { get(name: string): string | undefined } };

export async function edgeGate(supabaseUrl: string, anonKey: string, authorization: string): Promise<number | null> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/edge_gate`, {
      method: 'POST',
      headers: { apikey: anonKey, Authorization: authorization, 'Content-Type': 'application/json' },
      body: '{}',
    });
    await res.body?.cancel();
    return res.status === 429 || res.status === 503 ? res.status : null;
  } catch {
    return null;
  }
}
