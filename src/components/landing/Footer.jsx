import { Link } from 'react-router-dom';
import { Logo } from '@/components/ui';
import { EMAILS, mailto } from '@/lib/emails';
import { BRAND, SUPPORT_SUBJECT, TAGLINE } from '@/lib/site';

export default function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer__grid">
          <div className="lp-footer__brand"><Logo /><p>{TAGLINE}</p></div>
          <nav aria-label="Explore"><h4>Explore</h4><ul>
            <li><a href="#services">What you get</a></li><li><a href="#languages">Languages</a></li><li><a href="#faq">FAQ</a></li>
          </ul></nav>
          <nav aria-label="Account"><h4>Account</h4><ul>
            <li><Link to="/login">Log in</Link></li><li><Link to="/signup">Sign up</Link></li><li><Link to="/forgot-password">Forgot password</Link></li>
          </ul></nav>
          <nav aria-label="Legal and contact"><h4>Legal</h4><ul>
            <li><Link to="/privacy">Privacy</Link></li><li><Link to="/terms">Terms</Link></li><li><Link to="/data-deletion">Delete my data</Link></li>
            <li><a href={mailto(EMAILS.support, { subject: SUPPORT_SUBJECT })}>Contact</a></li>
          </ul></nav>
        </div>
        <div className="lp-footer__base">
          <span>© {new Date().getFullYear()} {BRAND}</span>
          <span>Photos from <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer">Unsplash</a></span>
        </div>
      </div>
    </footer>
  );
}
