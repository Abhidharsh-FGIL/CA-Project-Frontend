/**
 * The shared frame of the login and sign-up pages: the landing header, a two-column body
 * (the form card, and a picture), and the icon-led fields both forms use.
 *
 * Styling is `auth.css` on top of `landing/landing.css` — the same scoped, `mge-` prefixed
 * design as the landing page, so the three read as one site.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { EARLIEST_DOB, PICK_ONLY } from '@/lib/date-pick-only';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { LandingHeader } from '@/pages/landing/LandingShell';
import '@/pages/landing/landing.css';
import './auth.css';

/** Where the artwork lives — `public/landing/`, shared with the landing page. */
const ART = `${import.meta.env.BASE_URL}landing/`;

export function AuthLayout({
  title,
  side,
  below,
  tight = false,
  children,
}: {
  /** The browser tab title. */
  title: string;
  /** The right-hand column. Hidden on narrow screens, where the form comes first and alone. */
  side?: ReactNode;
  /** A row under both columns. */
  below?: ReactNode;
  /** Draw the two columns together in the middle of the page, rather than out to its edges. */
  tight?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);

  return (
    <div className="mge mge-auth">
      <LandingHeader onLanding={false} />
      <main className="mge-auth-main">
        <div className="mge-container">
          <div
            className={
              !side ? 'mge-auth-grid mge-auth-grid-single' : tight ? 'mge-auth-grid mge-auth-grid-tight' : 'mge-auth-grid'
            }
          >
            <div className="mge-auth-col">{children}</div>
            {side && <aside className="mge-auth-side">{side}</aside>}
          </div>
          {below}
        </div>
      </main>
    </div>
  );
}

/**
 * A picture from `public/landing/`, falling back to another if it is not there.
 *
 * The sign-up page wants its own artwork (`signup.png`). Until that file is added it shows the
 * login artwork rather than a broken image, so dropping the file in is all it takes.
 */
export function ArtImage({ name, fallback, alt = '' }: { name: string; fallback?: string; alt?: string }) {
  const [src, setSrc] = useState(`${ART}${name}`);
  return (
    <img
      className="mge-auth-art"
      src={src}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      onError={() => {
        if (fallback && src !== `${ART}${fallback}`) setSrc(`${ART}${fallback}`);
      }}
    />
  );
}

interface FieldProps {
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  /** The placeholder, and the accessible name when there is no `label`. */
  placeholder?: string;
  /** A small caption inside the box, above the value — for fields whose value is not typed. */
  label?: string;
  error?: string;
  hint?: string;
  type?: string;
  /** The latest value a date box accepts, as `YYYY-MM-DD`. */
  max?: string;
  maxLength?: number;
  required?: boolean;
  /** Shown but not editable — the email of a Google account, which is what the account is made for. */
  readOnly?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'tel' | 'email';
  /** Something at the right edge of the box — a show / hide button. */
  trailing?: ReactNode;
  /** When the box loses focus — what a form uses to start checking a field once it has been visited. */
  onBlur?: () => void;
}

export function AuthField({
  icon: Icon,
  value,
  onChange,
  placeholder,
  label,
  error,
  hint,
  type = 'text',
  max,
  maxLength,
  required,
  readOnly,
  autoComplete,
  inputMode,
  trailing,
  onBlur,
}: FieldProps) {
  const id = useId();
  return (
    <div className="mge-field">
      <div className={`mge-input${label ? ' mge-input-labelled' : ''}${error ? ' mge-input-error' : ''}`}>
        <Icon className="mge-input-icon" aria-hidden="true" />
        {label && (
          <label className="mge-input-label" htmlFor={id}>
            {label}
          </label>
        )}
        <input
          id={id}
          type={type}
          value={value}
          max={max}
          min={type === 'date' ? EARLIEST_DOB : undefined}
          maxLength={maxLength}
          required={required}
          readOnly={readOnly}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder={placeholder}
          aria-label={label ? undefined : placeholder}
          aria-invalid={error ? true : undefined}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          // A date is picked from the calendar, never typed.
          {...(type === 'date' ? PICK_ONLY : {})}
        />
        {trailing && <span className="mge-input-trailing">{trailing}</span>}
      </div>
      {error ? <p className="mge-field-error">{error}</p> : hint ? <p className="mge-field-hint">{hint}</p> : null}
    </div>
  );
}

export function AuthSelect({
  icon: Icon,
  value,
  onChange,
  label,
  placeholder,
  options,
  error,
}: {
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
  /** Plain strings when the value is the label; pairs when they differ. */
  options: (string | { value: string; label: string; disabled?: boolean })[];
  error?: string;
}) {
  const id = useId();
  const items = options.map(o => (typeof o === 'string' ? { value: o, label: o, disabled: false } : { disabled: false, ...o }));
  return (
    <div className="mge-field">
      <div className={`mge-input mge-input-labelled${error ? ' mge-input-error' : ''}${value ? '' : ' mge-input-empty'}`}>
        <Icon className="mge-input-icon" aria-hidden="true" />
        <label className="mge-input-label" htmlFor={id}>
          {label}
        </label>
        <select id={id} value={value} aria-invalid={error ? true : undefined} onChange={e => onChange(e.target.value)}>
          <option value="" disabled>
            {placeholder}
          </option>
          {items.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="mge-input-chevron" aria-hidden="true" />
      </div>
      {error && <p className="mge-field-error">{error}</p>}
    </div>
  );
}

/** A centred dialog over a dimmed page, in the same design as the form card. */
export function AuthModal({ children }: { children: ReactNode }) {
  return (
    <div className="mge-modal-backdrop" role="dialog" aria-modal="true">
      <div className="mge-modal">{children}</div>
    </div>
  );
}
