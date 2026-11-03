// Every check on what people type, in one place. No imports, so it can be tested without a browser or Supabase.
// Text goes to the database as JSON parameters and React escapes it on screen, so it is never HTML-escaped here:
// that would store "don&#39;t". What is removed is what can't be stored or read: control characters, broken
// emoji halves and the invisible marks that make text display in a different order than it was written.

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const BROKEN_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const BIDI_OVERRIDE = /[\u202A-\u202E\u2066-\u2069]/g;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const USERNAME = /^[a-z0-9_]{3,20}$/;
const MAX_PASSWORD = 72;   // what the auth server accepts

const storable = (s: string) => s.replace(CONTROL, '').replace(BROKEN_SURROGATE, '');

/** The text as it should be saved. Newlines stay unless `singleLine`. */
export function cleanText(value: string | null | undefined, { singleLine = false } = {}): string {
  const text = storable(value ?? '').replace(BIDI_OVERRIDE, '').replace(/\r\n?/g, '\n').normalize('NFC');
  return (singleLine ? text.replace(/\s*\n\s*/g, ' ') : text).trim();
}

/** Stops a field growing past its limit, in place of the HTML maxlength attribute. Never leaves half an emoji. */
export function limitLength(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max).replace(/[\uD800-\uDBFF]$/, '');
}

interface TextRule { label: string; required?: boolean; min?: number; max?: number }

/** Each check returns what is wrong, or '' when it's fine. */
export function checkText(value: string | null | undefined, { label, required, min, max }: TextRule): string {
  const text = cleanText(value);
  if (!text) return required ? `${label} can't be empty.` : '';
  if (min && text.length < min) return `${label} needs at least ${min} characters.`;
  if (max && text.length > max) return `${label} can be at most ${max} characters. Yours has ${text.length}.`;
  return '';
}

export function checkEmail(value: string): string {
  const email = value.trim();
  if (!email) return 'Enter your email address.';
  return email.length <= 254 && EMAIL.test(email) ? '' : 'Enter a valid email address, such as name@example.com.';
}

export function checkPassword(value: string, min = 8): string {
  if (!value) return 'Enter a password.';
  if (value.length < min) return `Use at least ${min} characters.`;
  return value.length > MAX_PASSWORD ? `Use at most ${MAX_PASSWORD} characters.` : '';
}

export const checkUsername = (value: string) => (USERNAME.test(value) ? '' : 'Username: 3 to 20 lowercase letters, numbers or underscores.');

/** A whole number typed into a field, as text. Rejects what Number() lets through: "", "1e3", "2.5", "-1". */
export function checkWholeNumber(value: string, { label, min = 0, max = 1_000_000 }: { label: string; min?: number; max?: number }): string {
  if (!/^\d+$/.test(value.trim())) return `${label} must be a whole number.`;
  const n = Number(value);
  return n < min || n > max ? `${label} must be between ${min} and ${max}.` : '';
}

/** The first problem found, or ''. */
export const firstProblem = (...problems: string[]) => problems.find(Boolean) ?? '';

/**
 * The last check before anything reaches the database, run on every RPC. Makes strings storable (a NUL or half an
 * emoji makes Postgres refuse the whole request) and refuses numbers JSON would quietly turn into null.
 */
export function cleanArgs<T>(value: T): T {
  if (typeof value === 'string') return storable(value) as T;
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('Not a number');
  if (Array.isArray(value)) return value.map(cleanArgs) as T;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, cleanArgs(v)])) as T;
  }
  return value;
}
