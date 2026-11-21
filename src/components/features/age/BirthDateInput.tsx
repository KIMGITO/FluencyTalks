import { Select } from '@/components/ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export interface BirthParts { day: string; month: string; year: string }
export const emptyBirth: BirthParts = { day: '', month: '', year: '' };

/** "YYYY-MM-DD", or null while incomplete or impossible (31 February). */
export function birthIso({ day, month, year }: BirthParts): string | null {
  if (!day || !month || !year) return null;
  const d = new Date(Date.UTC(+year, +month - 1, +day));
  if (d.getUTCDate() !== +day) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Day, month and year as three lists: easier than a date picker on a phone, and no locale guessing about order. */
export function BirthDateInput({ value, onChange }: { value: BirthParts; onChange: (v: BirthParts) => void }) {
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => String(thisYear - 5 - i));
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">Date of birth</legend>
      <div className="grid grid-cols-[1fr_2fr_1.4fr] gap-2">
        <Select aria-label="Day" value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })}>
          <option value="">Day</option>{Array.from({ length: 31 }, (_, i) => <option key={i} value={String(i + 1)}>{i + 1}</option>)}
        </Select>
        <Select aria-label="Month" value={value.month} onChange={(e) => onChange({ ...value, month: e.target.value })}>
          <option value="">Month</option>{MONTHS.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
        </Select>
        <Select aria-label="Year" value={value.year} onChange={(e) => onChange({ ...value, year: e.target.value })}>
          <option value="">Year</option>{years.map((y) => <option key={y}>{y}</option>)}
        </Select>
      </div>
      <p className="mt-1 text-xs text-muted">Only you can see this. It decides which safety rules apply: members aged 12 to 15 need a parent or guardian's agreement.</p>
    </fieldset>
  );
}
