import { supabase } from '@/lib/supabase';
import { ApiError, rpc } from '@/lib/api';
import { OOPS } from '@/lib/errors';
import { REFUSALS } from '@/lib/refusals';
import { LEGAL_VERSIONS } from '@/lib/legalVersions';
import { recordConsent } from './account';

export type AgeGate = 'birth_date_required' | 'guardian_pending' | 'guardian_declined' | null;
export type Relationship = 'mother' | 'father' | 'legal_guardian' | 'other_relative_guardian';
export const RELATIONSHIPS: { value: Relationship; label: string }[] = [
  { value: 'mother', label: 'Mother' }, { value: 'father', label: 'Father' },
  { value: 'legal_guardian', label: 'Legal guardian' }, { value: 'other_relative_guardian', label: 'Other relative with legal responsibility' },
];
export const MIN_AGE = 12;
export const ADULT_AGE = 16;

export interface GuardianStatus {
  birth_date: string | null; age: number | null; minor: boolean; status: 'not_required' | 'pending' | 'confirmed' | 'declined'; gate: AgeGate;
  request: { guardian_name: string; relationship: Relationship; guardian_email: string; status: string; requested_at: string; expires_at: string; email_sent: boolean } | null;
  can_send_at: string | null;
}
export interface GuardianView {
  status: 'pending' | 'confirmed' | 'declined' | 'withdrawn' | 'expired'; guardian_name: string; relationship: Relationship;
  child_name: string | null; child_username: string | null; child_age: number; expires_at: string; decided_at: string | null; wording: string; version: string;
  /** After a refusal or withdrawal: false if deleting the account failed and is still to be done. */
  account_deleted?: boolean;
}

/** Whole years, counted the way the database does. */
export function ageOn(birth: string, today = new Date()): number {
  const [y, m, d] = birth.split('-').map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

/**
 * Set once, together with the rules about members under 16 (the database refuses one without the other) and the
 * age statement. Refuses 'too_young' for under-12s, and stores nothing then.
 */
export async function confirmBirthDate(isoDate: string) {
  const r = await rpc<{ age: number; gate: AgeGate }>('set_birth_date', { p_birth: isoDate, p_minor_rules: LEGAL_VERSIONS.minor_rules });
  await recordConsent('age', LEGAL_VERSIONS.age);
  return r;
}
/** Whether a call with this person would be sound only (one of you is under 16). */
export const callVoiceOnlyWith = (other: string) => rpc<boolean>('call_voice_only_with', { p_other: other });
export const getGuardianStatus = () => rpc<GuardianStatus>('my_guardian_status');

async function guardianFn<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('guardian-consent', { body });
  if (error) {
    const code = await (error as { context?: Response }).context?.json?.().then((b: { error?: string }) => b.error).catch(() => undefined);
    throw new ApiError(code ?? 'failed', (code && REFUSALS[code]) || OOPS);
  }
  return data as T;
}
/** The child asks; the email with the link goes to the guardian, never back to the child. */
export const requestGuardianConsent = (p: { guardian_name: string; relationship: Relationship; guardian_email: string }) => guardianFn<{ sent: true }>({ action: 'request', ...p });
/** Used on the public consent page, signed out. */
export const viewGuardianRequest = (token: string) => guardianFn<GuardianView>({ action: 'view', token });
export const decideGuardianRequest = (token: string, decision: 'confirm' | 'decline' | 'withdraw', name?: string, adult?: boolean) =>
  guardianFn<GuardianView>({ action: 'decide', token, decision, name, adult });
