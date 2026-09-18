/**
 * "This Attempt" — the diagnostic surfaces, laid out to the approved design.
 *
 * Every figure comes from `buildAttemptReport`; this file renders and nothing
 * more. Styling comes from `report-ui`, so a status is asked for by meaning
 * ("focus", "developing") and the design system decides how it looks — which is
 * also what keeps these components exam-agnostic. Nothing here names a subject, a
 * topic or an exam; the taxonomy arrives in the model.
 */
import { Fragment, useMemo, useState } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  GraduationCap,
  Sparkles,
  User,
  Flag,
  Info,
  Layers,
  Lightbulb,
  Minus,
  Share2,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ACCENT,
  InsightLine,
  MeterRow,
  NotAvailable,
  ReportCard,
  ScoreRing,
  SectionHeader,
  StatTile,
  StatusPill,
  UnderlineTabs,
  LanguageToggle,
  ReportLanguageNote,
  WhatThisMeans,
  subjectHue,
  useLabel,
  type Accent,
  type ReportLanguage,
  type StatusTone,
} from '@/components/user/report-ui';
import {
  ARCHETYPE_LABEL,
  DEFAULT_REPORT_CONFIG,
  ISSUE_LABEL,
  STATUS_LABEL,
  type AttemptReportModel,
  type Confidence,
  type Insight,
  type NodeStatus,
  type SubjectNode,
  type TopicNode,
  type VerdictSeverity,
} from '@/lib/attempt-report';
import {
  langModeOptions,
  paperTranslationLang,
  type LangMode,
} from '@/lib/question-language';
import type { ExamContext } from '@/lib/exam-report-config';

const fmtPct = (v: number | null) => (v == null ? '—' : `${v}%`);
const fmtSec = (v: number | null) => (v == null ? '—' : `${Math.round(v)}s`);
const mins = (s: number | null) => (s == null ? '—' : `${Math.round(s / 60)} min`);

/** Diagnostic status → the design system's tone vocabulary. */
export const STATUS_TONE: Record<NodeStatus, StatusTone> = {
  STRONG: 'strong',
  DEVELOPING: 'developing',
  FOCUS: 'focus',
  INSUFFICIENT_EVIDENCE: 'neutral',
  NOT_ASSESSED: 'unknown',
};

/**
 * Tone for the "what this rests on" footnote.
 *
 * A well-evidenced line needs no warning colour — it recedes. Only a thin sample
 * is worth tinting, because that is the one the reader should discount.
 */
export const CONFIDENCE_TONE: Record<Confidence, string> = {
  HIGH: 'text-gray-400 dark:text-gray-500',
  MEDIUM: 'text-amber-600 dark:text-amber-400',
  LOW: 'text-amber-600 dark:text-amber-400',
};

/**
 * Presentation only. `verdict.severity` is always computed deterministically
 * (see `buildVerdict` in attempt-report.ts) even when the wording came from
 * the backend's LLM-generated text, so color-coding never depends on
 * generated content.
 */
const VERDICT_STYLE: Record<VerdictSeverity, { accent: Accent; tone: StatusTone }> = {
  not_assessed: { accent: 'slate', tone: 'unknown' },
  needs_coverage: { accent: 'rose', tone: 'focus' },
  needs_focus: { accent: 'amber', tone: 'developing' },
  on_track: { accent: 'emerald', tone: 'strong' },
};

// ─── Report cover (reference screen 1) ─────────────────────────────────────────

/**
 * The report cover.
 *
 * The right-hand side used to carry a drawn graduation motif and the motto
 * "Arivom Aarvom Vetriperuvom" — true of one exam in the catalog and wrong for
 * the rest, and in any case telling the aspirant nothing about the paper they
 * just sat. It now states the exam: who conducts it, its official title, the
 * shape of the paper, and the posts it recruits for, all read from the exam
 * configuration so a GAT-B cover describes GAT-B.
 */
