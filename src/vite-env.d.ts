/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_TRANSLATE_EMAIL?: string;
  
  readonly VITE_EMAIL_INFO?: string;
  
  readonly VITE_EMAIL_SUPPORT?: string;
  
  readonly VITE_EMAIL_SECURITY?: string;
  
  readonly VITE_EMAIL_REPORT?: string;
  
  readonly VITE_EMAIL_TERMS?: string;
  
  readonly VITE_EMAIL_PRIVACY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

