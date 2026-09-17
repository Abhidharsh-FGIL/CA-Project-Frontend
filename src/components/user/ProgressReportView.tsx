/**
 * The Progress Report — the 12 modules of §6's page architecture.
 *
 * Every figure comes from `buildProgressReport`; this file renders and nothing
 * more (§21 steps 27–29). Where the model reports a dimension as unavailable the
 * module says so rather than thinning out into a plausible-looking chart (§3, §19).
 */
import { useMemo, useState } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Flag,
  Gauge,
  LineChart as LineChartIcon,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BUCKET_LABEL,
  TREND_LABEL,
  type GapRow,
  type GapState,
  type PlanPriority,
  type ProgressReportModel,
  type SubjectProgress,
  type TrendStatus,
} from '@/lib/progress-report';

/**
 * Three series on one chart, validated for colour-blind separation in both themes
 * (worst adjacent pair ΔE 16.7, well clear of the 8-point floor).
 */
const SERIES = { score: '#6366f1', accuracy: '#e11d48', attemptRate: '#0891b2' };

const TREND_TONE: Record<TrendStatus, string> = {
  STRENGTH: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  IMPROVING: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  STABLE: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700',
  DECLINING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  PERSISTENT_GAP: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  NEW_GAP: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800',
  INSUFFICIENT_EVIDENCE: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700',
  NOT_TESTED: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700',
};

const GAP_TONE: Record<GapState, string> = {
  RESOLVED: 'text-emerald-700 dark:text-emerald-300',
  IMPROVING: 'text-emerald-700 dark:text-emerald-300',
  PERSISTENT: 'text-rose-700 dark:text-rose-300',
  NEW: 'text-amber-700 dark:text-amber-300',
};

const fmtPct = (v: number | null) => (v == null ? '—' : `${v}%`);
const signed = (v: number | null, unit = ' pp') => (v == null ? '—' : `${v > 0 ? '+' : ''}${v}${unit}`);
const day = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

