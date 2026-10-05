import { Select } from '@/components/ui';
import { countryFromTimezone, flagOf } from '@/lib/countries';
import { useCountries } from '@/store/countryStore';

const AUTO = '';   // "" = follow my timezone, stored as NULL

/**
 * Picks the country on the profile. The default is the one the selected timezone implies,
 * but any choice is saved explicitly, so a traveller in Paris can say "Portugal".
 */
export function CountryPicker({ value, timezone, onChange }:
  { value: string | null; timezone: string; onChange: (code: string | null) => void }) {
  const countries = useCountries();
  const suggested = countryFromTimezone(timezone);
  const suggestedName = countries.find((c) => c.code === suggested)?.name ?? suggested;
  return (
    <Select label="Country" searchable value={value ?? AUTO}
      onChange={(e) => onChange(e.target.value === AUTO ? null : e.target.value)}>
      <option value={AUTO}>{suggested ? `From my timezone (${suggested}  ${flagOf(suggested)} ${suggestedName})` : 'From my timezone'}</option>
      {countries.map((c) => <option key={c.code} value={c.code}>{c.code}  {flagOf(c.code)} {c.name}</option>)}
    </Select>
  );
}