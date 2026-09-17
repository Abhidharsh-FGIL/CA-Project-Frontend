/**
 * The report design system.
 *
 * One place defines the card, the section header, the status pill, the stat tile
 * and the accent ramp, so twelve report surfaces look like one product rather than
 * twelve. Colours are tokens rather than literals at the call site — a status is
 * requested by meaning ("focus", "developing") and this module decides how that
 * looks, which is also what keeps the report exam-agnostic: nothing downstream
 * names a subject or an exam to get its colour.
 */
import React from 'react';
import { cn } from '@/lib/utils';

// ─── Palette ───────────────────────────────────────────────────────────────────

/**
 * Accent ramp. `indigo` is the product primary; the rest carry meaning and are
 * never used decoratively — a green tile means "at target", not "this is the
 * third tile".
 */
export type Accent = 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet' | 'slate';

export const ACCENT: Record<
  Accent,
  { chip: string; text: string; bar: string; ring: string; wash: string; hex: string }
> = {
  indigo: {
    chip: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400',
    text: 'text-indigo-700 dark:text-indigo-300',
    bar: 'bg-indigo-500',
    ring: 'border-indigo-200 dark:border-indigo-800',
    wash: 'bg-indigo-50/70 dark:bg-indigo-950/30',
    hex: '#6366f1',
  },
  emerald: {
    chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    ring: 'border-emerald-200 dark:border-emerald-800',
    wash: 'bg-emerald-50/70 dark:bg-emerald-950/30',
    hex: '#059669',
  },
  amber: {
    chip: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    bar: 'bg-amber-500',
    ring: 'border-amber-200 dark:border-amber-800',
    wash: 'bg-amber-50/70 dark:bg-amber-950/30',
    hex: '#d97706',
  },
  rose: {
    chip: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400',
    text: 'text-rose-700 dark:text-rose-300',
    bar: 'bg-rose-500',
    ring: 'border-rose-200 dark:border-rose-800',
    wash: 'bg-rose-50/70 dark:bg-rose-950/30',
    hex: '#e11d48',
  },
  sky: {
    chip: 'bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
    text: 'text-sky-700 dark:text-sky-300',
    bar: 'bg-sky-500',
    ring: 'border-sky-200 dark:border-sky-800',
    wash: 'bg-sky-50/70 dark:bg-sky-950/30',
    hex: '#0891b2',
  },
  violet: {
    chip: 'bg-violet-50 text-violet-600 dark:bg-violet-950/60 dark:text-violet-400',
    text: 'text-violet-700 dark:text-violet-300',
    bar: 'bg-violet-500',
    ring: 'border-violet-200 dark:border-violet-800',
    wash: 'bg-violet-50/70 dark:bg-violet-950/30',
    hex: '#7c3aed',
  },
  slate: {
    chip: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
    text: 'text-slate-600 dark:text-slate-300',
    bar: 'bg-slate-400',
    ring: 'border-slate-200 dark:border-slate-700',
    wash: 'bg-slate-50/70 dark:bg-slate-800/40',
    hex: '#64748b',
  },
};

/**
 * Hues for per-subject marks, assigned in fixed order and never cycled past the
 * end. The eighth subject onward takes the neutral slot rather than repeating a
 * hue that a colour-blind reader could not tell from the first.
 */
export const SUBJECT_HUES = [
  ACCENT.indigo.hex,
  ACCENT.amber.hex,
  ACCENT.emerald.hex,
  ACCENT.violet.hex,
  ACCENT.rose.hex,
  ACCENT.sky.hex,
  '#ec4899',
] as const;

export const subjectHue = (i: number) => SUBJECT_HUES[i] ?? ACCENT.slate.hex;

// ─── Card and section header ───────────────────────────────────────────────────

