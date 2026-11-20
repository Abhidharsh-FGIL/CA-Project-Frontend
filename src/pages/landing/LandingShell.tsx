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
import { useSupport } from '@/content/support';
import { useT } from '@/content';
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
  const support = useSupport();
  const t = useT();
  return (
    <footer className="mge-footer">
      <div className="mge-container mge-footer-top">
        <div className="mge-footer-brand">
          <LogoFull className="mge-footer-logo" />
          <p className="mge-footer-tagline">{t('landing.footer.tagline')}</p>
          <p className="mge-footer-blurb">{t('landing.footer.blurb')}</p>
        </div>
        <nav className="mge-footer-col" aria-label="Quick links">
          <h5>{t('landing.footer.quick')}</h5>
          <SectionLink to="home" onLanding={onLanding}>
            {t('landing.nav.home')}
          </SectionLink>
          <SectionLink to="pricing" onLanding={onLanding}>
            {t('landing.nav.pricing')}
          </SectionLink>
          <Link to={ROUTES.login}>{t('landing.nav.login')}</Link>
          <Link to={ROUTES.signup}>{t('landing.nav.cta')}</Link>
        </nav>
        <nav className="mge-footer-col" aria-label="Legal">
          <h5>{t('landing.footer.legal')}</h5>
          <Link to="/terms">Terms &amp; Conditions</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/refund">Refund Policy</Link>
        </nav>
        <div className="mge-footer-col">
          <h5>{t('landing.footer.contact')}</h5>
          <a href={`mailto:${support.email}`} className="mge-footer-contact">
            <Mail size={16} aria-hidden="true" /> {support.email}
          </a>
          <a href={`tel:${support.phoneLink}`} className="mge-footer-contact">
            <Phone size={16} aria-hidden="true" /> {support.phone}
          </a>
        </div>
      </div>
      <div className="mge-footer-bottom">
        <div className="mge-container">
          <span>{t('landing.footer.copy', { year: new Date().getFullYear() })}</span>
          <span>{t('landing.footer.powered')}</span>
        </div>
      </div>
    </footer>
  );
}

export function LandingHeader({ onLanding = true }: { onLanding?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <header className="mge-header">
      <div className="mge-container mge-nav">
        <SectionLink to="home" className="mge-logo" onLanding={onLanding}>
          <LogoFull className="mge-logo-full" />
        </SectionLink>
        <nav className={open ? 'mge-nav-links mge-open' : 'mge-nav-links'} aria-label="Main navigation">
          <SectionLink to="home" onNavigate={() => setOpen(false)} onLanding={onLanding}>
            {t('landing.nav.home')}
          </SectionLink>
          <SectionLink to="pricing" onNavigate={() => setOpen(false)} onLanding={onLanding}>
            {t('landing.nav.pricing')}
          </SectionLink>
          <Link className="mge-login" to={ROUTES.login} onClick={() => setOpen(false)}>
            {t('landing.nav.login')}
          </Link>
          <ButtonLink to={ROUTES.signup}>
            {t('landing.nav.cta')} <ArrowRight size={16} />
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
