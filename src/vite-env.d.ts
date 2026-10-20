/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_TRANSLATE_EMAIL?: string;
  /** General enquiries — info@thefluencytalks.com */
  readonly VITE_EMAIL_INFO?: string;
  /** Help & account support — support@thefluencytalks.com */
  readonly VITE_EMAIL_SUPPORT?: string;
  /** Urgent safety / compromised accounts — security@thefluencytalks.com */
  readonly VITE_EMAIL_SECURITY?: string;
  /** Abuse / harassment reports — report@thefluencytalks.com */
  readonly VITE_EMAIL_REPORT?: string;
  /** Terms questions — terms@thefluencytalks.com (recommended inbox) */
  readonly VITE_EMAIL_TERMS?: string;
  /** Privacy / GDPR / deletion requests — privacy@thefluencytalks.com (recommended inbox) */
  readonly VITE_EMAIL_PRIVACY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

