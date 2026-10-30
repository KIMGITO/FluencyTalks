import LegalLayout, { P, Bullets } from '@/components/legal/LegalLayout';
import { useSeo } from '@/hooks/useSeo';
import { EMAILS } from '@/lib/emails';

const sections = [
  { id: 'collect', short: 'What we collect', tagline: 'Information we collect', heading: 'Transparent data collection', body: (<><P>We collect what you give us when you create an account, practise a language or chat with a partner.</P>
      <Bullets items={[['Account and profile:', 'email, username, avatar, native and target languages.'], ['Messages and content:', 'the messages you send, corrections, translated phrases and saved vocabulary.'], ['Technical data:', 'IP address, device type, browser settings and usage analytics.']]} /></>) },
  { id: 'use', short: 'How we use it', tagline: 'How we use your data', heading: 'Empowering your fluency', body: (<><P>Every piece of data has a purpose.</P>
      <Bullets items={[['Core service:', 'partner matching, real-time chat and conversation practice.'], ['Safety:', 'preventing spam and abuse, and enforcing our terms.'], ['Notifications:', 'practice reminders, partner messages and security updates.']]} /></>) },
  { id: 'sharing', short: 'Sharing', tagline: 'Third parties', heading: 'Trusted infrastructure partners', body: (<><P>We never sell your personal information. We share data only with the providers that run the service.</P>
      <Bullets items={[['Supabase:', 'encrypted database and sign-in.'], ['Translation:', 'the text you ask to translate is sent to a translation service (MyMemory).'],
        ['Image search:', 'when you search for a picture for a phrase, your search words are sent to Unsplash through our server. Your name and account are not.']]} /></>) },
  { id: 'trust', short: 'Our promise', tagline: 'Privacy first', heading: 'Your conversations are built on trust', body: <P>Your chats are yours. We collect only what we need, protect it carefully and never use it to sell advertising.</P> },
  { id: 'rights', short: 'Your rights', tagline: 'Retention and rights', heading: 'Complete control in your hands', body: (<><P>You own your data at all times. We follow GDPR and CCPA principles.</P>
      <Bullets items={[['Export:', 'download a copy of your data from Settings.'], ['Deletion:', 'deleting your account removes your profile, messages, saved phrases and points straight away. See Delete my data.'], ['Reports:', 'if someone reported you, the report is kept for safety, without your account attached.']]} /></>) },
];

export default function Privacy() {
  useSeo({ title: 'Privacy Policy', description: 'How The Fluency Talks collects, uses, and protects your data. GDPR and CCPA principles, data export and account deletion.', path: '/privacy' });
  return <LegalLayout title="Privacy Policy" active="/privacy" updated="24 October 2026" contact={EMAILS.privacy} sections={sections} />;
}