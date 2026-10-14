/**
 * The shared page for the site's legal texts — Terms and Conditions, Privacy Policy.
 *
 * The same chrome as the landing page (header, footer, `mge-` styling). The wording is the
 * business's; each page keeps it as a list of `LegalSection`s so a change to it is a change to
 * text, not to markup.
 */
import { useEffect, type ReactNode } from 'react';
import { LandingFooter, LandingHeader } from './LandingShell';
import './landing.css';

export const SUPPORT_EMAIL = 'admin@futuregeninnovation.com';
export const WEBSITE = 'www.mygovexams.com';

export interface LegalSection {
  title: string;
  /** Paragraphs, shown before any `points`. */
  body?: ReactNode[];
  /** A bulleted list. */
  points?: string[];
}

/** The closing "Contact Us" section — the same address and website on every legal page. */
export function contactSection(intro: string): LegalSection {
  return {
    title: 'Contact Us',
    body: [
      intro,
      <>
        <strong>Email:</strong> <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </>,
      <>
        <strong>Website:</strong>{' '}
        <a href={`https://${WEBSITE}`} target="_blank" rel="noopener noreferrer">
          {WEBSITE}
        </a>
      </>,
    ],
  };
}

interface LegalPageProps {
  title: string;
  /** Shown as "Effective Date: …". */
  effective: string;
  /** The opening paragraph, before the first numbered section. */
  lead: string;
  sections: LegalSection[];
}

export default function LegalPage({ title, effective, lead, sections }: LegalPageProps) {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} | MyGovExams`;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="mge">
      <LandingHeader onLanding={false} />
      <main className="mge-legal-main">
        <div className="mge-container">
          <article className="mge-legal">
            <h1>{title}</h1>
            <p className="mge-legal-date">Effective Date: {effective}</p>
            <p className="mge-legal-lead">{lead}</p>
            {sections.map((s, i) => (
              <section key={s.title}>
                <h2>
                  {i + 1}. {s.title}
                </h2>
                {s.body?.map((p, j) => <p key={j}>{p}</p>)}
                {s.points && (
                  <ul>
                    {s.points.map(p => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
          </article>
        </div>
      </main>
      <LandingFooter />
    </div>
  );
}
