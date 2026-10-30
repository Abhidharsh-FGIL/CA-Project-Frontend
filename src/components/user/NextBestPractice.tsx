/**
 * The AI Study Coach — the dashboard's personalised "what to practise next", and the map of where the aspirant stands.
 *
 * It is the AI's own space, so it does not look like the dashboard's ordinary orange cards: a midnight console with
 * dark-glass cards, neon teal and electric purple glows, glowing rings and bars, a turning neon border, a glowing orb
 * for the coach, and its reasons typed out as messages.
 * Inside: the top pick large, the next two beside it, exam readiness, and the skill map (every unit's topics by
 * mastery). The backend picks by rules and ties each pick to a real test; the AI words the reason. When the backend
 * cannot be reached the panel is left out and the dashboard is as it was.
 */
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Clock,
  Gauge,
  Lightbulb,
  ListChecks,
  Lock,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wand2,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useRecommendationFeedback, useRecommendations } from '@/hooks/use-recommendations';
import { aiCoachShownKey } from '@/lib/ai-coach-session';
import {
  KIND_LABEL,
  TYPE_LABEL,
  basisLine,
  displayUnitName,
  masteryBand,
  recommendationHref,
  recommendationKind,
  recommendationPlace,
  recommendationTitle,
  type Improvement,
  type Recommendation,
  type RecommendationKind,
  type Recommendations,
  type RecommendationType,
  type WeakMapUnit,
} from '@/lib/recommendationsApi';

// ─── Look ────────────────────────────────────────────────────────────────────

/**
 * The coach's cards: frosted white on the light body; dark glass on the midnight one (`dark`: the popup, and the
 * portal's dark mode).
 */
const GLASS =
  'rounded-2xl bg-white/90 ring-1 ring-slate-200/80 shadow-[0_12px_32px_-20px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:bg-white/[0.04] dark:ring-white/10 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_20px_40px_-24px_rgba(0,0,0,0.8)]';
/** Neon teal into electric purple: the coach's own colour, for its marks. */
const NEON_FILL = 'bg-gradient-to-r from-cyan-500 to-purple-600';
/** The actions: a brighter neon, glowing. */
const AI_FILL = 'bg-gradient-to-r from-cyan-400 via-sky-500 to-purple-500 shadow-[0_0_24px_rgba(34,211,238,0.45)]';

const TYPE_PILL: Record<RecommendationType, string> = {
  fix_weak: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 ring-rose-400/30',
  start_new: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 ring-cyan-400/30',
  revise: 'bg-purple-500/15 text-violet-600 dark:text-purple-300 ring-purple-400/30',
  level_up: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 ring-emerald-400/30',
  full_mock: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-400/30',
};
const TYPE_DOT: Record<RecommendationType, string> = {
  fix_weak: 'bg-rose-500',
  start_new: 'bg-cyan-400',
  revise: 'bg-purple-400',
  level_up: 'bg-emerald-500',
  full_mock: 'bg-amber-500',
};

/** Mastery colour: fills, figures and the ring's stroke. */
const FILL = {
  none: 'bg-slate-300 dark:bg-slate-600',
  weak: 'bg-rose-500 dark:bg-rose-400 dark:shadow-[0_0_10px_rgba(251,113,133,0.7)]',
  building: 'bg-amber-500 dark:bg-amber-400 dark:shadow-[0_0_10px_rgba(251,191,36,0.7)]',
  strong: 'bg-emerald-500 dark:bg-emerald-400 dark:shadow-[0_0_10px_rgba(52,211,153,0.7)]',
} as const;
const FIGURE = {
  none: 'text-slate-500',
  weak: 'text-rose-600 dark:text-rose-300',
  building: 'text-amber-700 dark:text-amber-300',
  strong: 'text-emerald-600 dark:text-emerald-300',
} as const;
// Mid tones: they read on the light body and on the dark one.
const STROKE = { none: '#94a3b8', weak: '#f43f5e', building: '#f59e0b', strong: '#10b981' } as const;

const pct = (n: number | null | undefined) => (n == null ? '—' : `${Math.round(n)}%`);
const clamp = (n: number | null | undefined) => Math.max(0, Math.min(100, n ?? 0));
const delay = (ms: number) => ({ ['--d' as string]: `${ms}ms` }) as CSSProperties;

