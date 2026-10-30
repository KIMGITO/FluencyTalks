import { useRef } from 'react';
import Header from './Header';
import Footer from './Footer';
import { useReveal } from './useReveal';

/** Header + page + footer, with the landing look. Every public page (home, legal, sign-in, 404) is wrapped in this. */
export default function PublicShell({ children, mainClassName = '' }) {
  const root = useRef(null);
  useReveal(root);
  return (
    <div className="lp" ref={root}>
      <Header />
      <main id="main" className={mainClassName}>{children}</main>
      <Footer />
    </div>
  );
}
