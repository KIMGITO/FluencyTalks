import { supabase } from './supabase';
import { OOPS, UserError } from './errors';
import { REFUSALS, refusalCode } from './refusals';
import { cleanArgs } from './validate';


/** Set by the app status store: this file can't import it, the store's services import this. */
export const apiHooks = { onPaused: () => {} };
export class ApiError extends UserError { constructor(public code: string, message: string) { super(message); } }


export async function rpc<T = void>(fn: string, args?: Record<string, unknown>): Promise<T> {
  let safeArgs = args;
  try { safeArgs = cleanArgs(args); } catch { throw new ApiError('invalid_input', REFUSALS.invalid_input); }
  const { data, error } = await supabase.rpc(fn, safeArgs);
  if (error) {
    if (import.meta.env.DEV) console.warn('API error', fn, error.message, error.hint ?? '');   
    const code = refusalCode(error.message, error.code);
    if (code === 'app_paused') apiHooks.onPaused();
    throw new ApiError(code, REFUSALS[code] ?? OOPS);
  }
  return data as T;
}