function ago(iso: string | null): string | null {
  if (!iso) return null;
  const mins = Math.round((Date.now() - +new Date(iso)) / 60_000);
  if (!Number.isFinite(mins) || mins < 0) return null;
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

// ─── Motion ──────────────────────────────────────────────────────────────────

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** False on the first paint, true just after — so bars and rings grow from empty instead of appearing full. */
function useEntered(): boolean {
  const [entered, setEntered] = useState(reducedMotion);
  useEffect(() => {
    if (entered) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [entered]);
  return entered;
}

/** Counts up to `target` (eased) when it first shows or changes. */
function useCountUp(target: number | null | undefined, ms = 1100): number | null {
  const [shown, setShown] = useState<number | null>(target == null ? null : reducedMotion() ? target : 0);
  useEffect(() => {
    if (target == null) return setShown(null);
    if (reducedMotion()) return setShown(target);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setShown(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return shown;
}

/** Types `text` out, a few characters a frame, after `wait` ms — the coach "speaking". Whole at once without motion. */
function useTypewriter(text: string, wait = 0): { shown: string; done: boolean } {
  const [n, setN] = useState(() => (reducedMotion() ? text.length : 0));
  useEffect(() => {
    if (reducedMotion()) return setN(text.length);
    setN(0);
    let raf = 0;
    let start = 0;
    const perChar = Math.max(8, Math.min(24, 1400 / Math.max(1, text.length)));
    const tick = (now: number) => {
      if (!start) start = now + wait;
      const k = Math.max(0, Math.floor((now - start) / perChar));
      setN(Math.min(text.length, k));
      if (k < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, wait]);
  // Whole grapheme clusters only: Tamil letters are several code points and must not be shown half-built.
  const shown = useMemo(() => {
    if (n >= text.length) return text;
    const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (s: string) => Iterable<{ index: number; segment: string }> } }).Segmenter;
    if (!Seg) return text.slice(0, n);
    let out = '';
    for (const { index, segment } of new Seg(undefined, { granularity: 'grapheme' }).segment(text)) {
      if (index + segment.length > n) break;
      out += segment;
    }
    return out;
  }, [text, n]);
  return { shown, done: n >= text.length };
}

// ─── Small pieces ────────────────────────────────────────────────────────────

/** The coach: a calm centre inside a turning band of colour, breathing a soft glow. */
function Orb({ size = 44, className }: { size?: number; className?: string }) {
  return (
    <span className={cn('relative inline-grid flex-shrink-0 place-items-center', className)} style={{ width: size, height: size }} aria-hidden>
      <span className="mge-orb-glow absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400/70 via-purple-500/50 to-fuchsia-400/60 blur-md" />
      <span className="mge-orb-ring absolute inset-0 rounded-full" />
      <span className="absolute inset-[3px] grid place-items-center rounded-full bg-white dark:bg-[#0b1020]">
        <Sparkles className="text-cyan-700 dark:text-cyan-300 drop-shadow-[0_0_6px_rgba(34,211,238,0.9)]" style={{ width: size * 0.42, height: size * 0.42 }} />
      </span>
    </span>
  );
}

function TypePill({ type }: { type: RecommendationType }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1', TYPE_PILL[type])}>
      <span className={cn('h-1.5 w-1.5 rounded-full', TYPE_DOT[type])} />
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

const KIND_STYLE: Record<RecommendationKind, string> = {
  topic: 'bg-cyan-400/15 text-cyan-800 dark:text-cyan-200 ring-cyan-400/30',
  unit: 'bg-purple-400/15 text-violet-700 dark:text-purple-200 ring-purple-400/30',
  mock: 'bg-amber-400/15 text-amber-800 dark:text-amber-200 ring-amber-400/30',
};

/** What a pick covers, said outright: a Key topic, a Whole unit or a Full mock. */
function KindTag({ rec }: { rec: Recommendation }) {
  const kind = recommendationKind(rec);
  return (
    <span className={cn('inline-flex flex-shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ring-1', KIND_STYLE[kind])}>
      {KIND_LABEL[kind]}
    </span>
  );
}

/** Marks a line the coach wrote. */
function AiTag({ label = 'AI' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan-400/15 to-purple-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-400/30">
      <Wand2 className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}

/** A thin bar that grows to a mastery. */
function Bar({ value, className, wait = 0 }: { value: number | null | undefined; className?: string; wait?: number }) {
  const entered = useEntered();
  return (
    <div className={cn('h-1.5 overflow-hidden rounded-full bg-slate-200/70 dark:bg-white/10', className)}>
      <div
        className={cn('h-1.5 rounded-full transition-[width] duration-[1100ms] ease-out', FILL[masteryBand(value)])}
        style={{ width: entered ? `${clamp(value)}%` : '0%', transitionDelay: `${wait}ms` }}
      />
    </div>
  );
}

/** A ring that fills to a value while its figure counts up. */
function Ring({ value, size = 96, label }: { value: number | null | undefined; size?: number; label: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const band = masteryBand(value);
  const entered = useEntered();
  const shown = useCountUp(value == null ? null : clamp(value));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" className="stroke-slate-200 dark:stroke-white/10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={STROKE[band]}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={entered ? c * (1 - clamp(value) / 100) : c}
          className="transition-[stroke-dashoffset] duration-[1100ms] ease-out"
          style={{ filter: `drop-shadow(0 0 6px ${STROKE[band]})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-xl font-extrabold leading-none tabular-nums', value == null ? 'text-slate-500' : 'text-slate-900 dark:text-white')}>
          {shown == null ? 'New' : `${Math.round(shown)}%`}
        </span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</span>
      </div>
    </div>
  );
}

/** The coach's message: its orb, and the words typed out in a bubble. */
function CoachSays({ text, source, wait = 0, children }: { text: string; source?: 'ai' | 'template'; wait?: number; children?: ReactNode }) {
  const { shown, done } = useTypewriter(text, wait);
  return (
    <div className="flex items-start gap-2.5">
      <Orb size={28} className="mt-1" />
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-gradient-to-br from-cyan-400/10 via-white dark:via-white/[0.03] to-purple-500/10 px-3.5 py-2.5 ring-1 ring-cyan-400/20">
        <div className="mb-1">
          <AiTag label={source === 'ai' ? 'AI says' : 'Why this pick'} />
        </div>
        {/* The whole text holds the bubble's size from the start; the typed part is laid over it. */}
        <p className="relative text-[14.5px] leading-relaxed text-slate-800 dark:text-slate-100">
          <span className="invisible">{text}</span>
          <span className="absolute inset-0">
            {shown}
            {!done && <span className="mge-caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />}
          </span>
        </p>
        {children}
      </div>
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────────

/**
 * The topic a pick is about: its unit and category (a whole-unit pick has no category). Not `rec_id`: two different
 * topics can come back under one id, or none, and closing one closed both; and the server can offer the same topic
 * again under a new id, test or kind of pick (after a "Not now" it sends Indian Polity back each time). A pick with
 * neither unit nor category (a full mock) is told apart by its test.
 */
const pickKey = (r: Recommendation) => {
  const unit = r.unit?.id ?? '';
  const category = r.category?.id ?? r.category?.name ?? '';
  return unit || category ? `${unit}|${category}` : `test|${r.target?.test_id ?? r.rec_id ?? ''}`;
};

/** The picks with each topic once — the first, which the server ranks highest — and none the student closed. */
function visiblePicks(items: Recommendation[], hidden: string[]): Recommendation[] {
  const seen = new Set(hidden);
  const out: Recommendation[] = [];
  for (const r of items) {
    const key = pickKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function NextBestPractice({
  exam,
  stage,
  name,
  className,
  stickyAction = false,
}: {
  exam: string;
  stage: string;
  /** The aspirant's first name, so the coach can address them. */
  name?: string;
  className?: string;
  /** In the popup: the top pick's Start button stays at the foot of the window while the rest scrolls. */
  stickyAction?: boolean;
}) {
  const { data, isLoading, isError } = useRecommendations(exam, stage);
  const feedback = useRecommendationFeedback(exam, stage);
  /** Picks put aside here, hidden at once rather than after the server answers. */
  const [hidden, setHidden] = useState<string[]>([]);

  if (isLoading) return <Thinking className={className} />;
  if (isError || !data) return null;

  const items = visiblePicks(data.items, hidden).slice(0, 3);
  const [top, ...rest] = items;
  const planMinutes = items.reduce((n, r) => n + (r.target.est_minutes ?? 0), 0);
  const updated = ago(data.generated_at);
  const keyTopicsHref = `/user/exams/${exam}/${stage}`;

  const dismiss = (r: Recommendation) => {
    setHidden(h => [...h, pickKey(r)]);
    feedback.mutate({ recId: r.rec_id, action: 'dismissed' });
  };
  const start = (r: Recommendation) => () => {
    if (!r.target.is_locked) feedback.mutate({ recId: r.rec_id, action: 'started' });
  };

  return (
    <Shell
      className={className}
      closeGap={stickyAction}
      header={
        // The coach introduces itself, at the head of the console; today's plan sits at the other end.
        <div className="mge-rise flex min-w-0 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Orb size={56} />
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">
                <BrainCircuit className="h-3.5 w-3.5" /> AI Study Coach
              </p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-[26px]">
                {name ? `${name}, here's` : "Here's"} what to practise{' '}
                <span className="relative whitespace-nowrap bg-gradient-to-r from-cyan-600 dark:from-cyan-300 to-violet-600 dark:to-purple-400 bg-clip-text text-transparent dark:drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">
                  next
                  <span aria-hidden className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />
                </span>
              </h2>
              <p className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                {data.status === 'computing' ? (
                  <>
                    <ThinkingDots light /> Updating with your latest test…
                  </>
                ) : data.status === 'not_enough_data' || data.basis === 'new' ? (
                  basisLine(data)
                ) : (
                  <>
                    <span className="mge-live inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 text-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" aria-hidden />
                    {basisLine(data)}
                    {updated ? ` · updated ${updated}` : ''}
                  </>
                )}
              </p>
            </div>
          </div>
          {items.length > 0 && (
            <div className="hidden flex-shrink-0 items-center gap-3 rounded-2xl bg-white/80 dark:bg-white/5 px-4 py-2.5 ring-1 ring-slate-200 dark:ring-white/10 md:flex">
              <ListChecks className="h-5 w-5 text-cyan-700 dark:text-cyan-300" />
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Today&apos;s plan</p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {items.length} step{items.length === 1 ? '' : 's'}
                  {planMinutes > 0 ? ` · about ${planMinutes} min` : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      }
    >
      {top ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
          <TopPick key={pickKey(top)} rec={top} sticky={stickyAction} onStart={start(top)} onDismiss={() => dismiss(top)} />
          <div className="flex flex-col gap-4">
            {rest.length > 0 && (
              <div className={cn(GLASS, 'mge-rise p-4')} style={delay(140)}>
                <p className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-violet-600 dark:text-purple-300" /> Then try these
                  </span>
                  <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] text-cyan-700 dark:text-cyan-300">{rest.length}</span>
                </p>
                <ul className="divide-y divide-slate-200/80 dark:divide-white/10">
                  {rest.map((r, i) => (
                    <AlsoRow key={pickKey(r)} rec={r} number={i + 2} wait={240 + i * 120} onStart={start(r)} onDismiss={() => dismiss(r)} />
                  ))}
                </ul>
              </div>
            )}
            {data.readiness?.score != null && <Readiness readiness={data.readiness} wait={300} />}
          </div>
        </div>
      ) : (
        <div className={cn(GLASS, 'flex flex-wrap items-center justify-between gap-3 p-5')}>
          <CoachSays text="You are doing well everywhere. Take a full mock to find what to improve next." />
          <Link
            to={`${keyTopicsHref}?tab=exam`}
            className={cn('mge-sheen inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold text-white hover:shadow-[0_0_36px_rgba(168,85,247,0.6)]', AI_FILL)}
          >
            Take a mock <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {(data.weak_map.length > 0 || data.improved.length > 0) && (
        <SkillMap units={data.weak_map} improved={data.improved} keyTopicsHref={keyTopicsHref} />
      )}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-[10px] text-slate-500">
        <Wand2 className="h-3 w-3" /> These picks come from your own test results and update after every test.
      </p>
    </Shell>
  );
}

/** Particles rising through the header: left %, size px, rise time s, delay s. */
const BUBBLES: Array<[number, number, number, number]> = [
  [6, 10, 9, 0],
  [18, 6, 7, 2.5],
  [31, 14, 11, 1],
  [47, 8, 8, 4],
  [58, 5, 6.5, 0.5],
  [69, 12, 10, 3],
  [81, 7, 7.5, 1.6],
  [92, 10, 9.5, 5],
];

/**
 * The coach's space, a futuristic console: a midnight panel inside a slowly turning neon border, a faint cyan grid,
 * teal and purple glows drifting behind, particles rising through the header and a glowing line under it.
 */
function Shell({
  header,
  children,
  className,
  closeGap = false,
}: {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Leave room at the header's right edge for the popup's close button. */
  closeGap?: boolean;
}) {
  return (
    <section className={cn('mge-ai-border rounded-[28px] p-[1.5px] shadow-[0_18px_50px_-20px_rgba(99,102,241,0.35)] dark:shadow-[0_0_60px_-12px_rgba(34,211,238,0.45)]', className)}>
      <div className="relative overflow-clip rounded-[26.5px] bg-gradient-to-br from-white via-sky-50 to-violet-50 text-slate-900 dark:bg-none dark:bg-[#0b1020] dark:text-white">
        <div aria-hidden className="mge-ai-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_80%)]" />
        <div aria-hidden className="mge-aurora pointer-events-none absolute -left-24 -top-32 h-96 w-96 rounded-full bg-cyan-200/40 dark:bg-cyan-500/25 blur-3xl" />
        <div aria-hidden className="mge-aurora pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-violet-200/45 dark:bg-purple-600/30 blur-3xl" style={delay(-5000)} />
        <div aria-hidden className="mge-aurora pointer-events-none absolute -bottom-40 left-1/3 h-96 w-96 rounded-full bg-fuchsia-200/30 dark:bg-fuchsia-500/15 blur-3xl" style={delay(-9000)} />
        {header && (
          <div className="relative px-5 pb-5 pt-6 sm:px-7 sm:pt-7">
            {BUBBLES.map(([left, size, t, d], i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  'mge-bubble pointer-events-none absolute bottom-0 rounded-full',
                  i % 2 ? 'bg-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.9)]' : 'bg-purple-300 shadow-[0_0_8px_rgba(192,132,252,0.9)]',
                )}
                style={{ left: `${left}%`, width: size / 3, height: size / 3, ['--t' as string]: `${t}s`, ['--d' as string]: `${d}s` } as CSSProperties}
              />
            ))}
            <div className={cn('relative', closeGap && 'pr-10')}>{header}</div>
            {/* A neon line under the header, brightest in the middle. */}
            <span aria-hidden className="absolute inset-x-6 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-400/70 to-transparent" />
            <span aria-hidden className="absolute inset-x-1/4 bottom-0 h-[3px] -translate-y-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent blur-[2px]" />
          </div>
        )}
        <div className={cn('relative px-4 pb-5 sm:px-6 sm:pb-6', header ? 'pt-5' : 'pt-5 sm:pt-6')}>{children}</div>
      </div>
    </section>
  );
}

// ─── The top pick ────────────────────────────────────────────────────────────

function TopPick({
  rec,
  sticky = false,
  onStart,
  onDismiss,
}: {
  rec: Recommendation;
  sticky?: boolean;
  onStart: () => void;
  onDismiss: () => void;
}) {
  const m = rec.mastery;
  const tried = !!m && m.attempted > 0;
  return (
    <article
      // `overflow-clip`, not `hidden`: it clips the same but is not a scroll box, so the sticky button inside can stick to the popup.
      className={cn(GLASS, 'mge-rise group relative flex flex-col overflow-clip p-5 ring-cyan-400/30 shadow-[0_0_40px_-10px_rgba(34,211,238,0.35)] transition-transform duration-300 hover:-translate-y-1 sm:p-6')}
      style={delay(60)}
    >
      {/* A neon edge along the top marks the top pick. */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm', NEON_FILL)}>
            <Sparkles className="mge-twinkle h-3 w-3" /> Do this first
          </span>
          <TypePill type={rec.type} />
        </div>
        <button
          type="button"
          onClick={onDismiss}
          title="Not now — show me something else"
          aria-label="Not now"
          className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="min-w-0 flex-1">
          {/* A Tamil word is kept whole where it fits; only a word too long for the line is broken. */}
          <h3 className="text-xl font-extrabold leading-snug tracking-tight text-slate-900 dark:text-white [overflow-wrap:break-word] sm:text-[22px]">{recommendationTitle(rec)}</h3>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <KindTag rec={rec} />
            {recommendationPlace(rec) && <span>{recommendationPlace(rec)}</span>}
          </p>
          {rec.subcategory && (
            <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg bg-white/80 dark:bg-white/5 px-2.5 py-1.5 text-xs ring-1 ring-slate-200 dark:ring-white/10">
              <Target className="h-3.5 w-3.5 flex-shrink-0 text-violet-600 dark:text-purple-300" />
              <span className="flex-shrink-0 whitespace-nowrap text-slate-500 dark:text-slate-400">Weak part:</span>
              <span className="truncate font-semibold text-slate-900 dark:text-white">{rec.subcategory.name}</span>
              {rec.subcategory.mastery != null && (
                <span className={cn('flex-shrink-0 font-bold tabular-nums', FIGURE[masteryBand(rec.subcategory.mastery)])}>
                  {pct(rec.subcategory.mastery)}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex flex-row items-center gap-4 sm:flex-col sm:gap-2">
          <Ring value={tried ? m!.score : null} size={84} label="Your score" />
          {tried && (
            <p className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {m!.correct} of {m!.attempted} right
              {m!.trend != null && Math.abs(m!.trend) >= 1 && (
                <span className={cn('inline-flex items-center font-semibold', m!.trend > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300')}>
                  {m!.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(Math.round(m!.trend))}
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        <CoachSays text={rec.reason} source={rec.reason_source} wait={500}>
          {rec.tip && (
            <p className="mt-2 flex gap-1.5 border-t border-slate-200 dark:border-white/10 pt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-500" />
              {rec.tip}
            </p>
          )}
        </CoachSays>
      </div>

      <GoalStrip rec={rec} />
      <StatTiles rec={rec} />

      <div
        className={cn(
          'mt-auto pt-5',
          // In the popup the button holds the foot of the window, on a fade so what scrolls under it stays readable.
          sticky &&
            'sticky bottom-0 z-10 -mx-5 -mb-5 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-[#0d1326] dark:via-[#0d1326]/95 px-5 pb-5 pt-8 sm:-mx-6 sm:-mb-6 sm:px-6 sm:pb-6',
        )}
      >
        {rec.target.is_locked ? (
          <Link
            to={recommendationHref(rec)}
            title={rec.target.lock_reason ?? undefined}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-amber-300 dark:border-amber-400/50 bg-amber-50 dark:bg-amber-400/10 text-sm font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-400/20"
          >
            <Lock className="h-4 w-4" /> Unlock with a plan
          </Link>
        ) : (
          <Link
            to={recommendationHref(rec)}
            onClick={onStart}
            className={cn(
              'mge-sheen flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition hover:scale-[1.01] hover:shadow-[0_0_36px_rgba(168,85,247,0.6)] active:scale-[0.99]',
              AI_FILL,
            )}
          >
            Start practice <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        )}
      </div>
    </article>
  );
}

/** A score from this up is "strong" (the same line the colours use), so it is the goal the bar points at. */
const GOAL = 70;

/** How far the score is from a strong one: a bar that fills to the score, with the goal marked on it. */
function GoalStrip({ rec }: { rec: Recommendation }) {
  const entered = useEntered();
  const score = rec.mastery && rec.mastery.attempted > 0 ? rec.mastery.score : null;
  if (score == null) {
    return (
      <p className="mt-4 flex items-center gap-2 rounded-xl bg-white/80 dark:bg-white/5 px-3 py-2.5 text-xs text-slate-600 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-white/10">
        <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-cyan-700 dark:text-cyan-300" />
        Not tried yet. Your first test will set your score.
      </p>
    );
  }
  const left = Math.max(0, GOAL - Math.round(score));
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="font-semibold text-slate-600 dark:text-slate-300">Road to a strong score</span>
        <span className={cn('tabular-nums', left > 0 ? 'text-slate-500 dark:text-slate-400' : 'font-semibold text-emerald-600 dark:text-emerald-300')}>
          {left > 0 ? `${left} points to go` : 'You are there. Keep it up!'}
        </span>
      </div>
      <div className="relative mt-2.5 h-2 rounded-full bg-slate-200/70 dark:bg-white/10">
        <div
          className="relative h-2 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_12px_rgba(34,211,238,0.6)] transition-[width] duration-[1100ms] ease-out"
          style={{ width: entered ? `${clamp(score)}%` : '0%' }}
        >
          {/* A glowing dot where the score ends. */}
          <span aria-hidden className="absolute -right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white shadow ring-2 ring-violet-500 dark:shadow-[0_0_10px_rgba(255,255,255,0.9)] dark:ring-0" />
        </div>
        <span aria-hidden className="absolute -top-1 h-4 w-0.5 rounded bg-emerald-500 dark:bg-emerald-300" style={{ left: `${GOAL}%` }} />
      </div>
      <div className="relative mt-1 h-4 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">
        <span className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${GOAL}%` }}>
          Goal {GOAL}%
        </span>
      </div>
    </div>
  );
}

/** What is in the test, as three small tiles: how many questions, how long, how hard. */
function StatTiles({ rec }: { rec: Recommendation }) {
  const level = rec.target.level;
  const tiles = [
    { Icon: ListChecks, value: rec.target.question_count != null ? String(rec.target.question_count) : null, label: 'Questions' },
    { Icon: Clock, value: rec.target.est_minutes != null ? `${rec.target.est_minutes} min` : null, label: 'About' },
    { Icon: Gauge, value: level ? (level === 'mixed' ? 'Mixed' : level[0].toUpperCase() + level.slice(1)) : null, label: 'Level' },
  ].filter(t => t.value);
  if (tiles.length === 0) return null;
  return (
    <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}>
      {tiles.map(({ Icon, value, label }) => (
        // On a phone each tile is a narrow column, so icon, number and label stack; from `sm` they sit side by side.
        <div key={label} className="flex flex-col items-center gap-1.5 rounded-xl bg-white/80 dark:bg-white/5 px-1.5 py-2.5 text-center ring-1 ring-slate-200 dark:ring-white/10 sm:flex-row sm:gap-2 sm:px-2.5 sm:py-2 sm:text-left">
          <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg bg-cyan-400/10 ring-1 ring-cyan-400/25">
            <Icon className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-300" />
          </span>
          <div className="min-w-0 max-w-full">
            <p className="text-sm font-extrabold leading-none text-slate-900 dark:text-white sm:truncate">{value}</p>
            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── The other picks ─────────────────────────────────────────────────────────

function AlsoRow({
  rec,
  number,
  wait,
  onStart,
  onDismiss,
}: {
  rec: Recommendation;
  number: number;
  wait: number;
  onStart: () => void;
  onDismiss: () => void;
}) {
  const m = rec.mastery;
  const tried = !!m && m.attempted > 0;
  return (
    <li
      className="mge-rise group relative -mx-2 flex items-start gap-3 rounded-xl px-2 py-3 transition-all duration-300 hover:translate-x-1 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]"
      style={delay(wait)}
    >
      <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full bg-white/80 dark:bg-white/5 text-xs font-extrabold text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-400/30 transition group-hover:bg-gradient-to-br group-hover:from-cyan-400 group-hover:to-purple-500 group-hover:text-white group-hover:shadow-[0_0_14px_rgba(34,211,238,0.6)]">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <span className={cn('h-1.5 w-1.5 rounded-full', TYPE_DOT[rec.type])} />
          {TYPE_LABEL[rec.type] ?? rec.type}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm font-bold leading-snug text-slate-900 dark:text-white" title={recommendationTitle(rec)}>
          {recommendationTitle(rec)}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <KindTag rec={rec} />
          {recommendationPlace(rec) && <span className="truncate">{recommendationPlace(rec)}</span>}
        </p>
        {tried ? (
          <div className="mt-1.5 flex items-center gap-2">
            <Bar value={m!.score} className="w-24" wait={wait + 200} />
            <span className={cn('text-[11px] font-bold tabular-nums', FIGURE[masteryBand(m!.score)])}>{pct(m!.score)}</span>
          </div>
        ) : (
          <p className="mt-1 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">Not tried yet</p>
        )}
        <p className="mt-1.5 line-clamp-2 text-[11px] italic leading-snug text-violet-700/80 dark:text-purple-200/80">“{rec.reason}”</p>
      </div>
      {/* The button is centred on the row's height, so it lines up whether the title takes one line or two. */}
      <div className="flex flex-shrink-0 self-center">
        <Link
          to={recommendationHref(rec)}
          onClick={onStart}
          className={cn(
            'inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition',
            rec.target.is_locked
              ? 'border border-amber-300 dark:border-amber-400/50 bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-400/20'
              : 'bg-cyan-400/10 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-400/30 hover:bg-cyan-400 hover:text-slate-950 hover:shadow-[0_0_16px_rgba(34,211,238,0.7)]',
          )}
        >
          {rec.target.is_locked ? (
            <>
              <Lock className="h-3 w-3" /> Unlock
            </>
          ) : (
            <>
              Start <ArrowRight className="h-3 w-3" />
            </>
          )}
        </Link>
      </div>
      {/* "Not now" tucks into the top corner, out of the way of the button, and shows on hover. */}
      <button
        type="button"
        onClick={onDismiss}
        title="Not now — show me something else"
        aria-label="Not now"
        className="absolute right-1 top-1 rounded-full p-1 text-slate-500 opacity-0 transition hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white focus:opacity-100 group-hover:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

// ─── Readiness ───────────────────────────────────────────────────────────────

function Readiness({ readiness, wait = 0 }: { readiness: NonNullable<Recommendations['readiness']>; wait?: number }) {
  return (
    <div className={cn(GLASS, 'mge-rise flex-1 p-4')} style={delay(wait)}>
      <div className="flex items-center gap-4">
        <Ring value={readiness.score} size={84} label="Ready" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">How ready you are</p>
          <ul className="mt-2 space-y-2">
            {readiness.sections.map((s, i) => (
              <li key={s.name}>
                <div className="flex justify-between gap-3 text-[11px]">
                  <span className="truncate text-slate-600 dark:text-slate-300">{s.name}</span>
                  <span className={cn('font-bold tabular-nums', FIGURE[masteryBand(s.score)])}>{pct(s.score)}</span>
                </div>
                <Bar value={s.score} className="mt-1" wait={wait + 150 + i * 120} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ─── Skill map ───────────────────────────────────────────────────────────────

const MAP_PREVIEW = 4;

function SkillMap({ units, improved, keyTopicsHref }: { units: WeakMapUnit[]; improved: Improvement[]; keyTopicsHref: string }) {
  const [showAll, setShowAll] = useState(false);
  // Weakest first: the units that most need work lead.
  const sorted = useMemo(() => [...units].sort((a, b) => (a.mastery ?? 101) - (b.mastery ?? 101)), [units]);
  const shown = showAll ? sorted : sorted.slice(0, MAP_PREVIEW);

  return (
    <div className={cn(GLASS, 'mge-rise mt-4 p-4 sm:p-5')} style={delay(420)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-900 dark:text-white">
            <BrainCircuit className="h-4 w-4 text-cyan-700 dark:text-cyan-300" /> Your topics
            <AiTag label="AI" />
          </h3>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">Units you have tried, weakest first. Tap a topic to practise it.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">
          <Legend tone="weak" label="Weak" />
          <Legend tone="building" label="Getting better" />
          <Legend tone="strong" label="Strong" />
        </div>
      </div>

      {improved.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
            <TrendingUp className="h-3.5 w-3.5" /> Improving
          </span>
          {improved.slice(0, 6).map(i => (
            <span
              key={i.category}
              className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[11px] text-emerald-600 dark:text-emerald-300 ring-1 ring-emerald-400/30"
            >
              <span className="font-semibold">{i.category}</span> {Math.round(i.from)}% → <span className="font-bold">{Math.round(i.to)}%</span>
            </span>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-200/80 dark:divide-white/10">
          {shown.map((u, ui) => (
            <li key={u.unit_id} className="mge-rise grid grid-cols-1 items-start gap-2 py-3 sm:grid-cols-[220px_1fr] sm:gap-4" style={delay(Math.min(ui, 8) * 70 + 500)}>
              <div className="flex items-center gap-2.5">
                <span className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg bg-white/80 dark:bg-white/5 text-[11px] font-bold text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-400/30">
                  {u.label ?? '★'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-slate-900 dark:text-white" title={displayUnitName(u.unit_id, u.unit_name)}>
                    {displayUnitName(u.unit_id, u.unit_name)}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <Bar value={u.mastery} className="w-20" wait={Math.min(ui, 8) * 70 + 650} />
                    <span className={cn('text-[11px] font-bold tabular-nums', FIGURE[masteryBand(u.mastery)])}>{pct(u.mastery)}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {u.categories.length === 0 && (
                  <span className="text-[11px] text-slate-500">Practised as a whole unit.</span>
                )}
                {[...u.categories]
                  .sort((a, b) => (a.mastery ?? 101) - (b.mastery ?? 101))
                  .map(c => {
                    const band = masteryBand(c.mastery);
                    return (
                      <Link
                        key={c.id ?? c.name}
                        to={keyTopicsHref}
                        title={`${c.name} — ${pct(c.mastery)} mastery from ${c.attempted} question${c.attempted === 1 ? '' : 's'}`}
                        className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white dark:bg-white/[0.05] px-2.5 py-1 text-[11px] text-slate-700 dark:text-slate-200 ring-1 ring-slate-200 dark:ring-white/10 transition duration-200 hover:-translate-y-0.5 hover:bg-slate-100 dark:hover:bg-white/10 hover:ring-cyan-400/50 hover:shadow-[0_0_14px_rgba(34,211,238,0.35)]"
                      >
                        <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', FILL[band])} />
                        {/* A long Tamil name wraps inside the tag; the dot and the percentage keep their place. */}
                        <span className="min-w-0 break-words">{c.name}</span>
                        <span className={cn('flex-shrink-0 font-bold tabular-nums', FIGURE[band])}>{pct(c.mastery)}</span>
                      </Link>
                    );
                  })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {sorted.length > MAP_PREVIEW && (
        <button
          type="button"
          onClick={() => setShowAll(v => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:underline"
        >
          {showAll ? (
            <>
              Show fewer <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show all {sorted.length} units <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

function Legend({ tone, label }: { tone: 'weak' | 'building' | 'strong'; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('h-2 w-2 rounded-full', FILL[tone])} />
      {label}
    </span>
  );
}

function ThinkingDots({ light = false }: { light?: boolean }) {
  return (
    <span className="mge-think inline-flex items-center gap-0.5" aria-hidden>
      <span className={cn('h-1 w-1 rounded-full', light ? 'bg-cyan-500 dark:bg-white' : 'bg-cyan-400 dark:bg-cyan-300')} />
      <span className={cn('h-1 w-1 rounded-full', light ? 'bg-violet-400 dark:bg-cyan-200' : 'bg-cyan-500')} />
      <span className="h-1 w-1 rounded-full bg-rose-400" />
    </span>
  );
}

/** While the picks load: the coach, thinking. */
function Thinking({ className }: { className?: string }) {
  return (
    <Shell
      className={className}
      header={
        <div className="flex items-center gap-4">
          <Orb size={56} />
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-cyan-700 dark:text-cyan-300">AI Study Coach</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              Analysing your attempts <ThinkingDots light />
            </p>
          </div>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.55fr_1fr]">
        <div className={cn(GLASS, 'h-64 animate-pulse')} />
        <div className="flex flex-col gap-4">
          <div className={cn(GLASS, 'h-32 animate-pulse')} />
          <div className={cn(GLASS, 'h-28 animate-pulse')} />
        </div>
      </div>
    </Shell>
  );
}

// ─── Popup, and the button that opens it ─────────────────────────────────────

/** The coach in a popup — shown on arrival, and from the "AI Coach" button. Closing it leaves the panel on the page. */
export function AiCoachDialog({
  exam,
  stage,
  name,
  open,
  onOpenChange,
}: {
  exam: string;
  stage: string;
  name?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        // Nothing inside takes focus on opening — otherwise the first button (a pick's ×) shows a focus ring.
        onOpenAutoFocus={e => e.preventDefault()}
        className={cn(
          'block max-h-[92vh] w-[calc(100%-1.5rem)] max-w-6xl overflow-y-auto overscroll-contain rounded-[28px] border-0 bg-transparent p-0 shadow-none sm:rounded-[28px]',
          // A slim neon scrollbar on a clear track, not the browser's square white one against the rounded panel.
          '[scrollbar-color:rgba(34,211,238,0.55)_transparent] [scrollbar-width:thin]',
          // The close button: a frosted disc on the console's top-right corner.
          '[&>button]:right-5 [&>button]:top-5 [&>button]:z-20 [&>button]:rounded-full [&>button]:bg-white/15 [&>button]:p-2 [&>button]:text-white [&>button]:opacity-100 [&>button]:ring-1 [&>button]:ring-white/30 [&>button]:backdrop-blur hover:[&>button]:bg-white/25',
        )}
      >
        <DialogTitle className="sr-only">AI Study Coach — what to practise next</DialogTitle>
        <DialogDescription className="sr-only">Your personalised practice picks, exam readiness and skill map.</DialogDescription>
        {/* The popup keeps the coach's midnight look; on the page it is light (unless the portal is in dark mode). */}
        <div className="dark">
          <NextBestPractice exam={exam} stage={stage} name={name} stickyAction />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "AI Coach" at the top of the page: opens the coach's popup. Shown once there are picks to show. */
export function AiCoachButton({ exam, stage, onClick, className }: { exam: string; stage: string; onClick: () => void; className?: string }) {
  const { data } = useRecommendations(exam, stage);
  if (!data || data.items.length === 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'mge-ai-border mge-ai-night group rounded-full p-[1.5px] shadow-[0_0_18px_-2px_rgba(34,211,238,0.6)] transition hover:scale-[1.03] hover:shadow-[0_0_26px_rgba(168,85,247,0.7)]',
        className,
      )}
    >
      {/* The button is always the midnight coach, as the popup it opens is. */}
      <span className="dark flex items-center gap-2 rounded-full bg-[#0b1020] py-1 pl-1 pr-3.5">
        <Orb size={26} />
        <span className="bg-gradient-to-r from-cyan-300 to-purple-300 bg-clip-text text-xs font-extrabold text-transparent">AI Coach</span>
        <span className="rounded-full bg-cyan-400/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 ring-1 ring-cyan-400/30">{visiblePicks(data.items, []).length} picks</span>
      </span>
    </button>
  );
}

/**
 * Opens the coach's popup by itself when there are picks to show, once per sign-in: every login shows it (signing in
 * or out forgets that it was shown — `lib/ai-coach-session`), and so does a new browser session; moving between pages
 * and back to the dashboard does not.
 */
export function useAiCoachAutoOpen(exam: string, stage: string, open: () => void) {
  const { data } = useRecommendations(exam, stage);
  const ready = !!data && data.items.length > 0;
  useEffect(() => {
    if (!ready) return;
    const key = aiCoachShownKey(exam, stage);
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* storage blocked: show it, it costs one popup */
    }
    open();
    // `open` is a fresh closure each render; only the arrival of picks should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, exam, stage]);
}

// ─── After a test ────────────────────────────────────────────────────────────

/**
 * "Next up" on the result page, right after a submit: the coach's best pick other than the paper just taken. The picks
 * are asked for again on arrival, since this attempt changes them; while the backend works them out it says so.
 */
export function NextUpCard({ exam, stage, justTaken }: { exam: string; stage: string; justTaken: string }) {
  const qc = useQueryClient();
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: ['recommendations'] });
  }, [qc]);
  const { data, isError } = useRecommendations(exam, stage);
  const feedback = useRecommendationFeedback(exam, stage);
  if (isError || !data) return null;

  const next = data.items.find(r => r.target.test_id !== justTaken);
  if (!next) {
    if (data.status !== 'computing') return null;
    return (
      <div data-no-print className="mb-4">
        <Shell>
          <p className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
            <Orb size={32} /> Working out what you should practise next <ThinkingDots />
          </p>
        </Shell>
      </div>
    );
  }

  return (
    <div data-no-print className="mb-4">
      <Shell>
        <div className="flex flex-wrap items-center gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-white', NEON_FILL)}>
                <Sparkles className="h-3 w-3" /> Next for you
              </span>
              <TypePill type={next.type} />
            </div>
            <p className="mt-1.5 flex flex-wrap items-center gap-2 text-lg font-extrabold text-slate-900 dark:text-white">
              {recommendationTitle(next)}
              <KindTag rec={next} />
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{recommendationPlace(next)}</span>
            </p>
            <div className="mt-2">
              <CoachSays text={next.reason} source={next.reason_source} wait={300} />
            </div>
          </div>
          <Link
            to={recommendationHref(next)}
            onClick={() => !next.target.is_locked && feedback.mutate({ recId: next.rec_id, action: 'started' })}
            className={cn(
              'inline-flex h-11 flex-shrink-0 items-center gap-2 rounded-xl px-5 text-sm font-bold transition',
              next.target.is_locked
                ? 'border border-amber-300 dark:border-amber-400/50 bg-amber-50 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-400/20'
                : cn('mge-sheen text-white hover:scale-[1.03] hover:shadow-[0_0_36px_rgba(168,85,247,0.6)]', AI_FILL),
            )}
          >
            {next.target.is_locked ? (
              <>
                <Lock className="h-4 w-4" /> Unlock
              </>
            ) : (
              <>
                Start practice <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Link>
        </div>
      </Shell>
    </div>
  );
}
