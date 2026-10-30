import type { ReactNode } from 'react';
import { PublicShell } from '@/components/landing';
import '@/styles/landing.css';

/** Log in, sign up, forgot and reset password: the same header, footer and look as the landing page. */
export const AuthLayout = ({ title, children }: { title: string; children: ReactNode }) => (
  <PublicShell mainClassName="lp-auth">
    <div className="lp-auth__card">
      <h1>{title}</h1>
      <div className="lp-auth__panel">{children}</div>
    </div>
  </PublicShell>
);
