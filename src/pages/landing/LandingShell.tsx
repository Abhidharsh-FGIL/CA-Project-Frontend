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
import { ArrowRight, Mail, Menu, Phone, X } from 'lucide-react';
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
export function LandingFooter({ onLanding = true }: { onLanding?: boolean }) {
  return (
    <footer className="mge-footer">
      <div className="mge-container mge-footer-top">
        <div className="mge-footer-brand">
          <LogoFull className="mge-footer-logo" />
          <p className="mge-footer-tagline">Practice • Analyze • Improve</p>
          <p className="mge-footer-blurb">
            AI-powered mock tests, unit-wise practice and performance insights for government exam aspirants.
          </p>
        </div>
        <nav className="mge-footer-col" aria-label="Quick links">
          <h5>Quick Links</h5>
          <SectionLink to="home" onLanding={onLanding}>
            Home
          </SectionLink>
          <SectionLink to="pricing" onLanding={onLanding}>
            Pricing
          </SectionLink>
          <Link to={ROUTES.login}>Login</Link>
          <Link to={ROUTES.signup}>Start Free Trial</Link>
        </nav>
        <nav className="mge-footer-col" aria-label="Legal">
          <h5>Legal</h5>
          <Link to="/terms">Terms &amp; Conditions</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/refund">Refund Policy</Link>
        </nav>
        <div className="mge-footer-col">
          <h5>Contact Us</h5>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="mge-footer-contact">
            <Mail size={16} aria-hidden="true" /> {SUPPORT_EMAIL}
          </a>
          <a href={`tel:${SUPPORT_PHONE_LINK}`} className="mge-footer-contact">
            <Phone size={16} aria-hidden="true" /> {SUPPORT_PHONE}
          </a>
        </div>
      </div>
      <div className="mge-footer-bottom">
        <div className="mge-container">
          <span>© {new Date().getFullYear()} MyGovExams. All rights reserved.</span>
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
          <SectionLink to="home" onNavigate={() => setOpen(false)} onLanding={onLanding}>
            Home
          </SectionLink>
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
