import { LegalPage } from './LegalPage';

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      summary="This policy explains what information FluencyTalks collects, how we use it, and the choices you have. It applies to everyone who uses the FluencyTalks app and website."
      sections={[
        { heading: 'Information we collect', body: <p>Placeholder — account details (email, username, profile, languages), the messages and phrases you send, and basic usage data. Add the full list here.</p> },
        { heading: 'How we use your information', body: <p>Placeholder — to provide the service (messaging, translations, notifications), keep the community safe, and improve the app. Add the full list here.</p> },
        { heading: 'Sharing and third parties', body: <p>Placeholder — we use Supabase for hosting and data storage. When you tap Translate, the message text is sent to the MyMemory translation API. Add all processors here.</p> },
        { heading: 'Data retention', body: <p>Placeholder — how long we keep messages, profiles and backups after you delete your account.</p> },
        { heading: 'Your rights', body: <p>Placeholder — you can export your data or delete your account at any time from Settings. Add regional rights (GDPR/CCPA) here.</p> },
        { heading: 'Contact us', body: <p>Questions about this policy? Email help@fluencytalks.com.</p> },
      ]}
    />
  );
}