function ModuleHead({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0 flex items-start gap-2.5">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 inline-flex items-center gap-1.5">
            {icon}
            {title}
          </p>
          {subtitle && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** The plain-language takeaway every chart carries (§18). */
function Takeaway({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-[11px] leading-relaxed text-gray-600 dark:text-gray-400">
      <span className="font-semibold text-gray-700 dark:text-gray-300">What this means: </span>
      {children}
    </p>
  );
}

function Unavailable({ reason }: { reason: string }) {
  return (
    <p className="text-[11px] leading-relaxed text-gray-400 dark:text-gray-500 inline-flex items-start gap-1.5">
      <CircleSlash className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
      {reason}
    </p>
  );
}

function TrendArrow({ delta }: { delta: number | null }) {
  if (delta == null || Math.abs(delta) < 1) return <ArrowRight className="w-3.5 h-3.5 text-gray-400" />;
  return delta > 0 ? (
    <ArrowUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
  ) : (
    <ArrowDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
  );
}

// ─── 1. Cover / report context (§6.1) ──────────────────────────────────────────

export function ReportCover({
  model,
  studentName,
  examName,
}: {
  model: ProgressReportModel;
  studentName: string;
  examName?: string | null;
}) {
  const rows: Array<[string, string]> = [
    ['Student', studentName],
    ...(examName ? ([['Exam', examName]] as Array<[string, string]>) : []),
    ['Attempts in window', String(model.window.attempts)],
    ['First attempt', day(model.window.firstDate)],
    ['Latest attempt', day(model.window.latestDate)],
  ];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/50 dark:via-purple-950/50 dark:to-pink-950/50 p-5 sm:p-6">
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-300/30 dark:bg-purple-700/20 rounded-full blur-3xl pointer-events-none" />
      <div className="relative">
        <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-700 dark:text-indigo-300 font-bold mb-1.5">
          Progress Report
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Your journey so far
        </h1>
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5 max-w-2xl">
          How your performance has moved across attempts, which gaps are closing, and what to do next.
        </p>
        <dl className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-4">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/70 dark:bg-gray-900/60 px-3 py-2">
              <dt className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">{k}</dt>
              <dd className="text-xs font-bold text-gray-900 dark:text-gray-100 mt-0.5">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

// ─── 2. Executive dashboard (§7) ───────────────────────────────────────────────

export function ExecutiveDashboard({ model }: { model: ProgressReportModel }) {
  const h = model.headline;
  const r = model.readiness;

  const tiles: Array<{ label: string; value: string; hint: string; tone?: 'good' | 'warn' }> = [
    {
      label: 'Latest score',
      value: h.latestScore != null && h.latestMax != null ? `${h.latestScore}/${h.latestMax}` : fmtPct(h.latestScorePct),
      hint:
        h.latestScorePct != null
          ? `${h.latestScorePct}% of the paper${h.scoreDeltaMarks != null ? ` · ${signed(h.scoreDeltaMarks, ' marks')} vs first` : ''}`
          : 'No scored attempt',
    },
    {
      label: 'Best score',
      value: fmtPct(h.bestScorePct),
      hint: h.bestAttemptLabel ? `Your best was ${h.bestAttemptLabel}` : '—',
    },
    {
      // Points and marks are labelled separately — a marks difference printed as a
      // percentage is the mislabelling §7 singles out.
      label: 'Score movement',
      value: signed(h.scoreDeltaPoints),
      hint: h.scoreDeltaMarks != null ? `${signed(h.scoreDeltaMarks, ' marks')} in raw terms` : 'Needs two attempts',
      tone: (h.scoreDeltaPoints ?? 0) >= 0 ? 'good' : 'warn',
    },
    { label: 'Attempts', value: String(model.window.attempts), hint: 'In this window' },
    {
      label: 'Latest accuracy',
      value: fmtPct(h.latestAccuracy),
      hint: h.accuracyDeltaPoints != null ? `${signed(h.accuracyDeltaPoints)} vs first attempt` : 'Of questions attempted',
      tone: (h.accuracyDeltaPoints ?? 0) >= 0 ? 'good' : 'warn',
    },
    {
      label: 'Attempt rate',
      value: fmtPct(h.latestAttemptRate),
      hint: h.attemptRateDeltaPoints != null ? `${signed(h.attemptRateDeltaPoints)} vs first attempt` : 'Of the paper reached',
      tone: (h.attemptRateDeltaPoints ?? 0) >= 0 ? 'good' : 'warn',
    },
  ];

  return (
    <Card>
      <ModuleHead icon={<Gauge className="w-4 h-4 text-indigo-500" />} title="Where you stand now" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {tiles.map(t => (
          <div key={t.label} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
            <p
              className={cn(
                'text-lg font-bold leading-none',
                t.tone === 'good'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : t.tone === 'warn'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-gray-900 dark:text-gray-100',
              )}
            >
              {t.value}
            </p>
            <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mt-1.5">{t.label}</p>
            <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t.hint}</p>
          </div>
        ))}
      </div>

      {/* Percentile is absent by design: §3 forbids it without a valid cohort. */}
      {!model.dataQuality.cohortAvailable && (
        <p className="mt-2.5 text-[10px] text-gray-400 dark:text-gray-500">
          Percentile and rank are not shown — they need a comparison cohort, which this platform does not yet
          record.
        </p>
      )}

      {r && (
        <div className="mt-3 rounded-xl border border-indigo-100 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30 p-3">
          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
            Readiness {r.grade} · {r.label}{' '}
            <span className="font-normal text-gray-500 dark:text-gray-400">({r.score}/100)</span>
          </p>
          <p className="text-[11px] text-gray-700 dark:text-gray-300 mt-1 leading-relaxed">
            Held back most by {r.blockers.map(b => b.label.toLowerCase()).join(' and ')}.
            {r.nextBand ? ` ${r.nextBand}` : ''}
          </p>
        </div>
      )}

      <div className="mt-3 space-y-1.5">
        {model.narrative.trajectory.map((line, i) => (
          <p key={i} className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
            {line}
          </p>
        ))}
        {model.narrative.improvementDrivers.length > 0 && (
          <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
            <span className="font-semibold">Largest gains: </span>
            {model.narrative.improvementDrivers.join('; ')}.
          </p>
        )}
        {model.narrative.persistentGaps.length > 0 && (
          <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
            <span className="font-semibold">Still unresolved: </span>
            {model.narrative.persistentGaps.join('; ')}.
          </p>
        )}
        {model.narrative.behaviour.map((line, i) => (
          <p key={`b${i}`} className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">
            {line}
          </p>
        ))}
      </div>
    </Card>
  );
}

// ─── 3. Performance journey (§8) ───────────────────────────────────────────────

export function PerformanceJourney({
  model,
  examName,
}: {
  model: ProgressReportModel;
  examName?: string | null;
}) {
  const data = model.attempts.map(a => ({
    label: a.label.length > 14 ? `${a.label.slice(0, 13)}…` : a.label,
    full: a.label,
    date: a.date,
    scorePct: a.scorePct,
    accuracy: a.accuracyPct,
    attemptRate: a.attemptRatePct,
    score: a.score,
    maxScore: a.maxScore,
    correct: a.correct,
    incorrect: a.incorrect,
    unattempted: a.unattempted,
  }));

  return (
    <Card>
      <ModuleHead
        icon={<LineChartIcon className="w-4 h-4 text-indigo-500" />}
        title="Your progress journey"
        subtitle={
          // Naming the exam matters here: the curve only means something because
          // every point on it is the same paper family.
          examName
            ? `Score, accuracy and attempt rate across your ${examName} attempts`
            : 'Score, accuracy and attempt rate across attempts'
        }
      />
      {data.length === 0 ? (
        <Unavailable
          reason={
            examName
              ? `No submitted ${examName} attempts in this window yet.`
              : 'No submitted attempts in this window yet.'
          }
        />
      ) : (
        <>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#e5e7eb" strokeOpacity={0.5} vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                {/* One axis, not two. Score is plotted as a percentage of its own
                    paper so all three series share a 0–100 scale — which is also
                    what §5 requires for comparability when maxima differ. */}
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: '#9ca3af' }}
                  width={40}
                />
                <Tooltip content={<JourneyTooltip />} />
                <Bar dataKey="scorePct" name="Score %" fill={SERIES.score} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line
                  type="monotone"
                  dataKey="accuracy"
                  name="Accuracy %"
                  stroke={SERIES.accuracy}
                  strokeWidth={2}
                  dot={{ r: 4, fill: SERIES.accuracy }}
                />
                <Line
                  type="monotone"
                  dataKey="attemptRate"
                  name="Attempt rate %"
                  stroke={SERIES.attemptRate}
                  strokeWidth={2}
                  dot={{ r: 4, fill: SERIES.attemptRate }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400 mt-1">
            {[
              ['Score %', SERIES.score],
              ['Accuracy %', SERIES.accuracy],
              ['Attempt rate %', SERIES.attemptRate],
            ].map(([label, colour]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: colour }} />
                {label}
              </span>
            ))}
          </div>
          <Takeaway>{model.journeyTakeaway}</Takeaway>
          {model.keyTakeaways.length > 0 && (
            <div className="mt-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Key takeaways</p>
              <ul className="space-y-1.5">
                {model.keyTakeaways.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-gray-700 dark:text-gray-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-px" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-2 text-[10px] text-gray-400 dark:text-gray-500">
            Score is shown as a percentage of each paper so attempts with different maximum marks stay
            comparable. Raw marks are in the tooltip.
          </p>
        </>
      )}
    </Card>
  );
}

function JourneyTooltip({ active, payload }: any) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg max-w-[16rem]">
      <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">{d.full}</p>
      <p className="text-[10px] text-gray-400 mb-1.5">{day(d.date)}</p>
      <ul className="space-y-0.5 text-[11px] tabular-nums">
        <li className="flex justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Score</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {d.score != null && d.maxScore != null ? `${d.score}/${d.maxScore}` : '—'} ({fmtPct(d.scorePct)})
          </span>
        </li>
        <li className="flex justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Accuracy</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">{fmtPct(d.accuracy)}</span>
        </li>
        <li className="flex justify-between gap-4">
          <span className="text-gray-500 dark:text-gray-400">Attempt rate</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">{fmtPct(d.attemptRate)}</span>
        </li>
        <li className="flex justify-between gap-4 pt-1 border-t border-gray-100 dark:border-gray-800">
          <span className="text-gray-500 dark:text-gray-400">C / I / Skipped</span>
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {d.correct} / {d.incorrect} / {d.unattempted}
          </span>
        </li>
      </ul>
    </div>
  );
}

