import { useCallback, useRef, useState } from 'react';
import { toast } from '@/store/toastStore';
import { userMessage } from '@/lib/errors';

const SLOW_MS = 8000;

interface Options<A extends unknown[]> {
  /** Shown once the server has confirmed. Leave out when the screen change already says it. */
  success?: string | ((result: unknown, ...args: A) => string | undefined);
  /** Used only when the failure has no message of its own. */
  error?: string;
  onDone?: (result: unknown) => void;
  onError?: (e: Error) => void;
  /** Failed quietly because the caller shows the error itself. */
  silent?: boolean;
}

/**
 * The one way an action behaves: one run at a time (a second tap does nothing), `busy` for the button,
 * success only after the server confirmed, an error with a retry, and a note when it is taking long.
 */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>, opts: Options<A> = {}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const latest = useRef({ fn, opts });
  latest.current = { fn, opts };

  const run = useCallback(async (...args: A): Promise<R | undefined> => {
    if (running.current) return undefined;
    running.current = true;
    setBusy(true);
    setError('');
    const slow = setTimeout(() => toast.info('Still working. Your connection may be slow.'), SLOW_MS);
    try {
      const result = await latest.current.fn(...args);
      const { success, onDone } = latest.current.opts;
      const text = typeof success === 'function' ? success(result, ...args) : success;
      if (text) toast.success(text);
      onDone?.(result);
      return result;
    } catch (e) {
      const { error: fallback, silent, onError } = latest.current.opts;
      const message = userMessage(e, fallback);
      setError(message);
      if (!silent) toast.error(message, () => { void run(...args); });
      onError?.(e as Error);
      return undefined;
    } finally {
      clearTimeout(slow);
      running.current = false;
      setBusy(false);
    }
  }, []);

  return { run, busy, error, clearError: () => setError('') };
}