export function ReportCard({
  children,
  className,
  flush,
}: {
  children: React.ReactNode;
  className?: string;
  /** Drop the padding when the card holds a full-bleed table. */
  flush?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm',
        flush ? 'overflow-hidden' : 'p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The banded header the reference uses on every panel: a tinted icon square, a
 * bold title, an optional subtitle and a right-hand action.
 */
export function SectionHeader({
  icon,
  title,
  subtitle,
  action,
  accent = 'indigo',
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-3', className)}>
      <div className="min-w-0 flex items-start gap-2.5">
        {icon && (
          <span
            className={cn(
              'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-px',
              ACCENT[accent].chip,
            )}
          >
            {icon}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-snug">{title}</p>
          {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

// ─── Status pill ───────────────────────────────────────────────────────────────

/**
 * Status is requested by meaning, not by colour. A caller says "this subject needs
 * focus"; whether that is rose today is this module's business.
 */
export type StatusTone = 'strong' | 'developing' | 'focus' | 'neutral' | 'unknown';

const STATUS_STYLE: Record<StatusTone, string> = {
  strong: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  developing: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  focus: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  neutral: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
  unknown: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700',
};

export function StatusPill({ tone, children, className }: { tone: StatusTone; children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block whitespace-nowrap text-[10px] font-bold px-2 py-0.5 rounded-md border',
        STATUS_STYLE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── Stat tile ─────────────────────────────────────────────────────────────────

/** The bordered metric tile used across the summary rows. */
export function StatTile({
  icon,
  value,
  label,
  hint,
  accent = 'indigo',
  emphasis,
  align = 'center',
}: {
  icon?: React.ReactNode;
  value: React.ReactNode;
  label: string;
  hint?: React.ReactNode;
  accent?: Accent;
  /** Tints the tile's border and background as well as the value. */
  emphasis?: boolean;
  align?: 'center' | 'left';
}) {
  const centred = align === 'center';
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        centred && 'flex flex-col items-center text-center',
        emphasis
          ? cn(ACCENT[accent].ring, ACCENT[accent].wash)
          : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
      )}
    >
      {icon && (
        <span
          className={cn(
            'inline-flex w-8 h-8 rounded-full items-center justify-center mb-2 flex-shrink-0',
            ACCENT[accent].chip,
          )}
        >
          {icon}
        </span>
      )}
      {/* The value carries the tile's colour — that is what makes the row scannable. */}
      <p className={cn('text-xl font-bold leading-tight', ACCENT[accent].text)}>{value}</p>
      <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 mt-1 leading-tight">{label}</p>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5 leading-snug">{hint}</p>}
    </div>
  );
}

// ─── Score ring ────────────────────────────────────────────────────────────────

/**
 * The headline score dial. Pure SVG rather than a chart library — one arc does not
 * need an axis system, and this keeps it crisp at any size.
 */
export function ScoreRing({
  percent,
  primary,
  secondary,
  accent = 'indigo',
  size = 96,
}: {
  percent: number | null;
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  accent?: Accent;
  size?: number;
}) {
  const r = (size - 12) / 2;
  const circumference = 2 * Math.PI * r;
  const filled = percent == null ? 0 : Math.max(0, Math.min(100, percent));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={8}
          className="stroke-gray-100 dark:stroke-gray-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={8}
          strokeLinecap="round"
          stroke={ACCENT[accent].hex}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - filled / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">{primary}</span>
        {secondary && <span className="text-[10px] text-gray-400 mt-0.5">{secondary}</span>}
      </div>
    </div>
  );
}

// ─── Tabs and filter pills ─────────────────────────────────────────────────────

export function PillTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string; count?: number; tone?: StatusTone }>;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
            value === o.value
              ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
          )}
        >
          {o.label}
          {o.count != null && <span className="ml-1 text-gray-400">({o.count})</span>}
        </button>
      ))}
    </div>
  );
}

/** The underlined tab strip used inside a subject's detail panel. */
export function UnderlineTabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex border-b border-gray-100 dark:border-gray-800 gap-1 overflow-x-auto scrollbar-thin">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'text-[11px] font-semibold px-3 py-2 border-b-2 -mb-px whitespace-nowrap transition-colors',
            value === o.value
              ? 'border-indigo-500 text-indigo-700 dark:text-indigo-300'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Small pieces ──────────────────────────────────────────────────────────────