// ─── 4. Proficiency radar (§9) ─────────────────────────────────────────────────

export function ProficiencyRadarModule({ model }: { model: ProgressReportModel }) {
  const plotted = model.subjects.filter(s => s.first?.accuracy != null || s.latest?.accuracy != null);

  if (plotted.length < 3) {
    return (
      <Card>
        <ModuleHead icon={<Target className="w-4 h-4 text-indigo-500" />} title="Subject proficiency" />
        <Unavailable
          reason={`Only ${plotted.length} subject${plotted.length === 1 ? '' : 's'} have enough attempted questions to plot. The subject table below carries the same figures.`}
        />
      </Card>
    );
  }

  const data = plotted.map(s => ({
    subject: s.name.length > 22 ? `${s.name.slice(0, 21)}…` : s.name,
    first: s.first?.accuracy ?? null,
    latest: s.latest?.accuracy ?? null,
  }));

  const gains = [...plotted].sort((a, b) => (b.deltaPoints ?? 0) - (a.deltaPoints ?? 0));
  const bestGain = gains[0];
  const worstGain = gains[gains.length - 1];
  const strongestLatest = [...plotted].sort(
    (a, b) => (b.latest?.accuracy ?? 0) - (a.latest?.accuracy ?? 0),
  )[0];

  return (
    <Card>
      <ModuleHead
        icon={<Target className="w-4 h-4 text-indigo-500" />}
        title="Subject proficiency — first vs latest"
        subtitle="Accuracy on attempted questions, same scale for both"
      />
      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="70%" margin={{ top: 12, right: 28, bottom: 12, left: 28 }}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#6b7280' }} />
            <PolarRadiusAxis domain={[0, 100]} tickCount={5} angle={90} tick={{ fontSize: 9, fill: '#9ca3af' }} />
            <Tooltip content={<RadarCompareTooltip rows={plotted} />} />
            <Radar name="First" dataKey="first" stroke="#9ca3af" fill="#9ca3af" fillOpacity={0.12} dot={{ r: 2.5 }} />
            <Radar
              name="Latest"
              dataKey="latest"
              stroke={SERIES.score}
              strokeWidth={2}
              fill={SERIES.score}
              fillOpacity={0.18}
              dot={{ r: 3, fill: SERIES.score }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> First measured attempt
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: SERIES.score }} /> Latest attempt
        </span>
      </div>
      <Takeaway>
        {bestGain && (bestGain.deltaPoints ?? 0) > 0 && (
          <>
            Largest gain: {bestGain.name} ({signed(bestGain.deltaPoints)}, {bestGain.first?.accuracy}% →{' '}
            {bestGain.latest?.accuracy}%).{' '}
          </>
        )}
        {worstGain && (worstGain.deltaPoints ?? 0) < 0 && (
          <>
            Largest decline: {worstGain.name} ({signed(worstGain.deltaPoints)}).{' '}
          </>
        )}
        {strongestLatest && (
          <>
            Strongest right now: {strongestLatest.name} at {strongestLatest.latest?.accuracy}%.
          </>
        )}
      </Takeaway>
    </Card>
  );
}

