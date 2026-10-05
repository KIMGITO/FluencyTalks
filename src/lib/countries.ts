import { TZ_COUNTRY } from './tzCountry.generated';

export interface Country { code: string; name: string }

/** ISO 3166-1 alpha-2 -> flag emoji, via the regional indicator symbols. Unknown codes render nothing. */
export const flagOf = (code?: string | null): string => {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};

/**
 * The country a timezone sits in. Only zones that map to exactly one country resolve;
 * a region like "Europe/Andorra" works, but a shared zone with no single owner does not,
 * because guessing a capital would be worse than showing no flag.
 */
export const countryFromTimezone = (tz?: string | null): string | null => (tz ? TZ_COUNTRY[tz] ?? null : null);

/**
 * The country to show for someone: what they chose, or the one their timezone implies.
 * `derived` tells the UI the country is inferred, so it can be labelled as such.
 */
export const resolveCountry = (code?: string | null, timezone?: string | null): { code: string; derived: boolean } | null => {
  if (code) return { code: code.toUpperCase(), derived: false };
  const fromTz = countryFromTimezone(timezone);
  return fromTz ? { code: fromTz, derived: true } : null;
};