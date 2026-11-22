import { useCallback, useEffect, useState } from 'react';
import { getPersonStatus, type PersonStatus } from '@/services/connections';

const POLL_MS = 30_000;

/**
 * Connection, online and on-a-call state for a set of people, refreshed every 30 seconds while the page is visible.
 * `patch` updates one person straight away after an action (connect, accept), before the next poll.
 */
export function usePersonStatus(ids: (string | null | undefined)[]) {
  const key = [...new Set(ids.filter((i): i is string => !!i))].sort().join(',');
  const [map, setMap] = useState<Record<string, PersonStatus>>({});
  const load = useCallback(() => {
    if (!key || document.hidden) return;
    getPersonStatus(key.split(',')).then((rows) => setMap((m) => ({ ...m, ...Object.fromEntries(rows.map((r) => [r.user_id, r])) }))).catch(() => undefined);
  }, [key]);
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    document.addEventListener('visibilitychange', load);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', load); };
  }, [load]);
  const patch = useCallback((id: string, p: Partial<PersonStatus>) => setMap((m) => ({ ...m, [id]: { ...(m[id] ?? { user_id: id, connection: 'none', online: false, in_call: false, can_call: false, good_calls: 0 }), ...p } })), []);
  return { status: map, patch, reload: load };
}
