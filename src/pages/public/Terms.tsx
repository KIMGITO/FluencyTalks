import LegalLayout, { P, Bullets } from '@/components/legal/LegalLayout';
import { useSeo } from '@/hooks/useSeo';
import { EMAILS } from '@/lib/emails';

const sections = [
  { id: 'accept', short: 'Using The Fluency Talks', tagline: 'Acceptance', heading: 'The basics', body: (<><P>By creating an account you agree to these terms. You must be 16 or older, and the details you give us must be accurate.</P><P>You are responsible for activity on your account, so keep your password private.</P></>) },
  { id: 'conduct', short: 'Community rules', tagline: 'Conduct', heading: 'Be a good conversation partner', body: (<Bullets items={[['Be respectful:', 'no harassment, hate speech or discrimination.'], ['Stay safe:', 'no spam, scams or sharing other people’s private details.'], ['Be yourself:', 'no impersonation or fake profiles.']]} />) },
  { id: 'content', short: 'Your content', tagline: 'Content', heading: 'You own what you write', body: (<P>You keep ownership of your messages and saved phrases. You give us permission to store and display them only so the service works, for example showing a message to your partner.</P>) },
  { id: 'end', short: 'Ending and liability', tagline: 'Termination', heading: 'Leaving, and our limits', body: (<><P>You can delete your account at any time. We may suspend accounts that break these rules.</P><P>The Fluency Talks is provided as is. We are not responsible for what members say to each other, but we act quickly on reports.</P></>) },
];

export default function Terms() {
  useSeo({ title: 'Terms of Service', description: 'The rules for using The Fluency Talks: accounts, community conduct, content ownership, and termination.', path: '/terms' });
  return <LegalLayout title="Terms of Service" active="/terms" updated="24 October 2026" contact={EMAILS.terms} sections={sections} />;
}