/**
 * What the public pages — the landing page, login and sign-up — have in common: the header and
 * the link helpers.
 *
 * They are one design (see `landing.css`), so the header is one component. It behaves a little
 * differently depending on where it is: on the landing page its links scroll to a section; on
 * any other page they go back to the landing page, to that section.
 */
import { useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import { LogoFull } from '@/components/brand/Brand';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_LINK } from '@/config/support';
import './landing.css';

/** Where login and sign-up live in this app. */
export const ROUTES = {
  login: '/user/login',
  signup: '/user/register',
};

/** Smooth-scroll to a section of the landing page. */
export function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * A link to a section of the landing page.
 *
 * On the landing page it scrolls (`#id` hrefs would be read by the HashRouter as routes). From
 * another page it navigates to `/` carrying the section in router state, which the landing page
 * scrolls to once it has rendered.
 */
export function SectionLink({
  to,
  className,
  onNavigate,
  onLanding = true,
  children,
}: {
  to: string;
  className?: string;
  onNavigate?: () => void;
  onLanding?: boolean;
  children: ReactNode;
}) {
  if (!onLanding) {
    return (
      <Link className={className} to="/" state={{ scrollTo: to }} onClick={onNavigate}>
        {children}
      </Link>
    );
  }
  const go = (e: MouseEvent) => {
    e.preventDefault();
    onNavigate?.();
    scrollToSection(to);
  };
  return (
    <a className={className} href={`#/#${to}`} onClick={go}>
      {children}
    </a>
  );
}

export function ButtonLink({
  to,
  children,
  secondary = false,
  className = '',
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <Link className={`mge-btn ${secondary ? 'mge-btn-secondary' : 'mge-btn-primary'} ${className}`} to={to}>
      {children}
    </Link>
  );
}

/** The footer of the public pages — the landing page and the terms page. */
export function LandingFooter() {
  return (
    <footer>
      <div className="mge-container mge-footer-content">
        <LogoFull className="mge-footer-logo" />
        <div className="mge-footer-meta">
          <span>
            © {new Date().getFullYear()} MyGovExams · <Link to="/terms">Terms &amp; Conditions</Link> ·{' '}
            <Link to="/privacy">Privacy Policy</Link> ·{' '}
            <Link to="/refund">Refund Policy</Link>
          </span>
          <span>
            Support: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> · <a href={`tel:${SUPPORT_PHONE_LINK}`}>{SUPPORT_PHONE}</a>
          </span>
          <span>Practice • Analyse • Improve</span>
          <span>Powered by FutureGen Innovation Lab Pvt Ltd</span>
        </div>
      </div>
    </footer>
  );
}

export function LandingHeader({ onLanding = true }: { onLanding?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="mge-header">
      <div className="mge-container mge-nav">
        <SectionLink to="home" className="mge-logo" onLanding={onLanding}>
          <LogoFull className="mge-logo-full" />
        </SectionLink>
        <nav className={open ? 'mge-nav-links mge-open' : 'mge-nav-links'} aria-label="Main navigation">
          <SectionLink to="pricing" onNavigate={() => setOpen(false)} onLanding={onLanding}>
            Pricing
          </SectionLink>
          <Link className="mge-login" to={ROUTES.login} onClick={() => setOpen(false)}>
            Login
          </Link>
          <ButtonLink to={ROUTES.signup}>
            Start Free Trial <ArrowRight size={16} />
          </ButtonLink>
        </nav>
        <button
          className="mge-menu-button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
    </header>
  );
}
