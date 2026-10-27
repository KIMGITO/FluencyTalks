import LegalLayout, { P, Bullets } from '@/components/legal/LegalLayout';
import { useSeo } from '@/hooks/useSeo';
import { EMAILS } from '@/lib/emails';

const sections = [
  { id: 'collect', short: 'What we collect', tagline: 'Information we collect', heading: 'Transparent data collection', body: (<><P>We collect what you give us when you create an account, practise a language or chat with a partner.</P>
      <Bullets items={[['Account and profile:', 'email, username, avatar, native and target languages.'], ['Messages and content:', 'practice messages, translated phrases, audio clips and saved vocabulary.'], ['Technical data:', 'IP address, device type, browser settings and usage analytics.']]} /></>) },
  { id: 'use', short: 'How we use it', tagline: 'How we use your data', heading: 'Empowering your fluency', body: (<><P>Every piece of data has a purpose.</P>
      <Bullets items={[['Core service:', 'partner matching, real-time chat and conversation practice.'], ['Safety:', 'preventing spam and abuse, and enforcing our terms.'], ['Notifications:', 'practice reminders, partner messages and security updates.']]} /></>) },
  { id: 'sharing', short: 'Sharing', tagline: 'Third parties', heading: 'Trusted infrastructure partners', body: (<><P>We never sell your personal information. We share data only with the providers that run the service.</P>
      <Bullets items={[['Supabase:', 'encrypted database and sign-in.'], ['Translation APIs:', 'secure translation processing (for example MyMemory).']]} /></>) },
  { id: 'trust', short: 'Our promise', tagline: 'Privacy first', heading: 'Your conversations are built on trust', body: <P>Your chats are yours. We collect only what we need, protect it carefully and never use it to sell advertising.</P> },
  { id: 'rights', short: 'Your rights', tagline: 'Retention and rights', heading: 'Complete control in your hands', body: (<><P>You own your data at all times. We follow GDPR and CCPA principles.</P>
      <Bullets items={[['Export:', 'download your chat history from account settings.'], ['30-day purge:', 'deleting your account removes all profile data within 30 days.']]} /></>) },
];

export default function Privacy() {
  useSeo({ title: 'Privacy Policy', description: 'How The Fluency Talks collects, uses, and protects your data. GDPR and CCPA principles, export and 30-day purge.', path: '/privacy' });
  return <LegalLayout title="Privacy Policy" active="/privacy" updated="3 October 2026" contact={EMAILS.privacy} sections={sections} />;
}