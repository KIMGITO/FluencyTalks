import { useState } from 'react';
import { IMG } from '@/theme/theme';
import { Input, Button } from '@/components/ui';
import LegalLayout, { P, Bullets } from '@/components/legal/LegalLayout';

function DeleteForm() {
  const [email, setEmail] = useState('');
  const [sure, setSure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e) => {
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
  return <LegalLayout title="Delete my data" active="/data-deletion" updated="3 October 2026" sections={sections} />;
}