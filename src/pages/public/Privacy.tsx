import LegalLayout, { P, Bullets } from '@/components/legal/LegalLayout';
import { useSeo } from '@/hooks/useSeo';
import { EMAILS } from '@/lib/emails';

const sections = [
  { id: 'collect', short: 'What we collect', tagline: 'Information we collect', heading: 'Transparent data collection', body: (<><P>We collect what you give us when you create an account, practise a language or chat with a partner.</P>
      <Bullets items={[['Account and profile:', 'email, username, avatar, native and target languages.'], ['Messages and content:', 'the messages you send, corrections, translated phrases and saved vocabulary.'], ['Contributions:', 'your posts, the corrections and replies you write, and the decisions you make on them, which stay in the discussion history. If you delete your account your name is removed from what you wrote elsewhere.'], ['Activity:', 'when you were last active, unless you turn this off in Settings, and the level your activity has earned.'], ['Technical data:', 'IP address, device type, browser settings and usage analytics.']]} /></>) },
  { id: 'use', short: 'How we use it', tagline: 'How we use your data', heading: 'Empowering your fluency', body: (<><P>Every piece of data has a purpose.</P>
      <Bullets items={[['Core service:', 'partner matching, real-time chat and conversation practice.'], ['Safety:', 'preventing spam and abuse, and enforcing our terms.'], ['Notifications:', 'practice reminders, partner messages and security updates.']]} /></>) },
  { id: 'sharing', short: 'Sharing', tagline: 'Third parties', heading: 'Trusted infrastructure partners', body: (<><P>We never sell your personal information. We share data only with the providers that run the service.</P>
      <Bullets items={[['Supabase:', 'encrypted database and sign-in.'], ['Translation:', 'the text you ask to translate is sent to a translation service (MyMemory).'],
        ['Image search:', 'when you search for a picture for a phrase, your search words are sent to Unsplash through our server. Your name and account are not.'],
        ['Archive storage:', 'an independent provider holds the write-once copy of our archived records.']]} />
      <P>Our database is hosted outside Vietnam, in the European Union (Ireland).</P></>) },
  { id: 'trust', short: 'Our promise', tagline: 'Privacy first', heading: 'Your conversations are built on trust', body: <P>Your chats are yours. We collect only what we need, protect it carefully and never use it to sell advertising.</P> },
  { id: 'retention', short: 'How long we keep it', tagline: 'Retention schedule', heading: 'How long we keep your data', body: (<><P>We keep each kind of data only as long as its purpose needs, or as the law requires. When a period ends, the data is permanently destroyed.</P>
      <Bullets items={[['Your account and content:', 'profile, messages, posts, saved phrases, translation history and points stay until you delete them or your account.'],
        ['Read notifications:', '180 days after you read them. Unread ones stay until you read them or delete your account.'],
        ['Application logs:', '13 months, as Vietnamese cybersecurity rules require system logs to be kept for at least 12 months. For the first 30 days they stay in our database, then they move to private archive storage.'],
        ['Safety reports, moderation decisions, restrictions and appeals:', '3 years from the decision, so they can be explained if someone challenges them. For the first year they stay in our database, then they move to private archive storage.'],
        ['Records of what our staff do:', '5 years. For the first year they stay in our database, then they move to private archive storage.'],
        ['Proof of your consent:', 'kept permanently, including after you delete your account, because the law makes us responsible for proving consent. It holds only your account number, a scrambled (hashed) copy of your email address, what you agreed to and when.']]} />
      <P>We may keep a specific record for longer if the law requires it, if a competent authority orders it, or if it is needed for a legal claim.</P></>) },
  { id: 'archive', short: 'Protecting records', tagline: 'Tamper-proof records', heading: 'How we protect archived records', body: <P>Archived records are copied to write-once storage with an independent provider, where they cannot be changed or deleted before their date, even by us. Each record is linked to the one before it, so a change to our own copy can be detected. Archived records do not show your user account number: they use a random code instead, and deleting your account removes the link between that code and you. Words someone typed, such as the text of a reported message, stay as written. Proof of consent is the exception: it keeps your account number and hashed email, because it has to be able to show who agreed.</P> },
  { id: 'rights', short: 'Your rights', tagline: 'Rights and time limits', heading: 'Complete control in your hands', body: (<><P>We follow Vietnam’s Law on Personal Data Protection (Law No. 91/2025/QH15) and Decree No. 356/2025/ND-CP.</P>
      <Bullets items={[['Export:', 'download a copy of your data from Settings at any time.'], ['Deletion:', 'deleting your account removes your profile, messages, saved phrases and points straight away. See Delete my data.'], ['Reports:', 'if someone reported you, the report is kept for safety for the period above, without your account attached.']]} />
      <P>You can also write to us about your data. We reply within 2 working days and then act within these limits:</P>
      <Bullets items={[['Seeing, correcting or getting a copy of your data:', '10 days, or 15 days if another provider has to act too.'],
        ['Withdrawing consent, or limiting or objecting to how we use your data:', '15 days, or 20 days if another provider has to act too.'],
        ['Deleting your data:', '20 days, or 30 days if another provider has to act too.'],
        ['If we need longer:', 'we can extend a limit once, by no more than the 10, 15 or 20 days above, and we will tell you why.']]} />
      <P>Withdrawing consent does not affect what we did before you withdrew it. Some records can be kept without consent where the law allows, such as to protect people’s rights and safety.</P></>) },
];

export default function Privacy() {
  useSeo({ title: 'Privacy Policy', description: 'How The Fluency Talks collects, uses, and protects your data. What we keep and for how long, your rights and time limits under Vietnamese law, data export and account deletion.', path: '/privacy' });
  return <LegalLayout title="Privacy Policy" active="/privacy" updated="3 November 2026" contact={EMAILS.privacy} sections={sections} />;
}