export function ReportCover({
  model,
  studentName,
  examName,
  exam,
}: {
  model: AttemptReportModel;
  studentName: string;
  examName?: string | null;
  /** The selected exam's configuration. Without it the cover shows the attempt alone. */
  exam?: ExamContext | null;
}) {
  const s = model.summary;
  const title = exam?.examName ?? examName ?? null;

  /**
   * The cover's detail rows, built from the attempt rather than a fixed list — a
   * field with nothing behind it is dropped instead of printing an em dash.
   */
  const rows: Array<{ icon: React.ReactNode; label: string; value: string }> = [
    { icon: <User className="w-3.5 h-3.5" />, label: 'Student', value: studentName },
    {
      icon: <CalendarDays className="w-3.5 h-3.5" />,
      label: 'Test Date',
      value: model.meta.date
        ? new Date(model.meta.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—',
    },
    { icon: <FileText className="w-3.5 h-3.5" />, label: 'Total Questions', value: String(s.totalQuestions) },
  ];

  const duration = s.timeAllowedSec ?? s.timeUsedSec;
  if (duration != null) {
    rows.push({
      icon: <Clock className="w-3.5 h-3.5" />,
      label: 'Duration',
      value: `${Math.round(duration / 60)} Minutes`,
    });
  }
  if (exam?.stageName) {
    rows.push({ icon: <GraduationCap className="w-3.5 h-3.5" />, label: 'Stage', value: exam.stageName });
  }

  /**
   * The paper's own shape, as configured.
   *
   * Each item is dropped when the exam does not configure it, so a partially
   * described exam shows fewer facts rather than a row of dashes.
   */
  const paperFacts: Array<{ value: string; label: string }> = [];
  if (exam?.totalQuestions != null) paperFacts.push({ value: String(exam.totalQuestions), label: 'Questions' });
  if (exam?.totalMarks != null) paperFacts.push({ value: String(exam.totalMarks), label: 'Marks' });
  if (exam?.durationSec != null) {
    paperFacts.push({ value: `${Math.round(exam.durationSec / 60)}`, label: 'Minutes' });
  }
  if (exam?.taxonomy?.length) paperFacts.push({ value: String(exam.taxonomy.length), label: 'Subjects' });
  if (exam?.marking) {
    paperFacts.push({
      value: exam.marking.negativeMarking
        ? exam.marking.negativeMarkValue != null
          ? `−${exam.marking.negativeMarkValue}`
          : 'Yes'
        : 'None',
      label: 'Negative',
    });
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm px-5 py-5 sm:px-6">
      {/* Tinted by the exam's own accent, so two exams' covers are not the same
          shade of violet. Falls back to the product primary when unconfigured. */}
      <div
        className={cn(
          'absolute -top-24 -right-16 w-72 h-72 rounded-full blur-3xl opacity-[0.18] dark:opacity-[0.12] pointer-events-none bg-gradient-to-br',
          exam?.accent ?? 'from-indigo-500 via-violet-500 to-purple-600',
        )}
        aria-hidden
      />

      <div className="relative">
        {/* Brand and exam, on one line */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 flex items-center justify-center shadow-sm flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-white" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100 leading-tight">
                BrightLearn Academy
              </p>
              <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-violet-500 dark:text-violet-400">
                Learn &middot; Practice &middot; Score &middot; Succeed
              </p>
            </div>
          </div>
          {title && (
            <div className="text-right min-w-0">
              {exam?.authority && (
                <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 truncate">
                  {exam.authority}
                </p>
              )}
              <p className="text-[11px] font-bold text-[#1e2a5a] dark:text-gray-200 whitespace-nowrap">{title}</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid sm:grid-cols-[1fr_auto] items-start gap-5">
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold text-[#1e2a5a] dark:text-gray-100 leading-none">
              Assessment Report
            </h1>
            <p className="text-sm font-bold text-[#1e2a5a]/80 dark:text-gray-300 mt-1">{model.meta.testName}</p>

            {/* Tight label column so the colon sits next to the value, as designed. */}
            <dl className="mt-3.5 space-y-1.5">
              {rows.map(r => (
                <div key={r.label} className="flex items-center gap-2 text-[12px]">
                  <span className="text-violet-500 dark:text-violet-400 flex-shrink-0">{r.icon}</span>
                  <dt className="w-[104px] flex-shrink-0 text-gray-500 dark:text-gray-400">{r.label}</dt>
                  <span className="text-gray-300 dark:text-gray-600 flex-shrink-0">:</span>
                  <dd className="font-semibold text-[#1e2a5a] dark:text-gray-100 truncate">{r.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* The exam, where the artwork used to be. */}
          {(exam?.tagline || paperFacts.length > 0 || exam?.posts?.length) && (
            <div className="sm:max-w-[16rem] sm:text-right">
              {exam?.tagline && (
                <p className="text-[11px] font-semibold text-[#1e2a5a]/75 dark:text-gray-300 leading-snug">
                  {exam.tagline}
                </p>
              )}

              {paperFacts.length > 0 && (
                <>
                  <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 mt-3">
                    Paper at a glance
                  </p>
                  <div className="mt-1.5 flex flex-wrap sm:justify-end gap-1.5">
                    {paperFacts.map(f => (
                      <span
                        key={f.label}
                        className="rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50 px-2 py-1 text-center"
                      >
                        <span className="block text-[12px] font-bold tabular-nums text-[#1e2a5a] dark:text-gray-100 leading-none">
                          {f.value}
                        </span>
                        <span className="block text-[8px] uppercase tracking-wide text-gray-400 mt-0.5">
                          {f.label}
                        </span>
                      </span>
                    ))}
                  </div>
                </>
              )}

              {/* What the exam is for. More motivating than a motto, and true of
                  whichever exam this happens to be. */}
              {exam?.posts && exam.posts.length > 0 && (
                <>
                  <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500 mt-3">
                    Recruits for
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
                    {exam.posts.slice(0, 4).join(' · ')}
                    {exam.posts.length > 4 && ` and ${exam.posts.length - 4} more`}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Quote and footer sit together at the base, not floating apart. */}
        <div className="mt-4 rounded-xl border border-violet-100 dark:border-violet-900/60 bg-violet-50/70 dark:bg-violet-950/25 px-3.5 py-2.5 flex items-center gap-2.5">
          <span className="w-6 h-6 rounded-md bg-white dark:bg-gray-900 text-violet-600 dark:text-violet-400 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-[#1e2a5a] dark:text-gray-100 leading-tight">
              Every attempt is a step closer to your goal.
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">Analyse. Learn. Improve.</p>
          </div>
        </div>

        {/* The stage's own one-line description, rather than a slogan fixed to
            one state's exams. */}
        {exam?.stageDescription && (
          <p className="mt-1.5 text-right text-[9px] text-gray-400 dark:text-gray-500 italic">
            {exam.stageDescription}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Report title row (reference screen 2, top) ────────────────────────────────

export function ReportTitleRow({
  model,
  canDownload,
  onDownload,
  onShare,
  language,
  onLanguageChange,
}: {
  model: AttemptReportModel;
  canDownload?: boolean;
  onDownload?: () => void;
  onShare?: () => void;
  /**
   * The reading language, and the setter. Omitted where there is nothing to
   * switch — a single-language paper has one wording per subject, so a toggle
   * would sit there doing nothing.
   */
  language?: ReportLanguage;
  onLanguageChange?: (next: ReportLanguage) => void;
}) {
  const s = model.summary;
  const meta = [
    model.meta.date
      ? new Date(model.meta.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : null,
    `${s.totalQuestions} Questions`,
    s.timeUsedSec != null ? mins(s.timeUsedSec) : null,
  ].filter(Boolean) as string[];

  const icons = [<CalendarDays key="d" className="w-3.5 h-3.5" />, <Target key="q" className="w-3.5 h-3.5" />, <Clock key="t" className="w-3.5 h-3.5" />];

  return (
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg sm:text-xl font-bold text-[#1e2a5a] dark:text-gray-100 leading-tight">
            {model.meta.testName}
          </h2>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900">
            This Attempt
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-1.5">
          {meta.map((m, i) => (
            <span key={m} className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
              <span className="text-violet-500">{icons[i]}</span>
              {m}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {language && onLanguageChange && (
          <div className="text-right">
            <LanguageToggle value={language} onChange={onLanguageChange} />
            <ReportLanguageNote />
          </div>
        )}
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl text-xs font-semibold px-3.5 py-2 border transition-colors',
              canDownload
                ? 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
            )}
          >
            <Download className="w-3.5 h-3.5" />
            {canDownload ? 'Download PDF' : 'Upgrade to download'}
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            aria-label="Share report"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Attempt summary (reference screen 2) ──────────────────────────────────────

export function AttemptSummary({ model }: { model: AttemptReportModel }) {
  const s = model.summary;

  /**
   * `model.verdict` is server-generated (cached at submission time, grounded
   * in the same numbers the PDF export reads) when available, and computed
   * locally otherwise — see `buildVerdict` in attempt-report.ts. Either way,
   * `severity` always drives the color here, never the generated wording.
   */
  const verdict = model.verdict;
  const verdictStyle = VERDICT_STYLE[verdict.severity];

  return (
    <ReportCard>
      <SectionHeader
        icon={<BarChart3 className="w-4 h-4" />}
        title="Attempt summary"
        subtitle={[
          s.totalQuestions ? `${s.totalQuestions} questions` : null,
          s.timeUsedSec != null ? mins(s.timeUsedSec) : null,
          model.meta.mode ? model.meta.mode.toUpperCase() : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      {/* Stacked on mobile the ring leads the block, so it aligns left; side by side
          it reads as the row's anchor, so it centres against the tiles — which are
          taller than it whenever a verdict carries a note. */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="flex items-center gap-3 flex-shrink-0">
          <ScoreRing
            percent={s.percentage}
            primary={s.score != null ? s.score : fmtPct(s.percentage)}
            secondary={s.maxMarks != null ? `/ ${s.maxMarks}` : undefined}
          />
          <div className="sm:hidden">
            <StatusPill tone={verdictStyle.tone}>{verdict.label}</StatusPill>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 flex-1 w-full">
          <StatTile
            icon={<Target className="w-3.5 h-3.5" />}
            accent="emerald"
            value={s.accuracy == null ? 'Not assessed' : `${s.accuracy}%`}
            label="Accuracy"
            hint={s.accuracy == null ? 'No questions attempted' : `${s.correct} / ${s.attempted} attempted`}
          />
          <StatTile
            icon={<Zap className="w-3.5 h-3.5" />}
            accent="indigo"
            value={fmtPct(s.attemptRate)}
            label="Attempt rate"
            hint={`${s.attempted} / ${s.totalQuestions}`}
          />
          <StatTile
            icon={<Clock className="w-3.5 h-3.5" />}
            accent="sky"
            value={mins(s.timeUsedSec)}
            label="Time taken"
            hint={
              s.timeAllowedSec != null
                ? `of ${mins(s.timeAllowedSec)} allowed`
                : s.avgTimePerAttemptedSec != null
                  ? `${fmtSec(s.avgTimePerAttemptedSec)} / question`
                  : undefined
            }
          />
          <StatTile
            icon={<Minus className="w-3.5 h-3.5" />}
            accent="amber"
            value={
              s.totalQuestions > 0 ? `${Math.round((s.unattempted / s.totalQuestions) * 100)}%` : String(s.unattempted)
            }
            label="Unattempted"
            hint={`${s.unattempted} of ${s.totalQuestions}`}
          />
          <StatTile
            icon={<AlertTriangle className="w-3.5 h-3.5" />}
            accent={verdictStyle.accent}
            value={verdict.label}
            label="Verdict"
            hint={verdict.note}
            emphasis
          />
        </div>
      </div>

      {/* The verdict tile is a label; this is the reasoning behind it. */}
      <div className={cn('mt-3 rounded-xl px-3.5 py-3', ACCENT[verdictStyle.accent].wash)}>
        <p className={cn('text-[11px] font-bold', ACCENT[verdictStyle.accent].text)}>{verdict.label}</p>
        <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200 mt-1">{verdict.detail}</p>
      </div>

      {model.dataQuality.warnings.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-1">
          {model.dataQuality.warnings.map((w, i) => (
            <p key={i} className="text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
              {w}
            </p>
          ))}
        </div>
      )}

      {model.diagnostics.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-2">Quick insights</p>
          <ul className="space-y-2">
            {model.diagnostics.map(f => (
              <InsightLine
                key={f.rank}
                icon={<Lightbulb className="w-3 h-3" />}
                accent={f.confidence === 'HIGH' ? 'indigo' : 'slate'}
              >
                {f.text}
                {/* Says what the sentence was computed from, rather than grading
                    it HIGH/MEDIUM — a grade the reader had no way to interpret. */}
                <span className={cn('block mt-0.5 text-[10px]', CONFIDENCE_TONE[f.confidence])}>
                  {f.basis}
                </span>
              </InsightLine>
            ))}
          </ul>
        </div>
      )}
    </ReportCard>
  );
}

// ─── Performance snapshot: radar + takeaways (reference screen 3) ──────────────

export function PerformanceSnapshot({
  model,
  onSelectSubject,
}: {
  model: AttemptReportModel;
  onSelectSubject?: (subjectId: string) => void;
}) {
  const plotted = model.radar.filter(r => r.value != null);
  const target = model.config.targetAccuracy;

  return (
    <ReportCard>
      <SectionHeader
        icon={<Target className="w-4 h-4" />}
        title="Subject Proficiency Radar"
        subtitle="Accuracy on the questions you answered, against target"
      />
        {plotted.length < 3 ? (
          <NotAvailable
            reason={`Only ${plotted.length} subject${plotted.length === 1 ? '' : 's'} were attempted, which is too few to plot a proficiency shape. The table below carries the same figures.`}
          />
        ) : (
          <>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart
                  data={model.radar.map(r => ({
                    // Long syllabus names ran off the plot and collided with each
                    // other; the tooltip carries the full name.
                    subject: r.label.length > 18 ? `${r.label.slice(0, 17)}…` : r.label,
                    full: r.label,
                    value: r.value,
                    target,
                  }))}
                  outerRadius="62%"
                  margin={{ top: 20, right: 40, bottom: 20, left: 40 }}
                >
                  <PolarGrid stroke="#e5e7eb" />
                  {/* Each axis carries its own figure, so the shape can be read
                      without hunting back to the table. */}
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={<RadarAxisTick rows={model.radar} />}
                    onClick={(e: any) => onSelectSubject?.(model.radar[e?.index ?? -1]?.subjectId)}
                    className="cursor-pointer"
                  />
                  <PolarRadiusAxis domain={[0, 100]} tickCount={5} angle={90} tick={false} axisLine={false} />
                  <Tooltip content={<RadarTooltip rows={model.radar} target={target} />} />
                  <Radar
                    name="Target"
                    dataKey="target"
                    stroke="#cbd5e1"
                    strokeWidth={1.5}
                    fill="#cbd5e1"
                    fillOpacity={0.18}
                    dot={false}
                  />
                  <Radar
                    name="You"
                    dataKey="value"
                    stroke={ACCENT.violet.hex}
                    strokeWidth={2}
                    fill={ACCENT.violet.hex}
                    fillOpacity={0.25}
                    dot={{ r: 3, fill: ACCENT.violet.hex }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[10px] text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: ACCENT.violet.hex }} /> Your Performance
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" /> Target (Recommended)
              </span>
            </div>
            <WhatThisMeans>{model.radarInterpretation.join(' ')}</WhatThisMeans>
          </>
        )}
    </ReportCard>
  );
}

/**
 * An axis label that carries its own figure — subject name over the accuracy, as
 * the design shows. Long names wrap onto a second line rather than being cut, and
 * a not-assessed axis says so instead of printing 0%.
 */
function RadarAxisTick({ x, y, payload, textAnchor, rows }: any) {
  const row = rows[payload?.index];
  if (!row) return null;

  const words = String(row.label).split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 16 && line) {
      lines.push(line.trim());
      line = w;
    } else {
      line = `${line} ${w}`.trim();
    }
    if (lines.length === 2) break;
  }
  if (line && lines.length < 2) lines.push(line);
  if (lines.length === 2 && words.join(' ').length > lines.join(' ').length) {
    lines[1] = `${lines[1].slice(0, 14)}…`;
  }

  const measured = row.state !== 'NOT_ASSESSED' && row.value != null;
  const below = y > 0;

  return (
    <g transform={`translate(${x},${y})`} className="cursor-pointer">
      {lines.map((ln, i) => (
        <text
          key={i}
          x={0}
          y={(below ? 0 : -6) + i * 10}
          textAnchor={textAnchor}
          className="fill-gray-500 dark:fill-gray-400"
          fontSize={9}
        >
          {ln}
        </text>
      ))}
      <text
        x={0}
        y={(below ? 0 : -6) + lines.length * 10 + 1}
        textAnchor={textAnchor}
        fontSize={10}
        fontWeight={700}
        className={measured ? 'fill-violet-600 dark:fill-violet-400' : 'fill-gray-300 dark:fill-gray-600'}
      >
        {measured ? `${row.value}%` : 'n/a'}
      </text>
    </g>
  );
}

function RadarTooltip({ active, payload, rows, target }: any) {
  const full = payload?.[0]?.payload?.full;
  const row = rows.find((r: any) => r.label === full);
  if (!active || !row) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 shadow-lg max-w-[15rem]">
      <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-snug">{row.label}</p>
      {row.state === 'NOT_ASSESSED' ? (
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
          Not assessed — none of its {row.questions} questions were answered, so there is no accuracy to plot. That
          is missing evidence, not a score of zero.
        </p>
      ) : (
        <>
          {/* "14% over 100 attempted" read as a count of attempts rather than as
              a rate. The measure is now named, and the arithmetic behind it is
              spelled out so there is nothing left to infer. */}
          <p className="text-[11px] mt-1 tabular-nums">
            <span className="font-bold text-gray-900 dark:text-gray-100">Accuracy {row.value}%</span>
            <span className="block text-[10px] text-gray-500 dark:text-gray-400">
              {row.correct} correct of {row.evidenceCount} answered
            </span>
          </p>
          {/* The other number a reader may be looking for: what the subject
              actually contributed to the score. It differs from accuracy whenever
              questions went unanswered, which is the distinction worth seeing. */}
          {row.scorePct != null && (
            <p className="text-[11px] mt-1 tabular-nums">
              <span className="font-bold text-gray-900 dark:text-gray-100">Score {row.scorePct}%</span>
              <span className="block text-[10px] text-gray-500 dark:text-gray-400">
                {row.marksEarned} of {row.marksAvailable} marks
                {row.questions > row.evidenceCount && ` · ${row.questions - row.evidenceCount} unanswered`}
              </span>
            </p>
          )}
          <p className="text-[10px] text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-800 tabular-nums">
            Plotted: accuracy. Target {target}% ·{' '}
            {row.value != null && row.value >= target
              ? 'at or above'
              : `${Math.round(target - (row.value ?? 0))} points below`}
          </p>
          {row.state === 'INSUFFICIENT_EVIDENCE' && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">Low evidence — treat with caution.</p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Subject-wise performance + inline deep dive (screens 4 and 5) ─────────────

export function SubjectPerformance({
  model,
  expanded,
  onToggle,
  onViewQuestions,
}: {
  model: AttemptReportModel;
  expanded: string | null;
  onToggle: (id: string) => void;
  onViewQuestions?: (id: string) => void;
}) {
  const label = useLabel();

  const headers: Array<{ label: string; note?: string; align?: 'right' }> = [
    { label: 'Subject' },
    { label: 'Qs', align: 'right' },
    { label: 'Attempted', align: 'right' },
    { label: 'Correct', align: 'right' },
    { label: 'Incorrect', align: 'right' },
    { label: 'Skipped', align: 'right' },
    { label: 'Accuracy', note: 'on attempted', align: 'right' },
    { label: 'Score', align: 'right' },
    { label: 'Status' },
    { label: 'Action' },
  ];

  return (
    <ReportCard flush>
      <div className="p-4 sm:p-5 pb-0">
        <SectionHeader
          icon={<BarChart3 className="w-4 h-4" />}
          title="Subject-wise performance"
          subtitle="Click a subject to open its detail here"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] min-w-[700px]">
          <thead>
            <tr className="bg-violet-50/70 dark:bg-violet-950/25 text-left">
              {headers.map(h => (
                <th
                  key={h.label}
                  className={cn(
                    'px-3 py-2.5 font-semibold text-[#1e2a5a] dark:text-gray-300 whitespace-nowrap align-bottom',
                    h.align === 'right' && 'text-right',
                  )}
                >
                  {h.label}
                  {h.note && (
                    <span className="block text-[9px] font-normal text-gray-400 dark:text-gray-500 normal-case">
                      ({h.note})
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.subjects.map((s, i) => {
              const m = s.metrics;
              const open = expanded === s.subjectId;
              return (
                <Fragment key={s.subjectId}>
                  <tr
                    onClick={() => onToggle(s.subjectId)}
                    className={cn(
                      'border-b border-gray-50 dark:border-gray-800/60 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40',
                      open && 'bg-indigo-50/40 dark:bg-indigo-950/20',
                    )}
                  >
                    <td className="px-3 py-2.5 font-semibold text-gray-900 dark:text-gray-100">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                          style={{ background: subjectHue(i) }}
                          aria-hidden
                        >
                          {label(s).trim().charAt(0).toUpperCase()}
                        </span>
                        <span
                          className="truncate max-w-[14rem] text-[#1e2a5a] dark:text-gray-100"
                          title={[s.name, s.nameLocal].filter(Boolean).join(' · ')}
                        >
                          {label(s)}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">{m.questions}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{m.attempted}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{m.correct}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-rose-600 dark:text-rose-400">{m.incorrect}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-400">{m.skipped}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-bold text-[#1e2a5a] dark:text-gray-100">
                      {m.accuracy == null ? <span className="font-normal text-gray-400">—</span> : `${m.accuracy}%`}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 dark:text-gray-300">
                      {m.marksEarned != null && m.marksAvailable != null ? `${m.marksEarned}/${m.marksAvailable}` : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</StatusPill>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900 rounded-lg px-2 py-1 whitespace-nowrap">
                        View
                        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
                      </span>
                    </td>
                  </tr>
                  {open && (
                    <tr className="bg-gray-50/60 dark:bg-gray-800/30">
                      <td colSpan={headers.length} className="px-3 py-3">
                        <SubjectDeepDive
                          subject={s}
                          model={model}
                          index={i}
                          onViewQuestions={onViewQuestions}
                          onCollapse={() => onToggle(s.subjectId)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 sm:px-5 pb-4 sm:pb-5">
        <WhatThisMeans>
          Accuracy counts only attempted questions. A subject with nothing attempted reads{' '}
          <span className="font-semibold">Not assessed</span> rather than 0% — this attempt says nothing about it
          either way.
        </WhatThisMeans>
      </div>
    </ReportCard>
  );
}

type DiveTab = 'subtopics' | 'questions' | 'trends';

/**
 * One row of the sub-topic table.
 *
 * Topics and their sub-topics share a shape, so one row component renders both —
 * the sub level only differs by indentation and a lighter weight. `isOther` marks
 * the bucket of questions the sheet left untagged: it is shown so the rows still
 * add up to the subject's total, but styled so it does not read as a syllabus
 * area someone could go and study.
 */
function TaxonomyRow({
  node,
  depth,
  isOther,
}: {
  node: TopicNode;
  depth: 0 | 1;
  isOther: boolean;
}) {
  const label = useLabel();
  const m = node.metrics;
  const dash = <span className="text-gray-300 dark:text-gray-600">&mdash;</span>;

  return (
    <tr
      className={cn(
        'border-b border-gray-50 dark:border-gray-800/60',
        depth === 1 && 'bg-gray-50/50 dark:bg-gray-800/20',
      )}
    >
      <td className={cn('px-3 py-2', depth === 1 && 'pl-8')}>
        <span
          className={cn(
            'truncate block',
            isOther
              ? 'italic text-gray-400 dark:text-gray-500'
              : depth === 0
                ? 'font-semibold text-[#1e2a5a] dark:text-gray-100'
                : 'text-gray-600 dark:text-gray-300',
          )}
          title={[node.name, node.nameLocal].filter(Boolean).join(' · ')}
        >
          {label(node)}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{m.questions}</td>
      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{m.attempted}</td>
      <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{m.correct}</td>
      <td className="px-3 py-2 text-right tabular-nums text-rose-600 dark:text-rose-400">{m.incorrect}</td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-400">{m.skipped}</td>
      <td
        className={cn(
          'px-3 py-2 text-right tabular-nums font-bold',
          m.accuracy == null
            ? ''
            : m.accuracy >= 70
              ? 'text-emerald-600 dark:text-emerald-400'
              : m.accuracy >= 40
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-rose-600 dark:text-rose-400',
        )}
      >
        {/* Never 0% for an untouched row — that would read as ability rather than
            as an absence of evidence. */}
        {m.accuracy == null ? dash : `${m.accuracy}%`}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
        {m.avgTimeSec == null ? dash : `${Math.round(m.avgTimeSec)} sec`}
      </td>
      <td className="px-3 py-2">
        <StatusPill tone={STATUS_TONE[taxonomyStatus(node)]}>{STATUS_LABEL[taxonomyStatus(node)]}</StatusPill>
      </td>
    </tr>
  );
}

/**
 * Status for a topic or sub-topic, on the same rules as a subject.
 *
 * Deliberately not read from a server-supplied label: one classifier keeps the
 * table, the narrative and the study plan from disagreeing about the same row.
 * Coverage is part of it — high accuracy on a thin slice of a topic is a coverage
 * story, not a strength — and a handful of answers is held back as insufficient
 * evidence rather than promoted to "Strong" on two lucky questions.
 */
export function taxonomyStatus(node: TopicNode): NodeStatus {
  const m = node.metrics;
  const cfg = DEFAULT_REPORT_CONFIG;
  if (m.attempted === 0) return 'NOT_ASSESSED';
  if (m.attempted < cfg.minEvidence) return 'INSUFFICIENT_EVIDENCE';
  const acc = m.accuracy ?? 0;
  if (acc >= cfg.strongAccuracy && (m.coverage ?? 0) >= cfg.targetCoverage) return 'STRONG';
  if (acc >= cfg.developingAccuracy) return 'DEVELOPING';
  return 'FOCUS';
}

// A few equivalent short phrasings per status band, so a table full of topics that
// share the same real state (e.g. several 0%-accuracy rows) doesn't repeat one
// identical label down the column — rotated deterministically by row index, never
// randomly, so the same attempt always renders the same table.
const AI_ANALYSIS_PHRASES: Record<NodeStatus, string[]> = {
  STRONG: ['Strong', 'Solid grasp', 'On target'],
  DEVELOPING: ['Needs revision', 'Strengthen understanding', 'Revision required', 'Practise this again'],
  FOCUS: ['Needs concept clarity', 'Revise timeline', 'Concept gap', 'Focus on key events', 'Concept clarity needed', 'Learn key personalities'],
  INSUFFICIENT_EVIDENCE: ['Too few answers yet'],
  NOT_ASSESSED: ['Not attempted yet'],
};

/**
 * A short per-row label for a "Topic Analysis" table's AI Analysis column — the
 * same `taxonomyStatus` the table's own Status pill already uses elsewhere,
 * rendered as a couple of words instead of a badge. Real per-row state, cosmetic
 * phrasing variety only.
 */
export function topicAiAnalysis(node: TopicNode, index: number): string {
  const status = taxonomyStatus(node);
  const phrases = AI_ANALYSIS_PHRASES[status];
  const phrase = phrases[index % phrases.length];
  return status === 'STRONG' && node.metrics.attempted === 1 ? `${phrase} (single question)` : phrase;
}

/** A tagged-as-nothing bucket, by the name the importer gives it. */
export function isOtherNode(node: TopicNode): boolean {
  return /^(others?|untagged|unspecified)$/i.test(node.name.trim());
}

function SubjectDeepDive({
  subject,
  model,
  index,
  onViewQuestions,
  onCollapse,
}: {
  subject: SubjectNode;
  model: AttemptReportModel;
  index: number;
  onViewQuestions?: (id: string) => void;
  onCollapse?: () => void;
}) {
  const [tab, setTab] = useState<DiveTab>('subtopics');
  const label = useLabel();
  const m = subject.metrics;

  /** The headline strip — the same six figures the subject row carries, enlarged. */
  const stats: Array<{ value: React.ReactNode; label: string; tone: string }> = [
    { value: m.attempted, label: 'Attempted', tone: 'text-emerald-600 dark:text-emerald-400' },
    { value: m.correct, label: 'Correct', tone: 'text-emerald-600 dark:text-emerald-400' },
    { value: m.incorrect, label: 'Incorrect', tone: 'text-rose-600 dark:text-rose-400' },
    { value: m.skipped, label: 'Skipped', tone: 'text-[#1e2a5a] dark:text-gray-100' },
    {
      value: m.accuracy == null ? '—' : `${m.accuracy}%`,
      label: 'Accuracy',
      tone:
        m.accuracy == null
          ? 'text-gray-400'
          : m.accuracy >= 70
            ? 'text-emerald-600 dark:text-emerald-400'
            : m.accuracy >= 40
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-rose-600 dark:text-rose-400',
    },
    {
      value: m.marksEarned != null && m.marksAvailable != null ? `${m.marksEarned} / ${m.marksAvailable}` : '—',
      label: 'Score',
      tone: 'text-[#1e2a5a] dark:text-gray-100',
    },
  ];

  const tabs: Array<{ value: DiveTab; label: string }> = [
    { value: 'subtopics', label: subject.topics.length > 0 ? 'Sub-topic Analysis' : 'Analysis' },
    { value: 'questions', label: 'Question Insights' },
    { value: 'trends', label: 'Comparison & Trends' },
  ];

  const taggedQuestions = subject.topics.reduce((n, t) => n + t.metrics.questions, 0);
  const untagged = m.questions - taggedQuestions;

  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      {/* Header: who this is about, and the way back out. */}
      <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-gray-100 dark:border-gray-800">
        <span
          className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-[12px] font-bold text-white"
          style={{ background: subjectHue(index) }}
          aria-hidden
        >
          {label(subject).trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100 truncate"
            title={[subject.name, subject.nameLocal].filter(Boolean).join(' · ')}
          >
            {label(subject)}
          </p>
          <p className="text-[10px] text-gray-400">{m.questions} questions in this paper</p>
        </div>
        <StatusPill tone={STATUS_TONE[subject.status]}>{STATUS_LABEL[subject.status]}</StatusPill>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1"
          >
            Collapse
            <ChevronDown className="w-3 h-3 rotate-180" />
          </button>
        )}
      </div>

      {/* The six figures, given room. Each keeps the colour it wears in the table
          above, so the eye carries the meaning down from the row it opened. */}
      <div className="grid grid-cols-3 sm:grid-cols-6 divide-x divide-gray-100 dark:divide-gray-800 border-b border-gray-100 dark:border-gray-800">
        {stats.map(st => (
          <div key={st.label} className="px-3 py-2.5 text-center">
            <p className={cn('text-base font-bold leading-none tabular-nums', st.tone)}>{st.value}</p>
            <p className="text-[9px] uppercase tracking-wide text-gray-400 mt-1">{st.label}</p>
          </div>
        ))}
      </div>

      <div className="px-3.5 pt-2.5">
        {/* Explicit type argument: the options array's string literals would
            otherwise widen T to `string` and lose the union. */}
        <UnderlineTabs<DiveTab> value={tab} onChange={setTab} options={tabs} />
      </div>

      <div className="px-3.5 pb-3.5 pt-2.5">
        {tab === 'subtopics' &&
          (subject.topics.length > 0 ? (
            <>
              <div className="overflow-x-auto -mx-3.5">
                <table className="w-full text-[11px] min-w-[640px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                      {[
                        { label: subject.topics.some(t => t.subtopics.length > 0) ? 'Topic / Sub-topic' : 'Topic' },
                        { label: 'Qs', align: 'right' as const },
                        { label: 'Attempted', align: 'right' as const },
                        { label: 'Correct', align: 'right' as const },
                        { label: 'Incorrect', align: 'right' as const },
                        { label: 'Skipped', align: 'right' as const },
                        { label: 'Accuracy', align: 'right' as const },
                        { label: 'Avg. Time/Q', align: 'right' as const },
                        { label: 'Status' },
                      ].map(h => (
                        <th
                          key={h.label}
                          className={cn(
                            'px-3 py-2 font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap',
                            h.align === 'right' && 'text-right',
                          )}
                        >
                          {h.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subject.topics.map(t => (
                      <Fragment key={t.topicId}>
                        <TaxonomyRow node={t} depth={0} isOther={isOtherNode(t)} />
                        {t.subtopics.map(sub => (
                          <TaxonomyRow key={sub.topicId} node={sub} depth={1} isOther={isOtherNode(sub)} />
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
              {untagged > 0 && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                  {untagged} of the {m.questions} questions in {subject.name} carry no topic tag, so they are counted
                  in the totals above but appear in none of these rows.
                </p>
              )}
              <WhatThisMeans>{topicNarrative(subject)}</WhatThisMeans>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">{subject.diagnosis}</p>
              <NotAvailable reason="No question in this subject carries a topic tag, so the breakdown stops at subject level." />
            </div>
          ))}

        {tab === 'questions' && (
          <div className="space-y-2.5">
            <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">{subject.diagnosis}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Main issue: <span className="font-semibold">{ISSUE_LABEL[subject.primaryIssue]}</span>
            </p>
            <p className={cn('text-[11px]', CONFIDENCE_TONE[subject.confidence])}>
              {subject.confidence === 'HIGH'
                ? 'Enough questions here to read these figures as reliable.'
                : subject.confidence === 'MEDIUM'
                  ? 'A small set of questions — read these figures as an early signal, not a settled level.'
                  : 'Too few questions answered here to draw a conclusion yet.'}
            </p>
            {onViewQuestions && m.questions > 0 && (
              <button
                type="button"
                onClick={() => onViewQuestions(subject.subjectId)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Open the {m.questions} {subject.name} questions
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {tab === 'trends' && (
          <div className="space-y-3">
            {/* Comparison against the paper is computable from this attempt; a
                trend across attempts is not, and the tab says where that lives
                rather than drawing a one-point line and calling it a trend. */}
            <div className="space-y-2">
              <MeterRow
                label={`${subject.name} accuracy`}
                value={m.accuracy}
                right={m.accuracy == null ? 'Not assessed' : `${m.accuracy}%`}
              />
              <MeterRow
                label="Whole paper accuracy"
                value={model.summary.accuracy}
                right={model.summary.accuracy == null ? 'Not assessed' : `${model.summary.accuracy}%`}
              />
              <MeterRow
                label={`${subject.name} coverage`}
                value={m.coverage}
                right={`${m.attempted} of ${m.questions} reached`}
              />
              <MeterRow
                label="Whole paper coverage"
                value={model.summary.attemptRate}
                right={`${model.summary.attempted} of ${model.summary.totalQuestions} reached`}
              />
            </div>

            {subject.difficultySplit.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">By difficulty</p>
                <div className="space-y-2">
                  {subject.difficultySplit.map(d => (
                    <MeterRow
                      key={d.label}
                      label={d.label}
                      value={d.accuracy}
                      right={`${d.correct}/${d.attempted} of ${d.questions} · ${fmtPct(d.accuracy)}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <WhatThisMeans>{comparisonNarrative(subject, model)}</WhatThisMeans>
          </div>
        )}
      </div>
    </div>
  );
}

/** Reads the topic table: where the marks sit, and which row to work first. */
export function topicNarrative(subject: SubjectNode): string {
  const real = subject.topics.filter(t => !isOtherNode(t));
  if (real.length === 0) return 'Every question in this subject is untagged, so there is no topic split to read.';

  const measured = real.filter(t => t.metrics.attempted >= DEFAULT_REPORT_CONFIG.minEvidence);
  const untouched = real.filter(t => t.metrics.attempted === 0);
  const parts: string[] = [];

  if (measured.length > 0) {
    const weakest = measured.reduce((lo, t) => ((t.metrics.accuracy ?? 0) < (lo.metrics.accuracy ?? 0) ? t : lo));
    parts.push(
      `${weakest.name} is the weakest measured topic at ${weakest.metrics.accuracy}% (${weakest.metrics.correct} of ${weakest.metrics.attempted} answered), and it carries ${weakest.metrics.questions} questions in this paper — the most marks any single topic here is costing you.`,
    );
  } else {
    parts.push(
      `No topic has ${DEFAULT_REPORT_CONFIG.minEvidence} or more answered questions yet, so each percentage here can swing on a single question.`,
    );
  }

  if (untouched.length > 0) {
    const q = untouched.reduce((n, t) => n + t.metrics.questions, 0);
    parts.push(
      `${untouched.length} topic${untouched.length === 1 ? '' : 's'} went entirely unanswered (${untouched.slice(0, 2).map(t => t.name).join(', ')}${untouched.length > 2 ? ' and others' : ''}, ${q} questions) — unknown rather than weak, and the cheapest place to add marks.`,
    );
  }

  return parts.join(' ');
}

/** Reads the comparison bars: is this subject ahead of or behind the paper? */
export function comparisonNarrative(subject: SubjectNode, model: AttemptReportModel): string {
  const m = subject.metrics;
  const paperAcc = model.summary.accuracy;
  const paperCov = model.summary.attemptRate;
  const parts: string[] = [];

  if (m.accuracy != null && paperAcc != null) {
    const d = Math.round(m.accuracy - paperAcc);
    parts.push(
      d === 0
        ? `${subject.name} is answering exactly in line with the paper as a whole (${m.accuracy}%).`
        : d > 0
          ? `${subject.name} is answering ${d} points above your paper average (${m.accuracy}% against ${paperAcc}%), so it is carrying the score rather than dragging it.`
          : `${subject.name} is answering ${Math.abs(d)} points below your paper average (${m.accuracy}% against ${paperAcc}%), so it is one of the places the score is being lost.`,
    );
  } else {
    parts.push(`Nothing was attempted in ${subject.name}, so there is no accuracy to compare against the paper.`);
  }

  if (m.coverage != null && paperCov != null) {
    const d = Math.round(m.coverage - paperCov);
    parts.push(
      Math.abs(d) < 5
        ? `Coverage here matches the rest of the paper, so time was spread evenly.`
        : d < 0
          ? `You reached ${Math.abs(d)} points less of this subject than of the paper overall — whether that was time or avoidance, those ${m.skipped} questions scored nothing.`
          : `You reached ${d} points more of this subject than of the paper overall, so it took a larger share of your time.`,
    );
  }

  parts.push('A trend across attempts needs more than one paper — the Progress tab compares this subject over time.');
  return parts.join(' ');
}

// ─── Question & error analysis, four panels (reference screen 7) ───────────────

export function QuestionErrorAnalysis({ model }: { model: AttemptReportModel }) {
  const { bySubject, errorFocus, difficulty, time, questionType, negativeMarks, errorCategories } = model.analyses;

  const DIFFICULTY_ACCENT: Record<string, Accent> = { easy: 'emerald', medium: 'amber', hard: 'rose' };

  /**
   * The narrow panels, in one list so the row can be filled deliberately.
   *
   * Four equal columns left a fifth panel orphaned on a row of its own beside
   * three empty cells, and squeezed subject names down to "Indian Econo...".
   * Building them as descriptors instead means a panel the attempt cannot support
   * drops out and the last one stretches to close the row.
   */
  const panels: Array<{ key: string; render: (span?: string) => React.ReactNode }> = [];

  if (difficulty.state === 'AVAILABLE') {
    panels.push({
      key: 'difficulty',
      render: span => (
        <Panel key="difficulty" title="Performance by Difficulty" className={span}>
          <div className="space-y-2">
            {difficulty.rows.map(d => {
              const accent = DIFFICULTY_ACCENT[d.label.toLowerCase()] ?? 'slate';
              return (
                <div
                  key={d.label}
                  className={cn('flex items-center justify-between gap-2 rounded-lg px-2.5 py-2', ACCENT[accent].wash)}
                >
                  <span className={cn('text-[11px] font-bold', ACCENT[accent].text)}>{d.label}</span>
                  <span className="text-right leading-tight">
                    <span className={cn('block text-sm font-bold tabular-nums', ACCENT[accent].text)}>
                      {fmtPct(d.accuracy)}
                    </span>
                    <span className="block text-[9px] text-gray-500 dark:text-gray-400 tabular-nums">
                      {d.correct} of {d.attempted} correct
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
          <PanelNote>{difficulty.whatThisMeans}</PanelNote>
        </Panel>
      ),
    });
  }

  panels.push({
    key: 'errors',
    render: span => (
      <Panel key="errors" title="Error Analysis" note={`${model.summary.incorrect} incorrect`} className={span}>
        {errorFocus.state === 'AVAILABLE' ? (
          <>
            <div className="space-y-1.5">
              {errorFocus.rows.slice(0, 6).map((r, i) => (
                <div key={r.subjectId} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: subjectHue(i) }} />
                  <span
                    className="text-[11px] text-gray-700 dark:text-gray-200 truncate flex-1 min-w-0"
                    title={r.name}
                  >
                    {r.name}
                  </span>
                  <span className="text-[11px] font-bold tabular-nums text-rose-600 dark:text-rose-400 flex-shrink-0">
                    {r.incorrect}
                  </span>
                  <span className="text-[10px] text-gray-400 tabular-nums w-10 text-right flex-shrink-0">
                    {fmtPct(r.shareOfErrors)}
                  </span>
                </div>
              ))}
            </div>
            {negativeMarks.state === 'AVAILABLE' && (
              <div className="mt-2.5 rounded-lg bg-rose-50/70 dark:bg-rose-950/20 px-2.5 py-2 flex items-baseline gap-2">
                <span className="text-lg font-bold text-rose-600 dark:text-rose-400 leading-none">
                  &minus;{negativeMarks.marksLost}
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                  marks lost at {negativeMarks.perWrong} per wrong answer
                </span>
              </div>
            )}
            {/* One note, not a note followed by a loose paragraph — the caveat about
                why causes are not shown belongs with the reading of the chart. */}
            <PanelNote>
              {errorFocus.whatThisMeans} {errorCategories.reason}
            </PanelNote>
          </>
        ) : (
          <PanelEmpty headline="No wrong answers" reason={errorFocus.reason} missing="incorrect responses" />
        )}
      </Panel>
    ),
  });

  panels.push({
    key: 'time',
    render: span => (
      <Panel key="time" title="Time Analysis" className={span}>
        {time.state === 'AVAILABLE' ? (
          <>
            {/* The two figures are a comparison, so they sit side by side rather
                than stacked with the eye travelling between them. */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-2.5 py-2">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">Your average</p>
                <p className="text-xl font-bold text-[#1e2a5a] dark:text-gray-100 leading-none mt-1 tabular-nums">
                  {time.avgSec != null ? `${Math.round(time.avgSec * 10) / 10}s` : '—'}
                </p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-2.5 py-2">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">This paper allows</p>
                <p className="text-xl font-bold text-[#1e2a5a] dark:text-gray-100 leading-none mt-1 tabular-nums">
                  {time.idealBand ? `${time.idealBand[0]}–${time.idealBand[1]}s` : '—'}
                </p>
              </div>
            </div>
            {time.idealBand ? (
              time.pace &&
              time.pace !== 'ON_PACE' && (
                <div
                  className={cn(
                    'mt-2.5 rounded-lg px-2.5 py-2 flex items-start gap-1.5',
                    time.pace === 'FAST' ? ACCENT.violet.wash : ACCENT.rose.wash,
                  )}
                >
                  <Zap
                    className={cn(
                      'w-3 h-3 flex-shrink-0 mt-px',
                      time.pace === 'FAST' ? ACCENT.violet.text : ACCENT.rose.text,
                    )}
                  />
                  <p
                    className={cn(
                      'text-[10px] leading-relaxed',
                      time.pace === 'FAST' ? ACCENT.violet.text : ACCENT.rose.text,
                    )}
                  >
                    {time.pace === 'FAST'
                      ? 'You are attempting very quickly. Take time to read questions carefully.'
                      : 'You are spending longer than the paper allows, which is what leaves questions unreached.'}
                  </p>
                </div>
              )
            ) : (
              <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">
                This exam configures no duration, so there is no ideal pace to compare against.
              </p>
            )}
            <PanelNote>{time.whatThisMeans}</PanelNote>
          </>
        ) : (
          <PanelEmpty
            headline="Needs timing"
            reason="No elapsed time was recorded for this attempt."
            missing="time_taken_seconds, or time_spent_seconds per question"
          />
        )}
      </Panel>
    ),
  });

  panels.push({
    key: 'type',
    render: span => (
      <Panel key="type" title="Question Type Performance" className={span}>
        {questionType.state === 'AVAILABLE' ? (
          <>
            <div className="grid sm:grid-cols-2 gap-x-4 gap-y-2">
              {questionType.rows.map((t, i) => (
                <div key={t.label}>
                  <div className="flex items-baseline justify-between gap-2 text-[11px]">
                    <span className="text-gray-700 dark:text-gray-200 truncate" title={t.label}>
                      {t.label}
                    </span>
                    <span className="font-bold tabular-nums text-[#1e2a5a] dark:text-gray-100 flex-shrink-0">
                      {fmtPct(t.accuracy)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div
                      className="h-full rounded"
                      style={{ width: `${t.accuracy ?? 0}%`, background: subjectHue(i) }}
                    />
                  </div>
                  <p className="text-[9px] text-gray-400 tabular-nums mt-0.5">
                    {t.correct} correct of {t.attempted} answered
                    {t.questions > t.attempted && <> · {t.questions - t.attempted} unanswered</>}
                  </p>
                </div>
              ))}
            </div>
            <PanelNote>{questionType.whatThisMeans}</PanelNote>
          </>
        ) : (
          <PanelEmpty
            headline="Needs question types"
            reason={questionType.reason}
            missing="question_type on each question"
          />
        )}
      </Panel>
    ),
  });

  return (
    <ReportCard>
      <SectionHeader
        icon={<Target className="w-4 h-4" />}
        title="Question & Error Analysis"
        subtitle="How marks were lost"
      />

      {/* Subject first, across the full width. It carries the longest names — a
          quarter-width column cut "Indian Economy & Development" to nine
          characters — and it is the breakdown the rest of the section explains. */}
      <Panel
        title="Performance by Subject"
        note={`${model.summary.attempted} of ${model.summary.totalQuestions} attempted`}
      >
        {bySubject.state === 'AVAILABLE' ? (
          <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-2.5">
              {bySubject.rows
                .filter(r => r.attempted > 0)
                .map((r, i) => (
                  <div key={r.subjectId}>
                    <div className="flex items-baseline justify-between gap-2 text-[11px]">
                      <span className="text-gray-700 dark:text-gray-200 truncate" title={r.name}>
                        {r.name}
                      </span>
                      <span className="font-bold tabular-nums text-[#1e2a5a] dark:text-gray-100 flex-shrink-0">
                        {fmtPct(r.accuracy)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${r.accuracy ?? 0}%`, background: subjectHue(i) }}
                      />
                    </div>
                    {/* "14/100 attempted of 100" read as "14 of 100 attempted".
                        The first number is correct answers, so each figure now
                        carries its own noun instead of sharing one. */}
                    <p className="text-[9px] text-gray-400 tabular-nums mt-0.5">
                      {r.correct} correct of {r.attempted} answered
                      {r.questions > r.attempted && <> · {r.questions - r.attempted} unanswered</>}
                    </p>
                  </div>
                ))}
            </div>
            <PanelNote>{bySubject.whatThisMeans}</PanelNote>
          </>
        ) : (
          <PanelEmpty headline="No measured subject" reason="Nothing was attempted." missing="attempted questions" />
        )}
      </Panel>

      {/* The rest, two up. An odd count stretches the last panel so the row closes
          instead of leaving a gap beside it. */}
      <div className="grid md:grid-cols-2 gap-3 mt-3">
        {panels.map((p, i) =>
          p.render(i === panels.length - 1 && panels.length % 2 === 1 ? 'md:col-span-2' : undefined),
        )}
      </div>
    </ReportCard>
  );
}

/**
 * The empty state for a panel the data cannot fill.
 *
 * Deliberately shaped like the panel it replaces rather than collapsing to one
 * grey line — the analysis is missing input, not missing a finding, and naming the
 * field makes that actionable instead of mysterious.
 */
function PanelEmpty({ headline, reason, missing }: { headline: string; reason: string; missing: string }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 dark:border-gray-700 p-2.5">
      <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400">{headline}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 leading-relaxed">{reason}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
        <span className="font-semibold">Needs: </span>
        <code className="font-mono">{missing}</code>
      </p>
    </div>
  );
}

function Panel({
  title,
  note,
  hidden,
  className,
  children,
}: {
  title: string;
  note?: string;
  hidden?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (hidden) return null;
  return (
    // Full height, flex column: panels in a row are the same height whatever
    // their content, and each one's closing note pins to the foot rather than
    // floating wherever its list happened to end.
    <div className={cn('rounded-xl border border-gray-100 dark:border-gray-800 p-3 h-full flex flex-col', className)}>
      <p className="text-[11px] font-bold text-[#1e2a5a] dark:text-gray-200">{title}</p>
      <p className="text-[10px] text-gray-400 mb-2">{note ? `(${note})` : ' '}</p>
      {children}
    </div>
  );
}

function PanelNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-auto pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
      {children}
    </p>
  );
}

// ─── Strengths & gaps (reference screen 8) ─────────────────────────────────────

export function StrengthsAndGaps({ model }: { model: AttemptReportModel }) {
  /**
   * The design pairs a green panel of what is working with a red panel of what is
   * not, then a blue panel of the cheapest wins. Each line is one short claim with
   * its figure — the full evidence/implication/action trio lives in the model and
   * is surfaced on the priority list rather than repeated four times here.
   */
  const strengths = model.strengths.map(s => `${s.title} — ${s.evidence}`);
  const improve: string[] = [];

  const sum = model.summary;
  if (sum.attemptRate != null && sum.attemptRate < model.config.targetCoverage) {
    improve.push(`Increase attempt rate across all subjects (currently ${sum.attemptRate}%)`);
  }
  for (const g of model.gaps.slice(0, 3)) improve.push(`${g.title} (${g.evidence})`);
  if (model.coverageGaps.length > 0) {
    const names = model.coverageGaps.slice(0, 3).map(c => c.title).join(', ');
    improve.push(`Review core concepts in ${names}${model.coverageGaps.length > 3 ? ' and others' : ''} (not attempted)`);
  }

  const quickWins = model.quickWins.map(q => q.title.replace(/^.*?— /, ''));
  if (model.analyses.difficulty.state === 'AVAILABLE') {
    const weakest = [...model.analyses.difficulty.rows]
      .filter(r => r.accuracy != null)
      .sort((a, b) => (a.accuracy ?? 0) - (b.accuracy ?? 0))[0];
    if (weakest) quickWins.push(`Practise ${weakest.label.toLowerCase()} difficulty questions`);
  }
  if (sum.attemptRate != null && sum.attemptRate < model.config.targetCoverage) {
    quickWins.push('Take more full-length papers to build stamina and pacing');
  }

  return (
    <ReportCard>
      <SectionHeader icon={<Info className="w-4 h-4" />} title="Strengths & Gaps" />

      <div className="grid md:grid-cols-2 gap-3">
        <TintedPanel
          accent="emerald"
          icon={<CheckCircle2 className="w-3.5 h-3.5" />}
          title="Your Strengths"
          items={strengths}
          bullet={<CheckCircle2 className="w-3.5 h-3.5" />}
          empty="No subject yet has both target accuracy and enough attempted questions to call a strength."
        />
        <TintedPanel
          accent="rose"
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          title="Areas to Improve"
          items={improve}
          bullet={<ChevronRight className="w-3.5 h-3.5" />}
          empty="Nothing measured falls below target in this attempt."
        />
      </div>

      {quickWins.length > 0 && (
        <div className="mt-3">
          <TintedPanel
            accent="indigo"
            icon={<Zap className="w-3.5 h-3.5" />}
            title="Opportunities for Quick Improvement"
            items={quickWins}
            bullet={<CheckCircle2 className="w-3.5 h-3.5" />}
            columns
            empty=""
          />
        </div>
      )}
    </ReportCard>
  );
}

/** A filled tinted panel with an icon header and icon-bulleted lines. */
function TintedPanel({
  accent,
  icon,
  title,
  items,
  bullet,
  empty,
  columns,
}: {
  accent: Accent;
  icon: React.ReactNode;
  title: string;
  items: string[];
  bullet: React.ReactNode;
  empty: string;
  columns?: boolean;
}) {
  return (
    <div className={cn('rounded-xl p-3.5', ACCENT[accent].wash)}>
      <p className={cn('text-[12px] font-bold inline-flex items-center gap-1.5 mb-2.5', ACCENT[accent].text)}>
        <span className="w-5 h-5 rounded-md bg-white/70 dark:bg-gray-900/50 flex items-center justify-center">
          {icon}
        </span>
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-[11px] text-gray-500 dark:text-gray-400">{empty}</p>
      ) : (
        <ul className={cn('space-y-1.5', columns && 'sm:grid sm:grid-cols-2 sm:gap-x-4 sm:space-y-0 sm:gap-y-1.5')}>
          {items.map((t, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className={cn('flex-shrink-0 mt-px', ACCENT[accent].text)}>{bullet}</span>
              <span className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">{t}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Coverage: what was not attempted ──────────────────────────────────────────

/**
 * The other half of the report.
 *
 * Accuracy analysis can only describe questions that were answered, which on a
 * low-attempt paper leaves most of the lost marks undiscussed. This ranks the
 * unanswered areas by the marks sitting in them, names the syllabus topics behind
 * each, and gives an instruction that changes depending on whether there is any
 * evidence to build on.
 */
export function CoverageAnalysis({ model }: { model: AttemptReportModel }) {
  const c = model.coverage;
  const [open, setOpen] = useState<string | null>(c.rows[0]?.subjectId ?? null);

  if (c.rows.length === 0) {
    return (
      <ReportCard>
        <SectionHeader icon={<Layers className="w-4 h-4" />} title="Unattempted Areas" accent="sky" />
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Every question in this paper was attempted — there is no coverage gap to work on.
        </p>
      </ReportCard>
    );
  }

  return (
    <ReportCard>
      <SectionHeader
        icon={<Layers className="w-4 h-4" />}
        title="Unattempted Areas & What to Study"
        subtitle="Ranked by the marks sitting in them, not by how weak the subject looks"
        accent="sky"
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
        <StatTile
          accent="sky"
          value={String(c.totalSkipped)}
          label="Questions unanswered"
          hint={`of ${model.summary.totalQuestions} in the paper`}
        />
        <StatTile
          accent="rose"
          value={c.marksAtStake != null ? String(c.marksAtStake) : '\u2014'}
          label="Marks left on the table"
          hint={c.marksAtStake != null ? 'Available but never contested' : 'Subject marks not recorded'}
          emphasis
        />
        <StatTile
          accent="amber"
          value={String(c.rows.filter(r => r.state === 'NOT_ASSESSED').length)}
          label="Subjects untouched"
          hint="Need a diagnostic first"
        />
      </div>

      <ul className="space-y-2">
        {c.rows.map((r, i) => {
          const isOpen = open === r.subjectId;
          return (
            <li key={r.subjectId} className="rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setOpen(cur => (cur === r.subjectId ? null : r.subjectId))}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              >
                <span
                  className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: subjectHue(i) }}
                  aria-hidden
                >
                  {r.name.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-bold text-[#1e2a5a] dark:text-gray-100 truncate">
                    {r.name}
                  </span>
                  <span className="block text-[10px] text-gray-400 tabular-nums">
                    {r.skipped} of {r.questions} unanswered
                    {r.coverage != null && <> &middot; {r.coverage}% reached</>}
                  </span>
                </span>
                <StatusPill tone={r.state === 'NOT_ASSESSED' ? 'unknown' : 'developing'}>
                  {r.state === 'NOT_ASSESSED' ? 'Not attempted' : 'Partly done'}
                </StatusPill>
                {r.marksAtStake != null && (
                  <span className="text-[11px] font-bold tabular-nums text-rose-600 dark:text-rose-400 flex-shrink-0 w-14 text-right">
                    {r.marksAtStake}
                  </span>
                )}
                <ChevronDown
                  className={cn('w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform', isOpen && 'rotate-180')}
                />
              </button>

              {isOpen && (
                <div className="px-3 pb-3 pt-0.5 space-y-2.5 bg-gray-50/60 dark:bg-gray-800/30">
                  <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">{r.rationale}</p>

                  {r.topics.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1.5">
                        Syllabus topics in {r.name}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {r.topics.map(t => (
                          <span
                            key={t}
                            className="text-[10px] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <NotAvailable reason="No syllabus topics are configured for this subject, so the breakdown stops at subject level." />
                  )}

                  <div className={cn('rounded-lg px-2.5 py-2', ACCENT.sky.wash)}>
                    <p className={cn('text-[10px] font-bold uppercase tracking-wide mb-0.5', ACCENT.sky.text)}>
                      What to do
                    </p>
                    <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">{r.action}</p>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <WhatThisMeans>{c.whatThisMeans}</WhatThisMeans>
    </ReportCard>
  );
}

// ─── Key takeaways & next steps (reference screen 9) ──────────────────────────

export function KeyTakeawaysAndNextSteps({
  model,
  onOpenPlan,
}: {
  model: AttemptReportModel;
  onOpenPlan?: () => void;
}) {
  const nameOf = (id: string) => model.subjects.find(s => s.subjectId === id)?.name ?? id;

  // This card used to open with a "What this attempt tells you" column reading
  // model.diagnostics — the exact same sentences the "Quick insights" section
  // above the verdict card already shows, word for word. Dropped rather than
  // reworded: the priority list below is this card's only content that isn't
  // shown anywhere else on the page.
  return (
    <ReportCard>
      <SectionHeader icon={<Flag className="w-4 h-4" />} title="Recommended next steps" />
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
          Recommended next actions
        </p>
        {model.priorities.length === 0 ? (
          <p className="text-[11px] text-gray-400">Nothing to prioritise from this attempt yet.</p>
        ) : (
          <ol className="space-y-2">
            {model.priorities.map(p => (
              <li key={p.nodeId} className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center mt-px">
                  {p.rank}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold text-gray-900 dark:text-gray-100">
                    {nameOf(p.nodeId)}
                    <span className="ml-1.5 font-normal text-[10px] text-indigo-600 dark:text-indigo-400">
                      {ARCHETYPE_LABEL[p.archetype]}
                    </span>
                  </span>
                  <span className="block text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed mt-0.5">
                    {p.reason}
                  </span>
                  <span className="block text-[10px] text-gray-400 mt-0.5">{p.evidence.join(' · ')}</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {model.queuedPriorities.length > 0 && (
          <p className="mt-2 text-[10px] text-gray-400">
            Queued: {model.queuedPriorities.map(p => nameOf(p.nodeId)).join(', ')}.
          </p>
        )}
      </div>

      {onOpenPlan && (
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] italic text-gray-500 dark:text-gray-400">
            Consistency today leads to success tomorrow.
          </p>
          <button
            type="button"
            onClick={onOpenPlan}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold px-3.5 py-2 hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            View detailed study plan
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </ReportCard>
  );
}

// ─── Question insights table (reference screen 6) ─────────────────────────────

/** Difficulty as a tinted pill, asked for by meaning rather than by colour. */
function difficultyPill(raw: string) {
  if (!raw) return <span className="text-gray-300 dark:text-gray-600">&mdash;</span>;
  const key = raw.toLowerCase();
  const tone: StatusTone =
    key === 'easy' ? 'strong' : key === 'hard' ? 'focus' : key === 'medium' ? 'developing' : 'neutral';
  return <StatusPill tone={tone}>{raw.charAt(0).toUpperCase() + raw.slice(1)}</StatusPill>;
}

/** Shortens a stem to a scannable preview without cutting a word in half. */
function preview(body: string, max = 90): string {
  const clean = (body ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max)}…`;
}

/** Resolves an answer key to the option text where the options are available. */
function answerText(key: string | null, options: string[] | null): string {
  if (key == null || String(key).trim() === '') return '—';
  const k = String(key).trim();
  if (!options?.length) return k;
  const byLetter = k.length === 1 ? k.toUpperCase().charCodeAt(0) - 65 : -1;
  const idx = byLetter >= 0 && byLetter < options.length ? byLetter : Number(k);
  const text = Number.isFinite(idx) && options[idx] != null ? options[idx] : k;
  return String(text).replace(/<[^>]+>/g, ' ').trim().slice(0, 40);
}

function PageBtn({
  children,
  onClick,
  active,
  disabled,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'min-w-[26px] h-[26px] px-1.5 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center transition-colors',
        active
          ? 'bg-violet-600 text-white'
          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40',
      )}
    >
      {children}
    </button>
  );
}

/** First, last and a window around the current page, with the gaps elided. */
function pageWindow(current: number, pages: number): Array<number | string> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: Array<number | string> = [1];
  const from = Math.max(2, current - 1);
  const to = Math.min(pages - 1, current + 1);
  if (from > 2) out.push('gap-start');
  for (let pg = from; pg <= to; pg++) out.push(pg);
  if (to < pages - 1) out.push('gap-end');
  out.push(pages);
  return out;
}

export function QuestionInsightsTable({
  questions,
  page,
  pageSize,
  onPage,
  onOpen,
  openId,
  renderDetail,
}: {
  questions: Array<{
    question_id: string;
    number: number;
    body: string;
    options: string[] | null;
    correct_answer: string;
    user_answer: string | null;
    is_correct: boolean;
    time_spent_seconds: number;
    subject: string;
    difficulty: string;
    question_type?: string | null;
  }>;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onOpen: (questionId: string) => void;
  /** Which row is expanded, so the detail can sit under it rather than below the table. */
  openId: string | null;
  renderDetail: (questionId: string) => React.ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(questions.length / pageSize));
  const current = Math.min(page, pages);
  const slice = questions.slice((current - 1) * pageSize, current * pageSize);

  return (
    <>
      <div className="overflow-x-auto -mx-4 sm:-mx-5">
        <table className="w-full text-[11px] min-w-[880px]">
          <thead>
            <tr className="bg-violet-50/70 dark:bg-violet-950/25 text-left">
              {['Q.No', 'Question Preview', 'Your Answer', 'Correct Answer', 'Result', 'Time', 'Difficulty', 'Type', 'Solution'].map(
                (h, i) => (
                  <th
                    key={h}
                    className={cn(
                      'px-3 py-2.5 font-semibold text-[#1e2a5a] dark:text-gray-300 whitespace-nowrap',
                      i === 5 && 'text-right',
                    )}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {slice.map(q => {
              const answered = q.user_answer != null && String(q.user_answer).trim() !== '';
              const result = !answered ? 'Skipped' : q.is_correct ? 'Correct' : 'Incorrect';
              const tone: StatusTone = !answered ? 'unknown' : q.is_correct ? 'strong' : 'focus';
              const isOpen = openId === q.question_id;
              return (
                <Fragment key={q.question_id}>
                <tr
                  className={cn(
                    'border-b border-gray-50 dark:border-gray-800/60 align-top',
                    isOpen && 'bg-violet-50/40 dark:bg-violet-950/20',
                  )}
                >
                  <td className="px-3 py-2.5 tabular-nums text-gray-500 dark:text-gray-400">{q.number}</td>
                  <td className="px-3 py-2.5 text-gray-800 dark:text-gray-200 max-w-[22rem]">{preview(q.body)}</td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                    {answered ? answerText(q.user_answer, q.options) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-600 dark:text-gray-300">
                    {answerText(q.correct_answer, q.options)}
                  </td>
                  <td className="px-3 py-2.5">
                    <StatusPill tone={tone}>{result}</StatusPill>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 dark:text-gray-400">
                    {q.time_spent_seconds > 0 ? `${Math.round(q.time_spent_seconds)}s` : '—'}
                  </td>
                  <td className="px-3 py-2.5">{difficultyPill((q.difficulty ?? '').trim())}</td>
                  <td className="px-3 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap capitalize">
                    {(q.question_type ?? '').trim().replace(/[_-]+/g, ' ') || (
                      <span className="text-gray-300 dark:text-gray-600">&mdash;</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onOpen(q.question_id)}
                      className={cn(
                        'inline-flex items-center gap-1 text-[11px] font-semibold border rounded-lg px-2 py-1 whitespace-nowrap transition-colors',
                        isOpen
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800 bg-white dark:bg-gray-900 hover:bg-violet-50 dark:hover:bg-violet-950/40',
                      )}
                    >
                      {isOpen ? 'Close' : 'View'}
                      <ChevronRight className={cn('w-3 h-3 transition-transform', isOpen && 'rotate-90')} />
                    </button>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-violet-50/30 dark:bg-violet-950/10">
                    <td colSpan={9} className="px-3 py-3">
                      {renderDetail(q.question_id)}
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-gray-100 dark:border-gray-800">
          <p className="text-[10px] text-gray-400 tabular-nums">
            {(current - 1) * pageSize + 1}–{Math.min(current * pageSize, questions.length)} of {questions.length}
          </p>
          <div className="flex items-center gap-1">
            <PageBtn onClick={() => onPage(current - 1)} disabled={current === 1} label="Previous page">
              <ChevronLeft className="w-3.5 h-3.5" />
            </PageBtn>
            {pageWindow(current, pages).map((pg, i) =>
              typeof pg === 'string' ? (
                <span key={'gap' + i} className="px-1 text-[11px] text-gray-400">
                  &hellip;
                </span>
              ) : (
                <PageBtn key={pg} onClick={() => onPage(pg)} active={pg === current}>
                  {pg}
                </PageBtn>
              ),
            )}
            <PageBtn onClick={() => onPage(current + 1)} disabled={current >= pages} label="Next page">
              <ChevronRight className="w-3.5 h-3.5" />
            </PageBtn>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Question insights toolbar (reference screen 6) ───────────────────────────

export type ResultFilter = 'all' | 'correct' | 'incorrect' | 'skipped';

export function QuestionInsightsToolbar({
  model,
  result,
  onResult,
  subject,
  onSubject,
  counts,
  lang,
  onLang,
}: {
  model: AttemptReportModel;
  result: ResultFilter;
  onResult: (v: ResultFilter) => void;
  subject: string | null;
  onSubject: (v: string | null) => void;
  counts: Record<ResultFilter, number>;
  /**
   * Which language the question stems are read in.
   *
   * Offered only on a paper that actually carries both — the caller passes
   * `undefined` otherwise, and the control does not render. The three modes match
   * the test screen's, so the aspirant meets the same choice in the same words.
   */
  lang?: LangMode;
  onLang?: (v: LangMode) => void;
}) {
  /** The language this paper can switch into, or null when it carries only one. */
  const trLang = useMemo(
    () => paperTranslationLang(model.questions ?? [], q => q.body),
    [model.questions],
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5 mb-3">
      {/* Each filter carries the dot of the result it selects, so the row reads
          as a legend as well as a control. */}
      {(
        [
          { value: 'all', label: 'All', count: counts.all, dot: null },
          { value: 'correct', label: 'Correct', count: counts.correct, dot: ACCENT.emerald.hex },
          { value: 'incorrect', label: 'Incorrect', count: counts.incorrect, dot: ACCENT.rose.hex },
          { value: 'skipped', label: 'Skipped', count: counts.skipped, dot: ACCENT.slate.hex },
        ] as Array<{ value: ResultFilter; label: string; count: number; dot: string | null }>
      ).map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onResult(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors',
            result === o.value
              ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800',
          )}
        >
          {o.dot && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: o.dot }} />}
          {o.label}
          <span className="text-gray-400">({o.count})</span>
        </button>
      ))}
      {model.subjects.length > 1 && (
        <select
          value={subject ?? ''}
          onChange={e => onSubject(e.target.value || null)}
          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 outline-none"
        >
          <option value="">All subjects</option>
          {model.subjects.map(s => (
            <option key={s.subjectId} value={s.subjectId}>
              {s.name}
            </option>
          ))}
        </select>
      )}
      {trLang && lang && onLang && (
        <select
          value={lang}
          onChange={e => onLang(e.target.value as LangMode)}
          aria-label="Question language"
          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 outline-none"
        >
          {langModeOptions(trLang).map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      {(result !== 'all' || subject) && (
        <button
          type="button"
          onClick={() => {
            onResult('all');
            onSubject(null);
          }}
          className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 hover:underline px-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}
