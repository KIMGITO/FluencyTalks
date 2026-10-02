import { LegalPage } from './LegalPage';

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      summary="These terms govern your use of FluencyTalks. By creating an account or using the app you agree to them."
      sections={[
        { heading: 'Who can use FluencyTalks', body: <p>Placeholder — you must be 18 or older and able to enter a binding agreement. Add eligibility details here.</p> },
        { heading: 'Your account', body: <p>Placeholder — keep your login credentials safe, you are responsible for activity on your account, and one account per person.</p> },
        { heading: 'Acceptable use', body: <p>Placeholder — no harassment, spam, impersonation, illegal content or attempts to disrupt the service. Add the full rules here (or link the community guidelines).</p> },
        { heading: 'Your content', body: <p>Placeholder — you keep ownership of what you post, and grant us the licence needed to operate the service.</p> },
        { heading: 'Termination', body: <p>Placeholder — we may suspend or close accounts that break these terms; you can delete your account from Settings at any time.</p> },
        { heading: 'Disclaimers and liability', body: <p>Placeholder — the service is provided "as is"; add the disclaimer and limitation-of-liability clauses here.</p> },
        { heading: 'Contact us', body: <p>Questions about these terms? Email help@fluencytalks.com.</p> },
      ]}
    />
  );
}
