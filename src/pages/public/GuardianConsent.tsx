import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { decideGuardianRequest, RELATIONSHIPS, viewGuardianRequest, type GuardianView } from '@/services/age';
import { userMessage } from '@/lib/errors';
import { LEGAL_WORDING } from '@/lib/legalVersions';
import { Checkbox, FormError } from '@/components/ui';

const box = { maxWidth: '40rem', margin: '0 auto', padding: 'clamp(2rem, 6vw, 4rem) var(--gutter)' };

/** Opened from the email. The guardian has no account: the token in the link is the only key, and it never reaches the child. */
export default function GuardianConsent() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [view, setView] = useState<GuardianView | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState(''); const [adult, setAdult] = useState(false); const [rules, setRules] = useState(false);
  const [sureDecline, setSureDecline] = useState(false);
  const [busy, setBusy] = useState(false); const [sureWithdraw, setSureWithdraw] = useState(false);

  useEffect(() => { viewGuardianRequest(token).then((v) => { setView(v); setName(v.guardian_name); }).catch((e) => setError(userMessage(e))); }, [token]);

  const decide = async (decision: 'confirm' | 'decline' | 'withdraw') => {
    setError('');
    if (decision === 'confirm' && (!adult || name.trim().length < 2)) return setError('Write your full name and confirm you are 18 or older and the child’s parent or legal guardian.');
    if (decision === 'confirm' && !rules) return setError('Please read and accept the rules about members under 16.');
    setBusy(true);
    try { setView(await decideGuardianRequest(token, decision, name.trim(), adult)); } catch (e) { setError(userMessage(e)); } finally { setBusy(false); }
  };
  const child = view?.child_name ?? 'your child';
  const rel = RELATIONSHIPS.find((r) => r.value === view?.relationship)?.label.toLowerCase();

  return (
    <PublicShell>
      <div style={box}>
        <span className="ft-rule" aria-hidden />
        <h1 style={{ fontSize: 'clamp(2.2rem, 8vw, 3.4rem)', marginTop: '1rem' }}>Parent or guardian permission</h1>
        {!view && !error && <p className="lp-p">Loading…</p>}
        {!view && <FormError className="lp-p">{error}</FormError>}
        {view && view.status === 'pending' && (
          <>
            <p className="lp-p" style={{ marginTop: '1rem' }}><strong>{child}</strong>, aged {view.child_age}, has joined The Fluency Talks and named you, {view.guardian_name}, as their {rel}. They can't use it until you decide.</p>
            <h2 style={{ fontSize: '1.6rem', marginTop: '2rem' }}>What The Fluency Talks is</h2>
            <p className="lp-p">A community where people practise languages by writing to each other and talking on one-to-one calls. Learners move through 25 conversation topics written to suit members from 12 years old; after each call the partner scores how it went.</p>
            <h2 style={{ fontSize: '1.6rem', marginTop: '2rem' }}>How we protect members under 16</h2>
            <ul className="lp-p" style={{ paddingLeft: '1.2rem', listStyle: 'disc' }}>
              <li>Their calls are voice only: no camera on either side. Calls are never recorded.</li>
              <li>They can call adults as well as other members under 16, so that native speakers and advanced learners can assess them. Every member, adult or not, has accepted the rules below.</li>
              <li>Adults can't message them unless your child accepts the request, and adults don't see them in search or suggestions.</li>
              <li>Their date of birth is never shown. Anyone can be blocked or reported, and reports are reviewed by people.</li>
              <li>We collect only what the service needs: see the <Link to="/privacy">Privacy Policy</Link> and <Link to="/terms">Terms</Link>.</li>
            </ul>
            <h2 style={{ fontSize: '1.6rem', marginTop: '2rem' }}>The rules every member accepts</h2>
            <p className="lp-p">{LEGAL_WORDING.minor_rules}</p>
            <h2 style={{ fontSize: '1.6rem', marginTop: '2rem' }}>Your decision</h2>
            <p className="lp-p">{view.wording}</p>
            <label className="lp-p" style={{ display: 'block', marginTop: '1rem' }}>Your full name<br />
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 120))} style={{ width: '100%', minHeight: '2.75rem', padding: '.5rem .75rem', border: '1.5px solid rgb(var(--ink) / .3)', borderRadius: 3, background: 'rgb(var(--paper-2))', color: 'inherit' }} />
            </label>
            <Checkbox className="lp-p mt-4" checked={adult} onChange={setAdult}>I am 18 or older and I am {child}'s parent or legal guardian.</Checkbox>
            <Checkbox className="lp-p mt-3" checked={rules} onChange={setRules}>I have read the rules about members under 16, and I understand that {child} can take voice calls with adults.</Checkbox>
            <FormError className="lp-p">{error}</FormError>
            <p style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', marginTop: '1.5rem' }}>
              <button type="button" className="lp-btn lp-btn--accent" disabled={busy} onClick={() => void decide('confirm')}>I agree</button>
              {!sureDecline && <button type="button" className="lp-btn lp-btn--ghost" disabled={busy} onClick={() => setSureDecline(true)}>I don't agree</button>}
            </p>
            {sureDecline && (
              <div style={{ marginTop: '1rem' }}>
                <p className="lp-p">If you don't agree, {child}'s account and everything in it are deleted straight away. This can't be undone.</p>
                <p style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', marginTop: '.75rem' }}>
                  <button type="button" className="lp-btn lp-btn--danger" disabled={busy} onClick={() => void decide('decline')}>Don't agree and delete the account</button>
                  <button type="button" className="lp-btn lp-btn--ghost" disabled={busy} onClick={() => setSureDecline(false)}>Go back</button>
                </p>
              </div>)}
            <p className="lp-p" style={{ fontSize: '.9rem', marginTop: '1rem' }}>This link works until {new Date(view.expires_at).toLocaleDateString()}. If you agree, you can withdraw from this same link at any time.</p>
          </>
        )}
        {view && view.status === 'confirmed' && (
          <>
            <p className="lp-p" style={{ marginTop: '1rem' }}>Thank you. You agreed on {new Date(view.decided_at!).toLocaleDateString()}, and {child} can now use The Fluency Talks. Keep this email: its link lets you withdraw at any time.</p>
            {!sureWithdraw
              ? <p><button type="button" className="lp-btn lp-btn--ghost" onClick={() => setSureWithdraw(true)}>Withdraw my permission</button></p>
              : <>
                  <p className="lp-p">Withdrawing ends any call and deletes {child}'s account and everything in it straight away. This can't be undone.</p>
                  <FormError className="lp-p">{error}</FormError>
                  <p><button type="button" className="lp-btn lp-btn--danger" disabled={busy} onClick={() => void decide('withdraw')}>Withdraw and delete the account</button></p>
                </>}
          </>
        )}
        {view && (view.status === 'declined' || view.status === 'withdrawn') && (
          <p className="lp-p" style={{ marginTop: '1rem' }}>
            {view.status === 'declined' ? "You didn't agree" : 'You withdrew your permission'}, so {child}'s account and everything in it {view.account_deleted === false ? 'are being deleted' : 'have been deleted'}. Nothing more is needed from you. We keep only a record of your decision, as the law requires.
          </p>)}
        {view && view.status === 'expired' && <p className="lp-p" style={{ marginTop: '1rem' }}>This link has expired. {child} can send you a new one from the app.</p>}
      </div>
    </PublicShell>
  );
}
