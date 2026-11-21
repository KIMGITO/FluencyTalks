import { Link } from 'react-router-dom';
import { Checkbox, Notice } from '@/components/ui';
import { LEGAL_WORDING } from '@/lib/legalVersions';

export interface Agreements { age: boolean; minorRules: boolean; terms: boolean }
export const noAgreements: Agreements = { age: false, minorRules: false, terms: false };

/** What has to be ticked before a date of birth is saved, or null. `withTerms` on first sign-up. */
export function agreementsProblem(a: Agreements, withTerms: boolean): string | null {
  if (!a.age) return 'Please confirm your date of birth is correct.';
  if (!a.minorRules) return 'Please read and accept the rules about members under 16.';
  if (withTerms && !a.terms) return 'Please agree to the Terms and Privacy Policy.';
  return null;
}

/**
 * The statements every member accepts with their date of birth, adult or not. The wording is the stored consent
 * document, word for word, so the proof shows exactly what was ticked.
 */
export function AgeAgreements({ value, onChange, withTerms }: { value: Agreements; onChange: (v: Agreements) => void; withTerms?: boolean }) {
  const set = (k: keyof Agreements) => (v: boolean) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-3">
      <Checkbox checked={value.age} onChange={set('age')}>{LEGAL_WORDING.age}</Checkbox>
      <Notice tone="warning" role="region" aria-label="Rules about members under 16">
        <p className="font-semibold">Members under 16: rules for everyone</p>
        <p className="mt-1 text-ink">{LEGAL_WORDING.minor_rules}</p>
      </Notice>
      <Checkbox checked={value.minorRules} onChange={set('minorRules')}>I have read the rules about members under 16 above, and I accept them. I know breaking them can be reported to the police.</Checkbox>
      {withTerms && (
        <Checkbox checked={value.terms} onChange={set('terms')}>I agree to the <Link className="underline" to="/terms">Terms</Link> and <Link className="underline" to="/privacy">Privacy Policy</Link>.</Checkbox>)}
    </div>
  );
}
