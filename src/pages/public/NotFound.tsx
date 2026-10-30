import { Link } from 'react-router-dom';
import { PublicShell } from '@/components/landing';
import { useSeo } from '@/hooks/useSeo';
import { BRAND } from '@/lib/site';
import '@/styles/landing.css';

export default function NotFound() {
  useSeo({ title: 'Page not found', description: `The page you asked for does not exist on ${BRAND}.`, path: '/404', noIndex: true });
  return (
    <PublicShell mainClassName="lp-lost">
      <p className="lp-lost__n" aria-hidden="true">4<i>0</i>4</p>
      <h1>This page wandered off</h1>
      <p>That link does not lead anywhere. It may have moved, or the address has a typo.</p>
      <Link to="/" className="lp-btn lp-btn--accent">Back to {BRAND}</Link>
    </PublicShell>
  );
}
