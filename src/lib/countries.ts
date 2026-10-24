import { TZ_COUNTRY } from './tzCountry.generated';

export interface Country { code: string; name: string }


export const flagOf = (code?: string | null): string => {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return '';
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
};


export const countryFromTimezone = (tz?: string | null): string | null => (tz ? TZ_COUNTRY[tz] ?? null : null);


export const resolveCountry = (code?: string | null, timezone?: string | null): { code: string; derived: boolean } | null => {
  if (code) return { code: code.toUpperCase(), derived: false };
  const fromTz = countryFromTimezone(timezone);
  return fromTz ? { code: fromTz, derived: true } : null;
};