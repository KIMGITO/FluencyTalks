import clsx from 'clsx';
import { flagOf, resolveCountry } from '@/lib/countries';
import { useCountries } from '@/store/countryStore';

/** A country shown as its flag. Uses the country the person chose; if they never chose one
 * the timezone serves it (that is why the timezone exists on the profile at all). Renders
 * nothing when neither is known, rather than an empty pill.
 */
export function CountryBadge({ code, timezone, className, showName = false }:
  { code?: string | null; timezone?: string | null; className?: string; showName?: boolean }) {
  const list = useCountries();               // fetches once, shared by every badge
  const hit = resolveCountry(code, timezone);
  if (!hit) return null;
  const name = list.find((c) => c.code === hit.code)?.name ?? hit.code;
  return (
    <span className={clsx('inline-flex items-center gap-1 text-xs text-muted', className)}
      title={hit.derived ? `${name} — from their timezone` : name}>
      <span aria-hidden className="text-base leading-none">{flagOf(hit.code)}</span>
      {showName && <span className="truncate">{name}</span>}
      {!showName && <span className="sr-only">{name}</span>}
    </span>
  );
}