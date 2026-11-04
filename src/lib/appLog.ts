import { rpc } from '@/lib/api';
import { OOPS, UserError, userMessage } from '@/lib/errors';
import { failureReport } from '@/lib/refusals';
import { requestWatch, supabase } from '@/lib/supabase';
import { toast } from '@/store/toastStore';

/**
 * Sends uncaught browser errors and failed database requests to the admin Logs page. Only the path goes
 * with them, never the query or hash: those can hold reset and invitation tokens.
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

const QUIET_MS = 30_000;
let lastOops = 0;
/** Nothing caught this, so the person would otherwise see nothing happen. A background failure mustn't nag, so at most one every 30 seconds. */
const tellThem = (e: unknown) => {
  if (Date.now() - lastOops < QUIET_MS) return;
  lastOops = Date.now();
  toast.error(userMessage(e, OOPS));
};

export function startErrorReporting() {
  requestWatch.onFailure = (path, status, body) => {
    const report = failureReport(path, status, body);
    if (report) void reportClientError(report);
  };
  window.addEventListener('error', (e) => {
    void reportClientError(e.message, (e.error as Error | undefined)?.stack);
    if (e.error) tellThem(e.error);   // without one it's noise from the browser, like a resize warning
  });
  window.addEventListener('unhandledrejection', (e) => {
    const reason = e.reason as Error | string | undefined;
    if (typeof reason !== 'string' && reason?.name === 'AbortError') return;
    tellThem(reason);
    if (reason instanceof UserError) return;   // a refusal nobody caught, already in plain words
    void reportClientError(typeof reason === 'string' ? reason : reason?.message ?? 'Unhandled rejection', typeof reason === 'string' ? undefined : reason?.stack);
  });
}
