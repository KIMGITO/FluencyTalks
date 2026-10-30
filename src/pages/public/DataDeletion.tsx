import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LegalLayout, { P, Bullets } from '@/components/legal/LegalLayout';
import { useSeo } from '@/hooks/useSeo';
import { deleteAccount } from '@/services/account';
import { useAuthStore } from '@/store/authStore';
import { EMAILS, mailto } from '@/lib/emails';

/**
 * Real deletion. Signed-in people delete their own account here (the same call as their profile page);
 * everyone else is told how to ask by email. There is no "request form": nothing here pretends to send a message.
 */
function DeleteAction() {
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const signOut = useAuthStore((s) => s.signOut);
  const nav = useNavigate();
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading) return null;
  if (!user) {
    return (
      <>
        <P>To delete your account yourself, log in first. That is how we know the request really comes from you.</P>
        <p className="lp-p" style={{ marginTop: '1.1rem' }}><Link to="/login" className="lp-btn lp-btn--accent">Log in to continue</Link></p>
      </>
    );
  }
  const remove = async () => {
    setBusy(true); setError('');
    try { await deleteAccount(); await signOut(); nav('/', { replace: true }); }
    catch (e) { setError((e as Error).message || 'We could not delete your account. Please try again, or write to us.'); setBusy(false); }
  };
  return (
    <div>
      <P>You are logged in as <strong>{user.email}</strong>. Deleting is permanent and cannot be undone.</P>
      <label style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-start', margin: '1.1rem 0' }}>
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} style={{ marginTop: '.4rem', width: '1.15rem', height: '1.15rem' }} />
        <span>I understand that my account, messages and saved phrases will be deleted for good.</span>
      </label>
      {error && <p role="alert" style={{ color: 'rgb(var(--c-danger))', marginBottom: '.75rem' }}>{error}</p>}
      <button type="button" className="lp-btn lp-btn--danger" disabled={!sure || busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete my account now'}</button>
    </div>
  );
}

const sections = [
  { id: 'what', short: 'What is deleted', tagline: 'Before you go', heading: 'What deleting your account does', body: (<><P>It happens straight away, and it is permanent.</P>
      <Bullets items={[['Removed:', 'your profile and photo, the messages you sent (they disappear from your partners’ chats too), your corrections, saved phrases, translation history, points and saved partners.'], ['Kept:', 'reports other people made about you, so safety work is not undone. They are kept without your account attached.'], ['Want a copy first?', 'Download your data from Settings before you delete.']]} /></>) },
  { id: 'delete', short: 'Delete it yourself', tagline: 'The quick way', heading: 'Delete your account', body: <DeleteAction /> },
  { id: 'email', short: 'Cannot log in?', tagline: 'By email', heading: 'Ask us to do it', body: (<><P>If you cannot log in, write to <a href={mailto(EMAILS.privacy, { subject: 'Delete my account' })}>{EMAILS.privacy}</a> from the email address on the account. We check the request is yours and delete the account. We aim to reply within 72 hours.</P>
      <P>Worried about harassment or safety? Say so in the email and we will look at that first.</P></>) },
];

export default function DataDeletion() {
  useSeo({ title: 'Delete my data', description: 'How to delete your The Fluency Talks account and what happens to your data.', path: '/data-deletion' });
  return <LegalLayout title="Delete my data" active="/data-deletion" updated="24 October 2026" contact={EMAILS.privacy} sections={sections} />;
}
