/**
 * Illustrated icons for the landing page.
 *
 * Two-tone, drawn on a 48 × 48 grid: a soft tint for the body, a strong stroke for the outline,
 * and one accent colour for the detail that says what the icon is about (the ticks, the
 * sparkle, the done badge). The line icons used elsewhere on the page are fine at 24px beside
 * a label, but at the size a step heading wants they read as generic; these carry the meaning.
 *
 * Decorative: each is `aria-hidden`, since the heading beside it already says what it is.
 */
import type { SVGProps } from 'react';

export type LandingIcon = (props: { size?: number }) => JSX.Element;

function Icon({ size = 36, children, ...rest }: { size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Choose a test — a clipboard with a ticked list. */
export const ChooseTestIcon: LandingIcon = ({ size }) => (
  <Icon size={size}>
    <rect x="9" y="8" width="30" height="35" rx="5" fill="#cfe2fb" stroke="#2f7fe0" />
    <rect x="17" y="4" width="14" height="9" rx="3" fill="#2f7fe0" stroke="#2f7fe0" />
    <path d="M15 22.5l2.4 2.4 4.2-4.6" stroke="#1fae71" />
    <path d="M26 22.5h8" stroke="#2f7fe0" />
    <path d="M15 31.5l2.4 2.4 4.2-4.6" stroke="#1fae71" />
    <path d="M26 31.5h8" stroke="#2f7fe0" />
    <path d="M15 39.5h6M26 39.5h8" stroke="#9cc0f2" />
  </Icon>
);

/** Practice and learn — a pencil on a worksheet. */
export const PracticeIcon: LandingIcon = ({ size }) => (
  <Icon size={size}>
    <rect x="6" y="9" width="27" height="34" rx="5" fill="#ffe1c9" stroke="#f5792a" />
    <path d="M12 18h14M12 25h10M12 32h7" stroke="#f5792a" />
    <g transform="rotate(45 34 22)">
      <rect x="30" y="5" width="8" height="27" rx="2" fill="#f5792a" stroke="#f5792a" />
      <rect x="30" y="5" width="8" height="6" rx="2" fill="#ffb98a" stroke="#f5792a" />
      <path d="M30 32l4 9 4-9z" fill="#fff4ea" stroke="#f5792a" />
    </g>
  </Icon>
);

/** Get an AI report — a rising bar chart with an AI sparkle. */
export const ReportIcon: LandingIcon = ({ size }) => (
  <Icon size={size}>
    <rect x="6" y="9" width="36" height="33" rx="6" fill="#d3f2e3" stroke="#1fae71" />
    <rect x="13" y="29" width="6" height="8" rx="1.5" fill="#1fae71" stroke="none" />
    <rect x="22" y="23" width="6" height="14" rx="1.5" fill="#1fae71" stroke="none" />
    <rect x="31" y="17" width="6" height="20" rx="1.5" fill="#1fae71" stroke="none" />
    <path
      d="M38 3l1.7 4.1L44 8.8l-4.3 1.7L38 14.6l-1.7-4.1L32 8.8l4.3-1.7z"
      fill="#ffb020"
      stroke="#ffb020"
      strokeWidth={1.2}
    />
  </Icon>
);

/** Build a study plan — a calendar with a "done" badge. */
export const PlanIcon: LandingIcon = ({ size }) => (
  <Icon size={size}>
    <rect x="6" y="10" width="34" height="32" rx="6" fill="#e4d9fb" stroke="#7b4de0" />
    <path d="M6 22h34" stroke="#7b4de0" />
    <path d="M14 6v8M32 6v8" stroke="#7b4de0" />
    <circle cx="14" cy="29" r="1.6" fill="#7b4de0" stroke="none" />
    <circle cx="22" cy="29" r="1.6" fill="#7b4de0" stroke="none" />
    <circle cx="30" cy="29" r="1.6" fill="#7b4de0" stroke="none" />
    <circle cx="14" cy="36" r="1.6" fill="#7b4de0" stroke="none" />
    <circle cx="22" cy="36" r="1.6" fill="#7b4de0" stroke="none" />
    <circle cx="37" cy="37" r="8.5" fill="#22b573" stroke="#fff" strokeWidth={2.4} />
    <path d="M33.2 37.2l2.8 2.8 4.8-5.2" stroke="#fff" />
  </Icon>
);

/** More exams coming soon — a megaphone with sound waves. */
export const AnnounceIcon: LandingIcon = ({ size }) => (
  <Icon size={size}>
    <path d="M9 19h9l16-9v28l-16-9H9a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z" fill="#cfe3f7" stroke="#2f7fe0" />
    <path d="M13 28l2.5 10.5a1.6 1.6 0 0 0 1.6 1.2h2.2a1.2 1.2 0 0 0 1.2-1.5L18 27" fill="#2f7fe0" stroke="#2f7fe0" />
    <path d="M38 18c2.6 3.4 2.6 8.6 0 12" stroke="#f5792a" />
    <path d="M42.5 13.5c4.6 6 4.6 15 0 21" stroke="#f5792a" />
  </Icon>
);
