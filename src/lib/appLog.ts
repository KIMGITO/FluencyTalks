import { rpc } from '@/lib/api';
import { supabase } from '@/lib/supabase';

/**
 * Sends uncaught browser errors to the admin Logs page. Only the path goes with them, never the query
 * or hash: those can hold reset and invitation tokens.
 */
export function startErrorReporting() {
  const seen = new Set<string>();
  const report = async (message: string, stack?: string) => {
    if (!message || seen.has(message) || seen.size >= 20) return;
    seen.add(message);
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    rpc('log_client_error', { p_message: message, p_context: { path: window.location.pathname, stack: stack?.slice(0, 1500) } }).catch(() => undefined);
  };
  window.addEventListener('error', (e) => { void report(e.message, (e.error as Error | undefined)?.stack); });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as Error | string | undefined;
    void report(typeof reason === 'string' ? reason : reason?.message ?? 'Unhandled rejection', typeof reason === 'string' ? undefined : reason?.stack);
  });
}