function RadarCompareTooltip({ active, payload, rows }: any) {
  const name = payload?.[0]?.payload?.subject;
  const row: SubjectProgress | undefined = rows.find(
    (r: SubjectProgress) => r.name === name || r.name.startsWith(String(name).replace('…', '')),
  );
  if (!active || !row) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg max-w-[15rem]">
      <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">{row.name}</p>
      <p className="text-[11px] text-gray-700 dark:text-gray-200 mt-0.5 tabular-nums">
        {row.first?.accuracy ?? '—'}% → {row.latest?.accuracy ?? '—'}% ({signed(row.deltaPoints)})
      </p>
      <p className="text-[10px] text-gray-400 mt-0.5">
        {row.evidenceCount} attempted across {row.attemptsObserved} attempt{row.attemptsObserved === 1 ? '' : 's'}
      </p>
    </div>
  );
}

// ─── 5 + 6. Subject-wise progress with inline deep dive (§10, §18) ─────────────

export function SubjectProgressTable({ model }: { model: ProgressReportModel }) {
  const [open, setOpen] = useState<string | null>(null);
  const labels = model.attempts.map(a => a.label);

  return (
    <Card>
      <ModuleHead
        icon={<TrendingUp className="w-4 h-4 text-indigo-500" />}
        title="Subject-wise progress"
        subtitle="Accuracy per attempt. Click a subject to open its detail here"
      />
      <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
        <table className="w-full text-[11px] min-w-[560px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
              <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Subject</th>
              {labels.map((l, i) => (
                <th key={i} className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400 text-right whitespace-nowrap">
                  {l.length > 10 ? `${l.slice(0, 9)}…` : l}
                </th>
              ))}
              <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400 text-right">Best</th>
              <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Trend</th>
            </tr>
          </thead>
          <tbody>
            {model.subjects.map(s => {
              const byAttempt = new Map(s.series.map(x => [x.attemptId, x.metrics]));
              const isOpen = open === s.subjectId;
              return (
                <>
                  <tr
                    key={s.subjectId}
                    onClick={() => setOpen(cur => (cur === s.subjectId ? null : s.subjectId))}
                    className={cn(
                      'border-b border-gray-50 dark:border-gray-800/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/60',
                      isOpen && 'bg-indigo-50/40 dark:bg-indigo-950/20',
                    )}
                  >
                    <td className="px-2 py-2 font-semibold text-gray-900 dark:text-gray-100">
                      <span className="inline-flex items-center gap-1.5">
                        <ChevronDown className={cn('w-3 h-3 text-gray-400 transition-transform', isOpen && 'rotate-180')} />
                        {s.name}
                      </span>
                    </td>
                    {model.attempts.map(a => {
                      const m = byAttempt.get(a.attemptId);
                      return (
                        <td key={a.attemptId} className="px-2 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                          {m == null || m.accuracy == null ? (
                            <span className="text-gray-300 dark:text-gray-600">—</span>
                          ) : (
                            `${m.accuracy}%`
                          )}
                        </td>
                      );
                    })}
                    <td className="px-2 py-2 text-right tabular-nums font-bold text-gray-900 dark:text-gray-100">
                      {fmtPct(s.bestAccuracy)}
                    </td>
                    <td className="px-2 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        <TrendArrow delta={s.deltaPoints} />
                        <span className={cn('px-1.5 py-0.5 rounded border font-semibold', TREND_TONE[s.status])}>
                          {TREND_LABEL[s.status]}
                        </span>
                      </span>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${s.subjectId}-d`} className="bg-gray-50/60 dark:bg-gray-800/30">
                      <td colSpan={labels.length + 3} className="px-2 py-3">
                        <SubjectDeepDive subject={s} model={model} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
      <Takeaway>
        A dash means the subject was not attempted enough times in that paper to measure. Accuracy counts only
        attempted questions, so a skipped subject is never shown as 0%.
      </Takeaway>
    </Card>
  );
}

/** §6 / §18 — the same component for every subject, opened inline. */
function SubjectDeepDive({ subject, model }: { subject: SubjectProgress; model: ProgressReportModel }) {
  const s = subject;
  const tiles: Array<[string, string]> = [
    ['Latest accuracy', fmtPct(s.latest?.accuracy ?? null)],
    ['First measured', fmtPct(s.first?.accuracy ?? null)],
    ['Movement', signed(s.deltaPoints)],
    ['Best', fmtPct(s.bestAccuracy)],
    ['Evidence', `${s.evidenceCount} attempted over ${s.attemptsObserved} attempt${s.attemptsObserved === 1 ? '' : 's'}`],
  ];

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">{s.interpretation}</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-2.5 py-2">
            <p className="text-[9px] uppercase tracking-wide text-gray-400">{label}</p>
            <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100 mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">Attempt by attempt</p>
        <div className="flex flex-wrap gap-1.5">
          {s.series.map(x => (
            <span
              key={x.attemptId}
              className="text-[10px] rounded-lg bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-2 py-1 text-gray-600 dark:text-gray-300"
              title={`${x.metrics.correct} correct of ${x.metrics.attempted} attempted, ${x.metrics.questions} in the paper`}
            >
              {x.label}: {x.metrics.accuracy == null ? '—' : `${x.metrics.accuracy}%`}{' '}
              <span className="text-gray-400">
                ({x.metrics.correct} of {x.metrics.attempted} correct)
              </span>
            </span>
          ))}
        </div>
      </div>

      {/* §19 — stop at the level the tests actually tag. */}
      {model.dataQuality.taxonomyDepth === 'SUBJECT' && (
        <Unavailable reason="Topic and sub-topic tagging is unavailable for these tests, so the breakdown stops at subject level." />
      )}
    </div>
  );
}

// ─── 7. Gap evolution (§11) ────────────────────────────────────────────────────

const GAP_TABS: Array<{ key: 'all' | GapState; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'IMPROVING', label: 'Improving' },
  { key: 'PERSISTENT', label: 'Persistent' },
  { key: 'NEW', label: 'New' },
];

export function GapEvolution({ model }: { model: ProgressReportModel }) {
  const [tab, setTab] = useState<'all' | GapState>('all');
  const all = useMemo(
    () => [...model.gaps.resolved, ...model.gaps.improving, ...model.gaps.persistent, ...model.gaps.new],
    [model.gaps],
  );
  const counts: Record<'all' | GapState, number> = {
    all: all.length,
    RESOLVED: model.gaps.resolved.length,
    IMPROVING: model.gaps.improving.length,
    PERSISTENT: model.gaps.persistent.length,
    NEW: model.gaps.new.length,
  };
  const rows: GapRow[] = tab === 'all' ? all : all.filter(g => g.state === tab);

  return (
    <Card>
      <ModuleHead
        icon={<Flag className="w-4 h-4 text-indigo-500" />}
        title="Gap evolution across attempts"
        subtitle="Which weaknesses are closing, and which are not"
      />
      {model.comparability === 'BASELINE_ONLY' ? (
        <Unavailable reason="Gap evolution compares attempts — it appears once you have a second one." />
      ) : all.length === 0 ? (
        <Unavailable reason="No subject has enough measured attempts on both ends to compare yet." />
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {GAP_TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  'text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
                  tab === t.key
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                    : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
                )}
              >
                {t.label} ({counts[t.key]})
              </button>
            ))}
          </div>

          <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
            <table className="w-full text-[11px] min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
                  <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Subject</th>
                  <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400 text-right">First</th>
                  <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400 text-right">Latest</th>
                  <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400 text-right">Movement</th>
                  <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400 text-right">Sample</th>
                  <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(g => (
                  <tr key={g.subjectId} className="border-b border-gray-50 dark:border-gray-800/60">
                    <td className="px-2 py-2 font-semibold text-gray-900 dark:text-gray-100">{g.name}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                      {fmtPct(g.firstAccuracy)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                      {fmtPct(g.latestAccuracy)}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums font-semibold">
                      <span className={(g.deltaPoints ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {signed(g.deltaPoints)}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-400">{g.latestSample}</td>
                    <td className={cn('px-2 py-2 font-semibold', GAP_TONE[g.state])}>
                      {g.state.charAt(0) + g.state.slice(1).toLowerCase()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Takeaway>
            A gap that is rising but still below {model.config.gapAccuracy}% stays{' '}
            <span className="font-semibold">Persistent</span> — the movement is real but the weakness has not
            closed. Only a subject that has climbed past the threshold counts as Improving.
          </Takeaway>
        </>
      )}
    </Card>
  );
}

// ─── 8 + 9. Behaviour and error analysis (§12) ─────────────────────────────────

export function BehaviourAnalysis({ model }: { model: ProgressReportModel }) {
  const latest = model.attempts[model.attempts.length - 1];
  if (!latest) return null;

  const total = Math.max(1, latest.totalQuestions);
  const segments = [
    { label: 'Correct', value: latest.correct, colour: '#059669' },
    { label: 'Incorrect', value: latest.incorrect, colour: '#e11d48' },
    { label: 'Unattempted', value: latest.unattempted, colour: '#cbd5e1' },
  ];
  const wrongRate = latest.correct + latest.incorrect > 0
    ? Math.round((latest.incorrect / (latest.correct + latest.incorrect)) * 1000) / 10
    : null;

  return (
    <Card>
      <ModuleHead
        icon={<Sparkles className="w-4 h-4 text-indigo-500" />}
        title="Accuracy and attempt behaviour"
        subtitle="Whether marks are lost to knowledge or to how the paper was worked"
      />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: 'Attempt rate', value: fmtPct(latest.attemptRatePct), delta: model.headline.attemptRateDeltaPoints },
          { label: 'Accuracy', value: fmtPct(latest.accuracyPct), delta: model.headline.accuracyDeltaPoints },
          { label: 'Wrong-answer rate', value: fmtPct(wrongRate), delta: null },
          {
            label: 'Avg time / question',
            value:
              model.avgTimePerQuestionSec != null ? `${Math.round(model.avgTimePerQuestionSec)} sec` : '—',
            delta: null,
          },
        ].map(t => (
          <div key={t.label} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 leading-none">{t.value}</p>
            <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 mt-1.5">{t.label}</p>
            {t.delta != null && (
              <p className={cn('text-[10px] font-semibold mt-0.5', t.delta >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                {signed(t.delta)} vs first
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
          Where the latest paper went
        </p>
        <div className="flex items-center gap-[2px] h-3 rounded overflow-hidden">
          {segments.map(seg => (
            <div
              key={seg.label}
              title={`${seg.label}: ${seg.value} of ${total}`}
              style={{ width: `${(seg.value / total) * 100}%`, background: seg.colour }}
              className="h-full first:rounded-l last:rounded-r"
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[10px] text-gray-500 dark:text-gray-400">
          {segments.map(seg => (
            <span key={seg.label} className="inline-flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: seg.colour }} />
              {seg.label} {seg.value} ({Math.round((seg.value / total) * 100)}%)
            </span>
          ))}
        </div>
      </div>

      <Takeaway>
        {(latest.attemptRatePct ?? 0) < 60
          ? `Only ${latest.attemptRatePct}% of the paper was reached, so the biggest single loss is questions never answered rather than answered wrongly.`
          : `${latest.attemptRatePct}% of the paper was reached, so accuracy is what now decides the score.`}
      </Takeaway>

    </Card>
  );
}

// ─── 10. Exam readiness (§13) ──────────────────────────────────────────────────

export function ExamReadiness({ model }: { model: ProgressReportModel }) {
  const r = model.readiness;
  if (!r) {
    return (
      <Card>
        <ModuleHead icon={<Gauge className="w-4 h-4 text-indigo-500" />} title="Exam readiness" />
        <Unavailable reason="Readiness needs at least one attempt with question-level detail." />
      </Card>
    );
  }

  return (
    <Card>
      <ModuleHead
        icon={<Gauge className="w-4 h-4 text-indigo-500" />}
        title="Exam readiness"
        subtitle="A weighted composite — every component and weight is shown"
      />
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-shrink-0 text-center">
          <div className="w-24 h-24 rounded-full border-8 border-indigo-100 dark:border-indigo-950/60 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none">{r.grade}</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{r.score}/100</span>
          </div>
          <p className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 mt-1.5">{r.label}</p>
        </div>

        <ul className="flex-1 space-y-2 min-w-0">
          {r.components.map(c => (
            <li key={c.key}>
              <div className="flex items-baseline justify-between gap-3 text-[11px]">
                <span className="font-semibold text-gray-700 dark:text-gray-200">
                  {c.label} <span className="font-normal text-gray-400">· {c.weight}% weight</span>
                </span>
                <span className="tabular-nums text-gray-500 dark:text-gray-400">{Math.round(c.value)}/100</span>
              </div>
              <div className="mt-1 h-1.5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <div className="h-full rounded" style={{ width: `${Math.min(100, c.value)}%`, background: SERIES.score }} />
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">{c.evidence}</p>
            </li>
          ))}
        </ul>
      </div>
      <Takeaway>
        {r.nextBand ?? `Grade ${r.grade}.`} Weights re-normalize when a component has no data, so the shown
        weights always total 100 — the syllabus-coverage component is absent here because no blueprint is
        configured.
      </Takeaway>
    </Card>
  );
}

// ─── 11 + 12. Next-phase plan and weekly view (§14, §15) ───────────────────────

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function NextPhasePlan({ model }: { model: ProgressReportModel }) {
  if (model.priorities.length === 0) {
    return (
      <Card>
        <ModuleHead icon={<Flag className="w-4 h-4 text-indigo-500" />} title="Next-phase study plan" />
        <Unavailable reason="A plan needs at least one measured subject to prioritise." />
      </Card>
    );
  }

  return (
    <Card>
      <ModuleHead
        icon={<Flag className="w-4 h-4 text-indigo-500" />}
        title="Personalised next-phase plan"
        subtitle={`${model.priorities.length} active priorities, ${model.queuedPriorities.length} queued`}
      />
      <ol className="space-y-2.5">
        {model.priorities.map(p => (
          <PriorityCard key={p.subjectId} p={p} />
        ))}
      </ol>
      {model.queuedPriorities.length > 0 && (
        <p className="mt-2.5 text-[11px] text-gray-500 dark:text-gray-400">
          Queued for a later cycle: {model.queuedPriorities.map(p => p.name).join(', ')}. Held back so the
          active list stays achievable.
        </p>
      )}
      <Takeaway>
        Time and question volume are allocated by priority score, so a severe persistent gap gets a longer
        session than a subject on maintenance — not the same slot for everything.
      </Takeaway>
    </Card>
  );
}

function PriorityCard({ p }: { p: PlanPriority }) {
  return (
    <li className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
            {p.rank}. {p.name}
          </p>
          <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">{p.evidence}</p>
        </div>
        <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
          {BUCKET_LABEL[p.bucket]}
        </span>
      </div>
      <p className="text-[11px] text-gray-700 dark:text-gray-200 mt-1.5 leading-relaxed">{p.action}</p>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
        <span>{p.minutesPerSession} min × {p.sessionsPerWeek}/week</span>
        <span>{p.questionTarget} questions</span>
        <span>Priority {p.score}/100</span>
      </div>
      <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">
        <span className="font-semibold">Success: </span>
        {p.successCriterion}
      </p>
      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
        <span className="font-semibold">If not met: </span>
        {p.escalation}
      </p>
    </li>
  );
}

/**
 * §15 — the week is built from the ranked priorities, not from a template.
 *
 * Higher-ranked priorities take more slots, a strength gets a single maintenance
 * set, and the week always closes with review, so two students with different
 * profiles get visibly different weeks.
 */
export function WeeklyPlan({ model }: { model: ProgressReportModel }) {
  const rows = useMemo(() => buildWeek(model), [model]);
  if (rows.length === 0) return null;

  const totalMinutes = rows.reduce((n, r) => n + r.minutes, 0);

  return (
    <Card>
      <ModuleHead
        icon={<CalendarDays className="w-4 h-4 text-indigo-500" />}
        title="This week"
        subtitle={`${totalMinutes} minutes across ${rows.filter(r => r.minutes > 0).length} working days`}
      />
      <div className="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
        <table className="w-full text-[11px] min-w-[560px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 text-left">
              <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Day</th>
              <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Focus</th>
              <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400">Task</th>
              <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400 text-right">Time</th>
              <th className="px-2 py-2 font-semibold text-gray-500 dark:text-gray-400 text-right">Practice</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.day} className="border-b border-gray-50 dark:border-gray-800/60">
                <td className="px-2 py-2 font-semibold text-gray-900 dark:text-gray-100">{r.day}</td>
                <td className="px-2 py-2 text-gray-700 dark:text-gray-200">{r.focus}</td>
                <td className="px-2 py-2 text-gray-600 dark:text-gray-300">{r.task}</td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {r.minutes > 0 ? `${r.minutes} min` : '—'}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                  {r.questions > 0 ? `${r.questions} Qs` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Takeaway>
        Built from your ranked priorities rather than a fixed timetable — the top gap appears twice with a
        spaced revisit, strengths get one maintenance set, and Sunday closes the loop on errors.
      </Takeaway>
      <p className="mt-1 text-[10px] text-gray-400 dark:text-gray-500">
        Durations are a suggested schedule. No study-time budget is recorded for your account yet, so the plan
        cannot yet be capped to your real availability.
      </p>
    </Card>
  );
}

interface WeekRow {
  day: string;
  focus: string;
  task: string;
  minutes: number;
  questions: number;
}

function buildWeek(model: ProgressReportModel): WeekRow[] {
  const active = model.priorities;
  if (active.length === 0) return [];

  const rows: WeekRow[] = [];
  const top = active[0];
  const second = active[1];
  const third = active[2];
  const maintain = [...active, ...model.queuedPriorities].find(p => p.bucket === 'MAINTAIN');

  const push = (day: string, p: PlanPriority | undefined, task: string, scale = 1) => {
    if (!p) {
      rows.push({ day, focus: 'Flexible', task: 'Catch up on anything missed, or rest.', minutes: 0, questions: 0 });
      return;
    }
    rows.push({
      day,
      focus: p.name,
      task,
      minutes: Math.round((p.minutesPerSession * scale) / 5) * 5,
      questions: Math.round(p.questionTarget * scale),
    });
  };

  push(WEEK_DAYS[0], top, top.action);
  push(WEEK_DAYS[1], second ?? top, (second ?? top).action);
  push(WEEK_DAYS[2], maintain ?? third ?? top, maintain ? maintain.action : (third ?? top).action);
  // A spaced revisit of the hardest item, 3 days after its first session (§14.3).
  push(WEEK_DAYS[3], top, `Spaced re-test on ${top.name} — same topics, fresh questions, no notes.`, 0.7);
  push(WEEK_DAYS[4], third ?? second ?? top, (third ?? second ?? top).action);
  rows.push({
    day: WEEK_DAYS[5],
    focus: 'Full paper',
    task: 'Timed sectional or full-length mock, then mark it honestly.',
    minutes: 120,
    questions: 0,
  });
  rows.push({
    day: WEEK_DAYS[6],
    focus: 'Review',
    task: `Work the error log from the week, starting with ${top.name}.`,
    minutes: 45,
    questions: 0,
  });

  return rows;
}

// ─── Assembled report ──────────────────────────────────────────────────────────

export function ProgressReportView({
  model,
  studentName,
  examName,
}: {
  model: ProgressReportModel;
  studentName: string;
  /** The exam this window belongs to, when the caller can resolve it. */
  examName?: string | null;
}) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <ReportCover model={model} studentName={studentName} examName={examName} />

      {model.dataQuality.warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-1">
          {model.dataQuality.warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300">
              {w}
            </p>
          ))}
        </div>
      )}

      <ExecutiveDashboard model={model} />
      <PerformanceJourney model={model} examName={examName} />
      <div className="grid lg:grid-cols-2 gap-3 sm:gap-4 items-start">
        <ProficiencyRadarModule model={model} />
        <ExamReadiness model={model} />
      </div>
      <SubjectProgressTable model={model} />
      <GapEvolution model={model} />
      <BehaviourAnalysis model={model} />
      <NextPhasePlan model={model} />
      <WeeklyPlan model={model} />

      <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 py-2 inline-flex items-center justify-center gap-1.5 w-full">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        {model.narrative.studentMessage}
      </p>
    </div>
  );
}
