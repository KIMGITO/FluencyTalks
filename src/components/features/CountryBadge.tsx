import clsx from 'clsx';
import { flagOf, resolveCountry } from '@/lib/countries';
import { useCountries } from '@/store/countryStore';


export function CountryBadge({ code, timezone, className, showName = true }:
  { code?: string | null; timezone?: string | null; className?: string; showName?: boolean }) {
  const list = useCountries();               
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