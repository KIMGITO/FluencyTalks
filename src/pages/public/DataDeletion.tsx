import { useState } from 'react';
import { IMG } from '@/theme/theme';
import { Input, Button } from '@/components/ui';
import LegalLayout, { P, Bullets } from '@/components/legal/LegalLayout';
import { useSeo } from '@/hooks/useSeo';
import { EMAILS, mailto } from '@/lib/emails';

function DeleteForm() {
  const [email, setEmail] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      // TODO: connect to your backend, e.g. supabase.functions.invoke('delete-request', { body: { email } })
      await new Promise((r) => setTimeout(r, 600));
      setDone(true);
    } finally { setBusy(false); }
  };

  if (done) return <P>Thanks. We have sent a confirmation link to <strong>{email}</strong>. Open it within 24 hours to finish your request.</P>;
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 14, maxWidth: 420 }}>
      <Input id="del-email" type="email" label="Account email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 15, lineHeight: 1.5 }}>
        <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} required style={{ marginTop: 4, width: 18, height: 18 }} />
        I understand this permanently deletes my account and cannot be undone.
      </label>
      <Button type="submit" loading={busy} disabled={!sure}>Request deletion</Button>
    </form>
  );
}

const sections = [
  { id: 'what', short: 'What is deleted', tagline: 'Before you go', heading: 'What deleting your account does', img: IMG.team, tint: '#fef9e7', side: 'left',
    body: (<Bullets items={[['Removed:', 'your profile, messages, saved phrases and audio clips.'], ['Within 30 days:', 'all remaining copies are purged from our systems.'], ['Kept briefly:', 'minimal records we are legally required to retain, such as safety reports.']]} />) },
  { id: 'request', short: 'Request deletion', tagline: 'Delete my data', heading: 'Request account deletion', img: IMG.friends, tint: '#fff0ea', side: 'right', body: <DeleteForm /> },
  { id: 'after', short: 'What happens next', tagline: 'Next steps', heading: 'After you submit', img: IMG.hero, tint: '#e8f8f5', side: 'left',
    body: (<><P>We email you a confirmation link. Once you open it, your account is deactivated straight away.</P><P>Changed your mind? Log in within 7 days to cancel the request.</P></>) },
];

export default function DeleteRequest() {
  useSeo({ title: 'Delete my data', description: 'Request deletion of your The Fluency Talks account and data. What is removed, what happens next, and email alternative.', path: '/data-deletion' });
  return (
    <LegalLayout
      title="Delete my data"
      active="/data-deletion"
      updated="3 October 2026"
      contact={EMAILS.privacy}
      sections={[
        ...sections,
        {
          id: 'email',
          short: 'Email us',
          tagline: 'Prefer email',
          heading: 'Request deletion by email',
          img: IMG.online,
          tint: '#f0f7ff',
          side: 'right',
          body: (
            <>
              <P>
                Prefer email? Write to{' '}
                <a href={mailto(EMAILS.privacy, { subject: 'Delete my data' })}>
                  {EMAILS.privacy}
                </a>{' '}
                from your account email and we will confirm within 72 hours.
              </P>
              <P>
                Safety issue? Contact{' '}
                <a href={mailto(EMAILS.security, { subject: 'Safety concern' })}>
                  {EMAILS.security}
                </a>
                . To flag abuse outside the app, write to{' '}
                <a href={mailto(EMAILS.report, { subject: 'Report abuse' })}>
                  {EMAILS.report}
                </a>
                .
              </P>
            </>
          ),
        },
      ]}
    />
  );
}