/** A labelled horizontal meter, used for difficulty bands and readiness rows. */
export function MeterRow({
  label,
  value,
  right,
  accent = 'indigo',
}: {
  label: React.ReactNode;
  /** 0–100. */
  value: number | null;
  right?: React.ReactNode;
  accent?: Accent;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="font-semibold text-gray-700 dark:text-gray-200">{label}</span>
        {right && <span className="tabular-nums text-gray-500 dark:text-gray-400">{right}</span>}
      </div>
      <div className="mt-1 h-1.5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div className={cn('h-full rounded', ACCENT[accent].bar)} style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%` }} />
      </div>
    </div>
  );
}

/** The bulleted insight line used in Quick Insights and Key Takeaways. */
export function InsightLine({
  icon,
  accent = 'indigo',
  children,
}: {
  icon: React.ReactNode;
  accent?: Accent;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className={cn('flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-px', ACCENT[accent].chip)}>
        {icon}
      </span>
      <span className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">{children}</span>
    </li>
  );
}

/** Every interpreted panel carries one of these. */
export function WhatThisMeans({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
      <span className="font-semibold text-gray-700 dark:text-gray-300">What this means: </span>
      {children}
    </p>
  );
}

/** Shown in place of an analysis the data cannot support. */
export function NotAvailable({ reason }: { reason: string }) {
  return (
    <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500 flex items-start gap-1.5">
      <span className="flex-shrink-0 mt-px">·</span>
      {reason}
    </p>
  );
}

// ─── Reading language ──────────────────────────────────────────────────────────

/**
 * Which language the report's *labels* are read in.
 *
 * Deliberately narrow. A Group 4 paper is printed in Tamil, so its questions tag
 * their subjects and topics in Tamil while the exam catalog names the same
 * subjects in English — this decides which of the two a label shows, and which
 * language a question's stem is rendered in where the paper carries both.
 *
 * It does NOT translate the analysis. Every diagnostic sentence is composed in
 * English from the numbers, and machine-translating those would put wording in
 * front of an aspirant that nobody has read. `ReportLanguageNote` says so rather
 * than letting the toggle imply more than it does.
 */
export type ReportLanguage = 'en' | 'ta';

const ReportLanguageContext = React.createContext<ReportLanguage>('en');

export function ReportLanguageProvider({
  language,
  children,
}: {
  language: ReportLanguage;
  children: React.ReactNode;
}) {
  return <ReportLanguageContext.Provider value={language}>{children}</ReportLanguageContext.Provider>;
}

export function useReportLanguage(): ReportLanguage {
  return React.useContext(ReportLanguageContext);
}

/**
 * Picks the label for the current reading language.
 *
 * Falls back rather than blanking: a topic the catalog knows in one language only
 * shows that one, which is more useful than an empty cell and honest about what
 * the paper actually carried.
 */
export function useLabel(): (node: { name: string; nameLocal?: string | null }) => string {
  const lang = useReportLanguage();
  return node => (lang === 'ta' ? node.nameLocal || node.name : node.name);
}

/** EN / தமிழ், for the report header. */
export function LanguageToggle({
  value,
  onChange,
}: {
  value: ReportLanguage;
  onChange: (next: ReportLanguage) => void;
}) {
  const options: Array<{ value: ReportLanguage; label: string }> = [
    { value: 'en', label: 'English' },
    { value: 'ta', label: 'தமிழ்' },
  ];
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 p-0.5"
      role="group"
      aria-label="Report language"
    >
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            'text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors',
            value === o.value
              ? 'bg-white dark:bg-gray-900 text-[#1e2a5a] dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Shown under the toggle while Tamil is selected, so its reach is not oversold. */
export function ReportLanguageNote() {
  const lang = useReportLanguage();
  if (lang !== 'ta') return null;
  return (
    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
      பாட/தலைப்பு பெயர்கள் மற்றும் வினாக்கள் தமிழில். பகுப்பாய்வு விளக்கங்கள் தற்போது ஆங்கிலத்தில் மட்டுமே.
    </p>
  );
}
