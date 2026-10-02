import { Link } from 'react-router-dom';
import { LegalPage } from './LegalPage';

export default function DataDeletion() {
  return (
    <LegalPage
      title="Data Deletion"
      summary="You can delete your FluencyTalks account and everything we store about you at any time. This page explains how."
      placeholder="Placeholder page — confirm these steps match the final deletion flow before publishing this URL."
      sections={[
        { heading: 'Delete your account from inside the app', body: (
          <>
            <p>1. Log in to FluencyTalks.</p>
            <p>2. Go to <b>Settings</b> → <b>Delete account</b> and confirm.</p>
            <p>3. Your profile, messages, followers and phrasebook are permanently removed. This cannot be undone.</p>
            <p><Link className="text-brand underline" to="/settings">Open Settings</Link> (you need to be logged in).</p>
          </>
        ) },
        { heading: 'Export your data first', body: <p>Settings → <b>Your data</b> → <b>Export my data</b> downloads a JSON copy of everything we store about you.</p> },
        { heading: 'No account? Request deletion by email', body: <p>Email <a className="text-brand underline" href="mailto:help@fluencytalks.com">help@fluencytalks.com</a> from the address linked to your account and we will delete your data and confirm by email.</p> },
        { heading: 'What we retain', body: <p>Placeholder — describe anything kept after deletion (e.g. backups ageing out, legal obligations, aggregate analytics).</p> },
      ]}
    />
  );
}
