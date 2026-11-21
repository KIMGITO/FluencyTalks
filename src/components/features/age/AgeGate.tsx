import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Button, Card, ErrorState, FormError, Input, Logo, Notice, Select, Spinner } from '@/components/ui';
import { ageOn, confirmBirthDate, deleteAccount, getGuardianStatus, MIN_AGE, RELATIONSHIPS, requestGuardianConsent, type GuardianStatus, type Relationship } from '@/services';
import { userMessage } from '@/lib/errors';
import { useAuthStore } from '@/store/authStore';
import { BirthDateInput, birthIso, emptyBirth } from './BirthDateInput';
import { AgeAgreements, agreementsProblem, noAgreements } from './AgeAgreements';

/**
 * Between sign-in and the app. The database refuses everything else until this is settled (check_request), so this
 * screen is what the person sees instead of a broken app: a missing date of birth, or a 12 to 15 year old waiting
 * for a parent or guardian.
 */
export function AgeGateRoute() {
  const [status, setStatus] = useState<GuardianStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const load = () => { setFailed(false); getGuardianStatus().then(setStatus).catch(() => setFailed(true)); };
  useEffect(load, []);
  if (failed) return <Frame><ErrorState title="Couldn't check your account" onRetry={load} /></Frame>;
  if (!status) return <div className="flex min-h-screen items-center justify-center bg-bg"><Spinner /></div>;
  if (!status.gate) return <Outlet />;
  return (
    <Frame>
      {status.gate === 'birth_date_required' && <AskBirthDate onDone={load} />}
      {status.gate === 'guardian_pending' && <AskGuardian status={status} onDone={load} />}
      {status.gate === 'guardian_declined' && (
        <>
          <h1 className="text-3xl">Account closed</h1>
          <p className="mt-2 text-sm text-ink">Your parent or guardian {status.request?.status === 'withdrawn' ? 'withdrew their agreement' : "didn't agree"}, so your account and everything in it are being deleted. Members under 16 can only use The Fluency Talks with a parent or guardian's agreement.</p>
          <p className="mt-2 text-sm text-muted">If this page is still here in a few minutes, delete the account yourself below.</p>
        </>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const signOut = useAuthStore((s) => s.signOut);
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-screen bg-bg px-4 py-8">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex items-center justify-between"><Logo to="/home" /><button type="button" className="text-sm text-muted hover:text-ink" onClick={() => void signOut()}>Log out</button></div>
        <span className="ft-rule mb-3" aria-hidden />
        <Card>{children}</Card>
        <button type="button" disabled={busy} className="mt-6 text-xs text-muted underline hover:text-danger"
          onClick={async () => { setBusy(true); try { await deleteAccount(); } finally { setBusy(false); } }}>Delete my account and everything in it</button>
      </div>
    </div>
  );
}

function AskBirthDate({ onDone }: { onDone: () => void }) {
  const [birth, setBirth] = useState(emptyBirth); const [agreed, setAgreed] = useState(noAgreements);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    const iso = birthIso(birth);
    if (!iso) return setError('Enter your full date of birth.');
    const problem = agreementsProblem(agreed, false);
    if (problem) return setError(problem);
    if (ageOn(iso) < MIN_AGE) return setError('You need to be 12 or older to use The Fluency Talks. You can delete your account below.');
    setBusy(true);
    try { await confirmBirthDate(iso); onDone(); }
    catch (err) { setError(userMessage(err)); } finally { setBusy(false); }
  };
  return (
    <form noValidate onSubmit={submit} className="space-y-4">
      <h1 className="text-3xl">One more thing</h1>
      <p className="text-sm text-ink">We now ask every member for their date of birth, so the right safety rules apply. You only give it once.</p>
      <BirthDateInput value={birth} onChange={setBirth} />
      <AgeAgreements value={agreed} onChange={setAgreed} />
      <FormError>{error}</FormError>
      <Button type="submit" full loading={busy}>Continue</Button>
    </form>
  );
}

function AskGuardian({ status, onDone }: { status: GuardianStatus; onDone: () => void }) {
  const [name, setName] = useState(''); const [relationship, setRelationship] = useState<Relationship | ''>('');
  const [email, setEmail] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const r = status.request;
  const waitUntil = status.can_send_at ? new Date(status.can_send_at) : null;
  const canSend = !waitUntil || waitUntil <= new Date();
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError('');
    if (name.trim().length < 2) return setError('Write your parent or guardian’s full name.');
    if (!relationship) return setError('Choose how this person is related to you.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError('Please check the email address.');
    setBusy(true);
    try { await requestGuardianConsent({ guardian_name: name.trim(), relationship, guardian_email: email.trim() }); onDone(); }
    catch (err) { setError(userMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <h1 className="text-3xl">Ask a parent or guardian</h1>
      <p className="text-sm text-ink">You're {status.age}. Members under 16 need a parent or legal guardian to agree before they can chat, call and take part. We'll email them a link: they read what The Fluency Talks is and decide.</p>
      <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
        <li>Your calls are voice only: no camera, for you or the other person.</li>
        <li>You can call adults as well as other members under 16, so native speakers and advanced learners can assess you.</li>
        <li>Adults can't message you unless you accept their request, and they don't see you in search.</li>
        <li>Your date of birth is never shown to anyone.</li>
      </ul>
      <Notice tone="warning" small>If your parent or guardian says no, or later withdraws their agreement, your account and everything in it are deleted at once.</Notice>
      {r && r.status === 'pending' && (
        <Notice>
          {r.email_sent ? <>We emailed <strong>{r.guardian_name}</strong> at {r.guardian_email}. The link works until {new Date(r.expires_at).toLocaleDateString()}. This page opens up as soon as they agree.</>
            : <>We couldn't send the email to {r.guardian_email}. Check the address and send it again.</>}
        </Notice>
      )}
      <form noValidate onSubmit={submit} className="space-y-3">
        <p className="text-sm font-semibold text-ink">{r ? 'Send to someone else, or again' : 'Their details'}</p>
        <Input label="Their full name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
        <Select label="They are my" value={relationship} onChange={(e) => setRelationship(e.target.value as Relationship)}>
          <option value="">Choose</option>{RELATIONSHIPS.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
        </Select>
        <Input label="Their email address" type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormError>{error}</FormError>
        <Button type="submit" full loading={busy} disabled={!canSend}>{canSend ? 'Email them the link' : `You can send again at ${waitUntil?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}</Button>
        <button type="button" className="w-full text-center text-xs text-muted underline" onClick={onDone}>I've been told they agreed: check again</button>
      </form>
    </div>
  );
}
