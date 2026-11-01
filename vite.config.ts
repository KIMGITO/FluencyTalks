import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode, isSsrBuild }) => {
  // The prerender build (scripts/prerender.mjs) only renders public pages and never calls Supabase,
  // but the client is created at import time, so give it placeholder keys when CI has no .env.
  const env = loadEnv(mode, process.cwd());
  const ssrDefine = isSsrBuild ? {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || 'http://localhost:54321'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || 'prerender'),
  } : {};
  return { plugins: [react()], resolve: { alias: { '@': path.resolve(__dirname, 'src') } }, define: ssrDefine };
});
