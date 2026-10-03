import { IMG } from '@/theme/theme';
import LegalLayout, { P, Bullets } from '@/components/legal/LegalLayout';

const sections = [
  { id: 'collect', short: 'What we collect', tagline: 'Information we collect', heading: 'Transparent data collection', img: IMG.friends, tint: '#fff0ea', side: 'left',
    body: (<><P>We collect what you give us when you create an account, practise a language or chat with a partner.</P>
      <Bullets items={[['Account and profile:', 'email, username, avatar, native and target languages.'], ['Messages and content:', 'practice messages, translated phrases, audio clips and saved vocabulary.'], ['Technical data:', 'IP address, device type, browser settings and usage analytics.']]} /></>) },
  { id: 'use', short: 'How we use it', tagline: 'How we use your data', heading: 'Empowering your fluency', img: IMG.online, tint: '#f0f7ff', side: 'right',
    body: (<><P>Every piece of data has a purpose.</P>
      <Bullets items={[['Core service:', 'partner matching, real-time chat and AI practice tutors.'], ['Safety:', 'preventing spam and abuse, and enforcing our terms.'], ['Notifications:', 'practice reminders, partner messages and security updates.']]} /></>) },
  { id: 'sharing', short: 'Sharing', tagline: 'Third parties', heading: 'Trusted infrastructure partners', img: IMG.talk, tint: '#f3f0ff', side: 'left',
    body: (<><P>We never sell your personal information. We share data only with the providers that run the service.</P>
      <Bullets items={[['Supabase:', 'encrypted database and sign-in.'], ['Translation APIs:', 'secure translation processing (for example MyMemory).']]} /></>) },
  { id: 'trust', short: 'Our promise', tagline: 'Privacy first', heading: 'Your conversations are built on trust', img: IMG.hero, tint: '#e8f8f5', side: 'right',
    body: <P>Your chats are yours. We collect only what we need, protect it carefully and never use it to sell advertising.</P> },
  { id: 'rights', short: 'Your rights', tagline: 'Retention and rights', heading: 'Complete control in your hands', img: IMG.team, tint: '#fef9e7', side: 'left',
    body: (<><P>You own your data at all times. We follow GDPR and CCPA principles.</P>
      <Bullets items={[['Export:', 'download your chat history from account settings.'], ['30-day purge:', 'deleting your account removes all profile data within 30 days.']]} /></>) },
];

export default function Privacy() {
  return <LegalLayout title="Privacy Policy" active="/privacy" updated="3 October 2026" sections={sections} />;
}