import { IMG } from '@/theme/theme';
import LegalLayout, { P, Bullets } from '@/components/legal/LegalLayout';

const sections = [
  { id: 'accept', short: 'Using FluencyTalks', tagline: 'Acceptance', heading: 'The basics', img: IMG.talk, tint: '#f0f7ff', side: 'left',
    body: (<><P>By creating an account you agree to these terms. You must be 13 or older, and the details you give us must be accurate.</P><P>You are responsible for activity on your account, so keep your password private.</P></>) },
  { id: 'conduct', short: 'Community rules', tagline: 'Conduct', heading: 'Be a good conversation partner', img: IMG.friends, tint: '#fff0ea', side: 'right',
    body: (<Bullets items={[['Be respectful:', 'no harassment, hate speech or discrimination.'], ['Stay safe:', 'no spam, scams or sharing other people’s private details.'], ['Be yourself:', 'no impersonation or fake profiles.']]} />) },
  { id: 'content', short: 'Your content', tagline: 'Content', heading: 'You own what you write', img: IMG.online, tint: '#f3f0ff', side: 'left',
    body: (<P>You keep ownership of your messages and recordings. You give us permission to store and display them only so the service works, for example showing a message to your partner.</P>) },
  { id: 'end', short: 'Ending and liability', tagline: 'Termination', heading: 'Leaving, and our limits', img: IMG.team, tint: '#fef9e7', side: 'right',
    body: (<><P>You can delete your account at any time. We may suspend accounts that break these rules.</P><P>FluencyTalks is provided as is. We are not responsible for what members say to each other, but we act quickly on reports.</P></>) },
];

export default function Terms() {
  return <LegalLayout title="Terms of Service" active="/terms" updated="3 October 2026" sections={sections} />;
}