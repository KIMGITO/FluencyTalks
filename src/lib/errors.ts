// What a failure may say to a person. No imports, so it can be tested without a browser or Supabase.

export const OOPS = 'Oops! Something went wrong. Please try again.';
const OFFLINE = "You're offline. Check your connection and try again.";

/** An error written for the person using the app. Anything else thrown (database, network, a bug) never reaches the screen. */
export class UserError extends Error {}

/** The text to show for anything caught. Only our own UserError speaks for itself; the rest get `fallback`. */
export function userMessage(e: unknown, fallback = OOPS): string {
  if (e instanceof UserError && e.message) return e.message;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return OFFLINE;
  return fallback;
}
