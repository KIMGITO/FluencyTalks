import { rpc } from '@/lib/api';
import { supabase } from '@/lib/supabase';

/**
 * Sends uncaught browser errors to the admin Logs page. Only the path goes with them, never the query
 * or hash: those can hold reset and invitation tokens.
 */
const seen = new Set<string>();
/** Also called by the route error page: errors React Router catches never reach the window listeners below. */
export const reportClientError = async (message: string, stack?: string) => {
  if (!message || seen.has(message) || seen.size >= 20) return;
  seen.add(message);
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  rpc('log_client_error', { p_message: message, p_context: { path: window.location.pathname, stack: stack?.slice(0, 1500) } }).catch(() => undefined);
};

export function startErrorReporting() {
  window.addEventListener('error', (e) => { void reportClientError(e.message, (e.error as Error | undefined)?.stack); });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as Error | string | undefined;
    void reportClientError(typeof reason === 'string' ? reason : reason?.message ?? 'Unhandled rejection', typeof reason === 'string' ? undefined : reason?.stack);
  });
}
