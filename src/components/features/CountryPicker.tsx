import { Select } from '@/components/ui';
import { countryFromTimezone, flagOf } from '@/lib/countries';
import { useCountries } from '@/store/countryStore';

const AUTO = '';   
export function CountryPicker({ value, timezone, onChange }:
  { value: string | null; timezone: string; onChange: (code: string | null) => void }) {
  const countries = useCountries();
  const suggested = countryFromTimezone(timezone);
  const suggestedName = countries.find((c) => c.code === suggested)?.name ?? suggested;
  
  return (
    <Select 
      label="Country" 
      searchable 
      value={value ?? AUTO}
      onChange={(e) => onChange(e.target.value === AUTO ? null : e.target.value)}
    >
      <option value={AUTO}>
        {suggested ? `${suggestedName} ${flagOf(suggested)}` : 'From my timezone'}
      </option>
      {countries.map((c) => {
        const labelText = `${c.name} ${flagOf(c.code)}`;
        return (
          <option key={c.code} value={c.code}>
            {labelText}
          </option>
        );
      })}
    </Select>
  );
}