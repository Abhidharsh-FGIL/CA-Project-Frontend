import { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUp,
  ArrowDown,
  GraduationCap,
  AlertTriangle,
  Target,
  Calendar,
  Mail,
  Lock,
  Activity,
  ClipboardList,
  Users,
  Brain,
  School,
  Hash,
  BookOpen,
  UserCheck,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  SkhcReport as SkhcReportData,
  SkhcComparisonSubject,
  SkhcSubjectPerformance,
  SkhcSubjectDiagnostic,
  SkhcImprovementPlanItem,
  SkhcExamRow,
  SkhcCohortComparison,
  SkhcBehaviourParameter,
  SkhcTrendSegment,
  SkhcGrowthWaterfall,
  SkhcSubjectChart,
  SkhcPercentileChart,
  SkhcClassDistribution,
  SkhcStakeholderGuideItem,
  SkhcCertification,
} from '@/lib/userPortalApi';

// ── Helpers ──────────────────────────────────────────────────────────────────

function gradeMeta(grade: string | undefined | null): { bg: string; text: string; ring: string } {
  switch ((grade || '').toUpperCase()) {
    case 'A': return { bg: 'bg-emerald-500', text: 'text-emerald-600', ring: 'ring-emerald-200' };
    case 'B': return { bg: 'bg-green-500', text: 'text-green-600', ring: 'ring-green-200' };
    case 'C': return { bg: 'bg-amber-500', text: 'text-amber-600', ring: 'ring-amber-200' };
    case 'D': return { bg: 'bg-orange-500', text: 'text-orange-600', ring: 'ring-orange-200' };
    default: return { bg: 'bg-red-500', text: 'text-red-600', ring: 'ring-red-200' };
  }
}

function verdictMeta(verdict: string | undefined | null) {
  const v = (verdict || '').toLowerCase();
  if (v === 'improved' || v === 'improvement') {
    return { color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900', icon: <TrendingUp className="w-4 h-4" /> };
  }
  if (v === 'declined' || v === 'decline') {
    return { color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900', icon: <TrendingDown className="w-4 h-4" /> };
  }
  return { color: 'text-gray-500', bg: 'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700', icon: <Minus className="w-4 h-4" /> };
}

function deltaColor(n: number): string {
  if (n > 0) return '#10b981';
  if (n < 0) return '#ef4444';
  return '#9ca3af';
}

function DeltaPill({ value, suffix = '' }: { value: number; suffix?: string }) {
  const up = value > 0;
  const down = value < 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-xs font-bold tabular-nums"
      style={{ color: deltaColor(value) }}
    >
      {up && <ArrowUp className="w-3 h-3" />}
      {down && <ArrowDown className="w-3 h-3" />}
      {value > 0 ? '+' : ''}{value}{suffix}
    </span>
  );
}

function fmtDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Display labels use "Attempt" instead of "Exam" everywhere in the report.
function reExam(s: string | undefined | null): string {
  if (s == null) return '';
  return String(s).replace(/Exam/g, 'Attempt').replace(/exam/g, 'attempt');
}

/**
 * Strip the internal "SKHC" tag from anything shown to a reader.
 *
 * The server names the report "SKHC Comprehensive Progress Report" and ids it
 * "SKHC-2025-…". The acronym means nothing to an aspirant, so it's removed at display
 * time — an id that is only the tag (or empty after stripping) is left as it was,
 * since a blank identifier is worse than an opaque one.
 */
function stripSkhc(s: string | undefined | null): string {
  if (s == null) return '';
  const cleaned = String(s)
    .replace(/SKHC[\s—–-]*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return cleaned || String(s);
}

function SectionCard({ title, icon, children, accent }: { title: string; icon: React.ReactNode; children: React.ReactNode; accent?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-indigo-500">{icon}</span>
        <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{title}</h3>
        {accent && <span className="ml-auto">{accent}</span>}
      </div>
      {children}
    </div>
  );
}

// ── Sub-sections ─────────────────────────────────────────────────────────────

function ExamOverview({ exams }: { exams: SkhcExamRow[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {exams.map((e, i) => {
        const g = gradeMeta(e.grade);
        return (
          <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{reExam(e.label)}</span>
              {e.grade && (
                <span className={cn('w-6 h-6 rounded-md text-white text-xs font-bold flex items-center justify-center', g.bg)}>
                  {e.grade}
                </span>
              )}
            </div>
            {e.type && <p className="text-[11px] text-indigo-500 font-medium mb-1.5">{e.type}</p>}
            <div className="flex items-end justify-between">
              <div>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums leading-none">
                  {e.percentage}%
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">{e.score} / {e.max_score}</p>
              </div>
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {fmtDate(e.date)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ComparisonSubjectRow({ s }: { s: SkhcComparisonSubject }) {
  return (
    <tr className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
      <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">{s.subject}</td>
      <td className="text-center px-2 py-2 text-gray-500 tabular-nums">{s.previous_marks}</td>
      <td className="text-center px-2 py-2 font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{s.current_marks}</td>
      <td className="text-center px-2 py-2"><DeltaPill value={s.delta_marks} /></td>
      <td className="text-right px-3 py-2"><DeltaPill value={s.delta_percentage} suffix="%" /></td>
    </tr>
  );
}

function ScoreTrendChart({ points }: { points: { label: string; percentage: number; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={points} margin={{ top: 10, right: 16, bottom: 4, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value: number, name: string) => [name === 'percentage' ? `${value}%` : value, name === 'percentage' ? 'Percentage' : 'Score']}
          contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Line
          type="monotone"
          dataKey="percentage"
          stroke="#6366f1"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#6366f1' }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ProficiencyRadar({
  data,
  firstLabel = 'First attempt',
  latestLabel = 'Latest attempt',
}: {
  data: { subject: string; First: number; Latest: number }[];
  firstLabel?: string;
  latestLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <RadarChart data={data} outerRadius="68%" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <PolarGrid stroke="#d1d5db" />
        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#374151' }} />
        <PolarRadiusAxis
          domain={[0, 100]}
          tickCount={5}
          angle={90}
          tick={{ fontSize: 9, fill: '#9ca3af' }}
          tickFormatter={(v: number) => `${v}%`}
        />
        <Radar name={firstLabel} dataKey="First" stroke="#334e7a" fill="#334e7a" fillOpacity={0.3} dot={{ r: 3, fill: '#334e7a' }} />
        <Radar name={latestLabel} dataKey="Latest" stroke="#e11d48" fill="#e11d48" fillOpacity={0.25} dot={{ r: 3, fill: '#e11d48' }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip formatter={(value: number, name: string) => [`${value}%`, name]} contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

function SubjectPerformanceTable({ subjects }: { subjects: SkhcSubjectPerformance[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
            <th className="text-left font-semibold px-3 py-2">Subject</th>
            <th className="text-center font-semibold px-2 py-2">First</th>
            <th className="text-center font-semibold px-2 py-2">Latest</th>
            <th className="text-center font-semibold px-2 py-2">Δ Marks</th>
            <th className="text-center font-semibold px-2 py-2">Δ %</th>
            <th className="text-right font-semibold px-3 py-2">Grade</th>
          </tr>
        </thead>
        <tbody>
          {subjects.map((s, i) => {
            const g = gradeMeta(s.grade);
            return (
              <tr key={i} className="border-b border-gray-50 dark:border-gray-800/60 last:border-0">
                <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200">{s.subject}</td>
                <td className="text-center px-2 py-2.5 text-gray-500 tabular-nums">{s.first_percentage}%</td>
                <td className="text-center px-2 py-2.5 font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{s.latest_percentage}%</td>
                <td className="text-center px-2 py-2.5"><DeltaPill value={s.delta_marks} /></td>
                <td className="text-center px-2 py-2.5"><DeltaPill value={s.delta_percentage} suffix="%" /></td>
                <td className="text-right px-3 py-2.5">
                  <span className={cn('inline-flex w-6 h-6 rounded-md text-white text-xs font-bold items-center justify-center', g.bg)}>
                    {s.grade}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DiagnosticCard({ d }: { d: SkhcSubjectDiagnostic }) {
  const g = gradeMeta(d.grade);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{d.subject}</span>
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-bold tabular-nums', g.text)}>{d.percentage}%</span>
          <span className={cn('w-5 h-5 rounded text-white text-[10px] font-bold flex items-center justify-center', g.bg)}>{d.grade}</span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden mb-2">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, d.percentage)}%`, backgroundColor: g.bg.includes('red') ? '#ef4444' : g.bg.includes('amber') ? '#f59e0b' : '#10b981' }} />
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{d.observation}</p>
    </div>
  );
}

const PRIORITY_META: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900',
  MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900',
  LOW: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900',
};

function ImprovementPlanRow({ item }: { item: SkhcImprovementPlanItem }) {
  const cls = PRIORITY_META[(item.priority || '').toUpperCase()] || PRIORITY_META.LOW;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
      <div className="flex items-center gap-2 mb-1.5">
        <span className={cn('text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border', cls)}>
          {item.priority}
        </span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{item.subject}</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        <span className="font-semibold text-gray-600 dark:text-gray-300">Gap:</span> {item.gap_identified}
      </p>
      <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
        <span className="font-semibold text-indigo-600 dark:text-indigo-400">Action:</span> {item.recommended_action}
      </p>
    </div>
  );
}

function priorityColor(p: string): string {
  switch ((p || '').toUpperCase()) {
    case 'HIGH': return '#dc2626';
    case 'MEDIUM': return '#d97706';
    case 'LOW': return '#059669';
    case 'ENRICHMENT': return '#7c3aed';
    default: return '#6b7280';
  }
}

// Targeted improvement plan rendered as a table (matches the printed report layout).
function ImprovementPlanTable({ items }: { items: SkhcImprovementPlanItem[] }) {
  const hasDuration = items.some((i) => i.duration);
  const hasModule = items.some((i) => i.platform_module);
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-white text-left text-[11px] uppercase tracking-wide">
            <th className="px-3 py-2 font-semibold">Priority</th>
            <th className="px-3 py-2 font-semibold">Subject / Skill</th>
            <th className="px-3 py-2 font-semibold">Gap Identified</th>
            <th className="px-3 py-2 font-semibold">Recommended Action</th>
            {hasDuration && <th className="px-3 py-2 font-semibold whitespace-nowrap">Duration</th>}
            {hasModule && <th className="px-3 py-2 font-semibold">Platform Module</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i} className="border-t border-gray-100 dark:border-gray-800 align-top">
              <td className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: priorityColor(item.priority) }}>
                {item.priority}
              </td>
              <td className="px-3 py-2.5 font-medium text-gray-800 dark:text-gray-200">{item.subject}</td>
              <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{item.gap_identified}</td>
              <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{item.recommended_action}</td>
              {hasDuration && <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400 whitespace-nowrap">{item.duration ?? '—'}</td>}
              {hasModule && <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">{item.platform_module ?? '—'}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Per-stakeholder recommended actions, rendered as a table (matches the printed guide).
function StakeholderGuide({ items }: { items: SkhcStakeholderGuideItem[] }) {
  const hasTools = items.some((i) => (i.tools && i.tools.length > 0) || i.tool);
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-white text-left text-[11px] uppercase tracking-wide">
            <th className="px-3 py-2 font-semibold w-40">Stakeholder</th>
            <th className="px-3 py-2 font-semibold">Recommended Actions</th>
            {hasTools && <th className="px-3 py-2 font-semibold">Tool</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-t border-gray-100 dark:border-gray-800 align-top">
              <td className="px-3 py-2.5">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{it.name || it.stakeholder}</p>
                {it.name && <p className="text-[11px] text-gray-500 dark:text-gray-400">({it.stakeholder})</p>}
              </td>
              <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">
                <ol className="list-decimal list-inside space-y-1">
                  {(it.actions || []).map((a, j) => (
                    <li key={j} className="leading-relaxed">{a}</li>
                  ))}
                </ol>
              </td>
              {hasTools && (
                <td className="px-3 py-2.5 text-gray-600 dark:text-gray-400">
                  {it.tools && it.tools.length > 0 ? (
                    <ul className="space-y-1">{it.tools.map((t, k) => <li key={k}>{t}</li>)}</ul>
                  ) : (
                    it.tool || '—'
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Report certification / details — a label→value table (matches the printed report).
function Certification({ data }: { data: SkhcCertification }) {
  const rows: { label: string; value: string }[] = [];
  const push = (label: string, value?: string | null) => {
    if (value != null && value !== '') rows.push({ label, value });
  };
  push('Report Title', stripSkhc(data.report_title));
  push('Student ID', data.student_id);
  push('Student', data.student_name);
  push('Class & Section', data.class_section);
  push('School', data.school);
  push('Class Teacher', data.class_teacher);
  push('Academic Year', data.academic_year);
  push('Report Generated', data.report_generated ? fmtDate(data.report_generated) : undefined);
  if (data.exams_covered && data.exams_covered.length > 0) {
    push('Attempts Covered', data.exams_covered.map((e) => `${reExam(e.label)} (${fmtDate(e.date)})`).join(', '));
  }
  push('Assessment Platform', data.assessment_platform);
  push('Assessment Methodology', data.assessment_methodology);

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-white text-left text-[11px] uppercase tracking-wide">
            <th className="px-3 py-2 font-semibold" colSpan={2}>Report Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100 dark:border-gray-800 even:bg-gray-50/60 dark:even:bg-gray-800/30 align-top">
              <td className="px-3 py-2.5 font-semibold text-indigo-700 dark:text-indigo-300 w-44 sm:w-52 whitespace-nowrap">{r.label}</td>
              <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">{r.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Cohort comparison ─────────────────────────────────────────────────────────

function CohortStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-xl border p-2.5 text-center', highlight ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/30' : 'border-gray-200 dark:border-gray-800')}>
      <p className="text-[9px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={cn('text-base font-bold tabular-nums', highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-gray-100')}>{value}</p>
    </div>
  );
}

function CohortComparison({ c }: { c: SkhcCohortComparison }) {
  const soloCohort = c.cohort_size <= 1;
  return (
    <div className="space-y-3">
      {/* Rank highlight */}
      <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-900/40 p-3">
        <div className="flex flex-col items-center justify-center w-14 h-14 rounded-xl bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900 shrink-0">
          <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400 leading-none">#{c.rank}</span>
          <span className="text-[9px] uppercase tracking-wide text-gray-400 mt-0.5">Rank</span>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
              {c.percentile}th percentile
            </span>
            {!soloCohort && (
              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', c.above_mean ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700')}>
                {c.above_mean ? 'Above average' : 'Below average'}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 leading-snug">{c.message}</p>
        </div>
      </div>

      {/* Stat grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        <CohortStat label="You" value={`${c.student_percentage}%`} highlight />
        <CohortStat label="Top" value={`${c.top_percentage}%`} />
        <CohortStat label="Mean" value={`${c.mean_percentage}%`} />
        <CohortStat label="Median" value={`${c.median_percentage}%`} />
        <CohortStat label="Cohort" value={String(c.cohort_size)} />
      </div>

      {!soloCohort && c.gap_to_topper > 0 && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-700 dark:text-gray-300">{c.gap_to_topper}%</span> behind the topper.
        </p>
      )}
    </div>
  );
}

// ── Behavioural profile ─────────────────────────────────────────────────────────

function levelMeta(level: string | undefined | null) {
  const l = (level || '').toLowerCase();
  if (l === 'strength') return { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' };
  if (l === 'developing') return { dot: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900' };
  if (l === 'focus area') return { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900' };
  return { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' };
}

function BehaviourCard({ p }: { p: SkhcBehaviourParameter }) {
  const m = levelMeta(p.latest_level);
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{p.name}</p>
          <p className="text-[10px] uppercase tracking-wide text-gray-400">{p.category}</p>
        </div>
        <span className={cn('inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap', m.badge)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', m.dot)} />
          {p.latest_level}
        </span>
      </div>
      {p.per_exam && p.per_exam.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
          {p.per_exam.map((e, i) => {
            const em = levelMeta(e.level);
            return (
              <span key={i} className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                {i > 0 && <span className="text-gray-300">→</span>}
                <span className={cn('w-1.5 h-1.5 rounded-full', em.dot)} />
                {reExam(e.label)}: {e.level}
              </span>
            );
          })}
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{p.note}</p>
    </div>
  );
}

// ── Growth analysis (per-period segments) ──────────────────────────────────────

function GrowthSegmentRow({ s }: { s: SkhcTrendSegment }) {
  const up = s.points_gained >= 0;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 p-3">
      <span
        className={cn('flex items-center justify-center w-9 h-9 rounded-lg shrink-0', up ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40' : 'bg-red-50 text-red-600 dark:bg-red-950/40')}
      >
        {up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{reExam(s.period ?? 'Overall')}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{s.observation}</p>
      </div>
      <div className="text-right shrink-0">
        <DeltaPill value={s.points_gained} />
        <p className="text-[10px] tabular-nums" style={{ color: deltaColor(s.pct_growth) }}>{s.pct_growth > 0 ? '+' : ''}{s.pct_growth}%</p>
      </div>
    </div>
  );
}

// ── Growth waterfall (baseline → growth deltas → final) ─────────────────────────

function waterfallColor(kind: string, value: number): string {
  if (kind === 'growth') return value >= 0 ? '#10b981' : '#ef4444';
  if (kind === 'baseline') return '#6366f1';
  if (kind === 'final') return '#8b5cf6';
  return '#3b82f6'; // intermediate exam score
}

function GrowthWaterfall({ wf }: { wf: SkhcGrowthWaterfall }) {
  // Running total so each "growth" bar floats between consecutive scores.
  let running = 0;
  const data = (wf.bars || []).map((b) => {
    if (b.type === 'growth') {
      const prev = running;
      const next = running + (b.value || 0);
      running = next;
      return {
        label: reExam(b.label),
        base: Math.min(prev, next),
        bar: Math.abs(b.value || 0),
        kind: 'growth',
        value: b.value,
        display: b.display ?? String(b.value),
      };
    }
    running = b.value || 0;
    return { label: reExam(b.label), base: 0, bar: b.value || 0, kind: b.type, value: b.value, display: b.display ?? String(b.value) };
  });

  const yMax = wf.y_max || Math.max(...data.map((d) => d.base + d.bar), 1);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 18, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} axisLine={false} tickLine={false} />
        <YAxis domain={[0, yMax]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const d = payload[0]?.payload;
            if (!d) return null;
            return (
              <div className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
                <p className="font-semibold text-gray-800">{d.label}</p>
                <p className="text-gray-500 tabular-nums">
                  {d.kind === 'growth' ? `${d.value > 0 ? '+' : ''}${d.display} marks` : `${d.display} marks`}
                </p>
              </div>
            );
          }}
        />
        {/* Invisible offset so growth bars float at the right height */}
        <Bar dataKey="base" stackId="wf" fill="transparent" isAnimationActive={false} />
        <Bar
          dataKey="bar"
          stackId="wf"
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
          label={(props: any) => {
            const d = data[props.index];
            if (!d || props.x == null) return <text />;
            return (
              <text x={props.x + props.width / 2} y={props.y - 5} textAnchor="middle" fontSize={10} fill="#6b7280" className="tabular-nums">
                {d.display}
              </text>
            );
          }}
        >
          {data.map((d, i) => (
            <Cell key={i} fill={waterfallColor(d.kind, d.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Subject-wise performance (grouped bars: each subject across all exams) ──────

const SUBJECT_EXAM_COLORS = ['#cbd5e1', '#a5b4fc', '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6'];

/**
 * Tooltip for the subject chart.
 *
 * Recharts' built-in tooltip lays its label out on one line, so a subject like
 * "History, Culture & Socio-Political Movements of Tamil Nadu" runs straight out of
 * the card. This one has a fixed maximum width and wraps.
 */
function SubjectChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg px-3 py-2 w-max max-w-[220px]">
      <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100 leading-snug break-words">
        {String(label ?? '')}
      </p>
      <div className="mt-1 space-y-0.5">
        {payload.map((p: any) => (
          <p key={p.dataKey} className="flex items-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: p.color }} />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto pl-2 font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {p.value == null ? '—' : `${p.value}%`}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

/** True on phone-width screens, where a wide category axis would eat the plot. */
function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return narrow;
}

/**
 * Subject-wise comparison across attempts.
 *
 * Horizontal: subject names are long ("History, Culture & Socio-Political Movements of
 * Tamil Nadu", and the Tamil eligibility paper), and as vertical-axis categories they
 * get the room to be read. They used to be truncated in the *data*, which meant the
 * tooltip showed the cut name too and the full one was unreachable — the label is kept
 * whole now and shortened only for the axis tick.
 */
function SubjectChart({ chart }: { chart: SkhcSubjectChart }) {
  const narrow = useNarrowScreen();
  const examLabels = (chart.exam_labels || []).map((l) => reExam(l));
  const data = (chart.subjects || []).map((s) => {
    const row: Record<string, any> = { subject: s.subject };
    examLabels.forEach((lbl, i) => {
      row[lbl] = s.percentages?.[i] ?? null;
    });
    return row;
  });

  const axisWidth = narrow ? 104 : 172;
  const maxChars = narrow ? 14 : 26;
  const shorten = (v: string) => (v.length > maxChars ? v.slice(0, maxChars - 1) + '…' : v);

  // One row per subject, tall enough for its stack of attempt bars.
  const rowHeight = Math.max(44, examLabels.length * 16 + 26);
  const height = Math.max(200, data.length * rowHeight + 44);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 20, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="subject"
          width={axisWidth}
          interval={0}
          tick={{ fontSize: 11, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={shorten}
        />
        <Tooltip
          content={<SubjectChartTooltip />}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
          // Keep it inside the plot: a long subject name would otherwise run out of the card.
          allowEscapeViewBox={{ x: false, y: false }}
          wrapperStyle={{ zIndex: 20 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {examLabels.map((lbl, i) => (
          <Bar
            key={lbl}
            dataKey={lbl}
            fill={SUBJECT_EXAM_COLORS[i % SUBJECT_EXAM_COLORS.length]}
            radius={[0, 4, 4, 0]}
            maxBarSize={14}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Percentile rank across exams (line + median reference) ──────────────────────

function PercentileChart({ chart }: { chart: SkhcPercentileChart }) {
  const data = (chart.points || []).map((p) => ({ label: reExam(p.label), percentile: p.percentile, percentage: p.percentage }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value: number, name: string) =>
            name === 'percentile' ? [`${value}th`, 'Percentile'] : [`${value}%`, 'Score']
          }
          contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <ReferenceLine
          y={chart.median_line}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          label={{ value: `Median ${chart.median_line}th`, position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }}
        />
        <Line type="monotone" dataKey="percentile" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Class score distribution (histogram, student's bin highlighted) ─────────────

function ClassDistribution({ dist }: { dist: SkhcClassDistribution }) {
  const data = (dist.histogram || []).map((b) => ({ range: b.range, count: b.count, isStudent: b.is_student_bin }));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <CohortStat label="Your score" value={`${dist.student_score}/${dist.max_score}`} highlight />
        <CohortStat label="Class mean" value={String(dist.mean_score)} />
        <CohortStat label="Median" value={String(dist.median_score)} />
        <CohortStat label="Std dev" value={String(dist.std_deviation)} />
      </div>

      <ResponsiveContainer width="100%" height={210}>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
          <XAxis dataKey="range" tick={{ fontSize: 11, fill: '#6b7280' }} interval={0} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value: number) => [`${value} student${value === 1 ? '' : 's'}`, 'Count']}
            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
            contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.isStudent ? '#6366f1' : '#cbd5e1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Your range</span>
        <span>
          Ahead of <span className="font-semibold text-gray-700 dark:text-gray-300">{dist.student_above_n_students}</span> of {dist.class_size} students
        </span>
        {dist.students_above_70 && (
          <span>{dist.students_above_70.count} scored ≥70%</span>
        )}
        <span>
          {dist.student_vs_mean >= 0 ? '+' : ''}{dist.student_vs_mean} vs class mean
        </span>
      </div>
    </div>
  );
}

// ── Psychometric & behavioural profile (level heatmap across exams) ─────────────

const PSYCHO_META: Record<string, { bg: string; symbol: string }> = {
  Strength: { bg: '#2faa6a', symbol: '★' },
  Developing: { bg: '#d9a441', symbol: '◆' },
  'Focus Area': { bg: '#e0584d', symbol: '▲' },
};
function psychoMeta(level: string) {
  return PSYCHO_META[level] || { bg: '#cbd5e1', symbol: '·' };
}
export function SkhcReport({ report }: { report: SkhcReportData }) {
  // Default every array/object — newer report payloads may omit some sections.
  const {
    profile = {} as any,
    exam_overview = [],
    comparison,
    score_trend,
    subject_performance = [],
    subject_diagnostics = [],
    proficiency_radar = [],
    improvement_plan = [],
    overall_assessment,
    unavailable_sections = [],
  } = report;
  const cohort = report.cohort_comparison ?? null;
  const behaviour = report.behavioural_profile ?? null;
  const growth = report.growth_analysis ?? [];
  const waterfall = report.growth_waterfall ?? null;
  const subjectChart = report.subject_chart ?? null;
  const percentileChart = report.percentile_chart ?? null;
  const classDist = report.class_distribution ?? null;
  /**
   * Only the aspirant's own row survives.
   *
   * Headmaster, Class Teacher and Parent rows are leftovers from the school
   * product — a competitive-exam candidate has none of them in the loop, and the
   * generated advice merely restated every subject name back at a third party.
   */
  const stakeholderGuide = (report.stakeholder_guide ?? []).filter(
    it => !/head\s*master|headmistress|principal|class\s*teacher|teacher|parent|guardian|mother|father/i.test(
      it.stakeholder ?? '',
    ),
  );
  const certification = report.certification ?? null;
  // Exam labels for the radar legend (first vs latest), derived from the exam list.
  const firstExamLabel = reExam(exam_overview[0]?.label ?? score_trend?.points?.[0]?.label) || 'First attempt';
  const latestExamLabel =
    reExam(
      exam_overview[exam_overview.length - 1]?.label ??
        score_trend?.points?.[(score_trend?.points?.length ?? 1) - 1]?.label,
    ) || 'Latest attempt';

  const overallGrade = gradeMeta(overall_assessment?.grade);
  const cmpVerdict = verdictMeta(comparison?.verdict);

  const trendData = (score_trend?.points ?? []).map(p => ({ label: reExam(p.label), percentage: p.percentage, score: p.score }));
  const radarData = (proficiency_radar ?? []).map(r => ({ subject: r.subject, First: r.first_percentage, Latest: r.latest_percentage }));

  return (
    <div className="space-y-5">
      {/* ── Header / profile ── */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">
                {stripSkhc(report.report_title)}
              </p>
              {profile.report_id && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/15 rounded-full px-2 py-0.5 tabular-nums">
                  <Hash className="w-2.5 h-2.5" /> {profile.report_id}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold leading-tight">{profile.student_name}</h1>
            <div className="flex items-center gap-3 mt-1 text-xs text-white/80 flex-wrap">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {profile.email}</span>
              {profile.class_section && (
                <span className="flex items-center gap-1"><GraduationCap className="w-3 h-3" /> {profile.class_section}</span>
              )}
              {profile.roll_no && (
                <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> Roll {profile.roll_no}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-white/70 flex-wrap">
              {profile.school && (
                <span className="flex items-center gap-1 min-w-0"><School className="w-3 h-3 shrink-0" /> <span className="truncate">{profile.school}</span></span>
              )}
              {profile.academic_year && (
                <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {profile.academic_year}</span>
              )}
              {profile.medium && (
                <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {profile.medium}</span>
              )}
              {profile.class_teacher && (
                <span className="flex items-center gap-1"><UserCheck className="w-3 h-3" /> {profile.class_teacher}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-white/70 flex-wrap">
              <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" /> {profile.assessment_title}</span>
            </div>
          </div>
          {overall_assessment && (
            <div className={cn('flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur ring-2', overallGrade.ring)}>
              <span className="text-2xl font-bold leading-none">{overall_assessment.grade}</span>
              <span className="text-[9px] uppercase tracking-wide text-white/70 mt-0.5">Grade</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="bg-white/10 rounded-lg px-3 py-2">
            <p className="text-[9px] uppercase tracking-wide text-white/60">Attempts</p>
            <p className="text-base font-bold tabular-nums">{profile.total_exams}</p>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2">
            <p className="text-[9px] uppercase tracking-wide text-white/60">Latest</p>
            <p className="text-base font-bold tabular-nums">{overall_assessment?.latest_percentage ?? '—'}%</p>
          </div>
          <div className="bg-white/10 rounded-lg px-3 py-2">
            <p className="text-[9px] uppercase tracking-wide text-white/60">Generated</p>
            <p className="text-base font-bold">{fmtDate(profile.report_generated)}</p>
          </div>
        </div>
      </div>

      {/* ── Overall assessment ── */}
      {overall_assessment && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">Overall Assessment</h3>
            <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold" style={{ color: deltaColor(overall_assessment.growth_points) }}>
              {overall_assessment.growth_points >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              {overall_assessment.growth_points > 0 ? '+' : ''}{overall_assessment.growth_points} pts
            </span>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">{overall_assessment.trajectory}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{overall_assessment.recommendation}</p>
        </div>
      )}

      {/* ── Cohort comparison ── */}
      {cohort && (
        <SectionCard title="Cohort Standing" icon={<Users className="w-4 h-4" />}>
          <CohortComparison c={cohort} />
        </SectionCard>
      )}

      {/* ── Percentile rank across exams ── */}
      {percentileChart && (percentileChart.points?.length ?? 0) > 0 && (
        <SectionCard title={reExam(percentileChart.title) || 'Percentile Rank Across Attempts'} icon={<Activity className="w-4 h-4" />}>
          <PercentileChart chart={percentileChart} />
        </SectionCard>
      )}

      {/* ── Class score distribution ── */}
      {classDist && (classDist.histogram?.length ?? 0) > 0 && (
        <SectionCard title={classDist.title || 'Class Score Distribution'} icon={<BarChart3 className="w-4 h-4" />}>
          <ClassDistribution dist={classDist} />
        </SectionCard>
      )}

      {/* ── Exam overview ── */}
      {exam_overview.length > 0 && (
        <SectionCard title="Attempt Overview" icon={<ClipboardList className="w-4 h-4" />}>
          <ExamOverview exams={exam_overview} />
        </SectionCard>
      )}

      {/* ── Comparison (current vs previous) ── */}
      {comparison?.has_previous && (
        <SectionCard
          title="Latest vs Previous"
          icon={<Activity className="w-4 h-4" />}
          accent={
            <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border capitalize', cmpVerdict.bg, cmpVerdict.color)}>
              {cmpVerdict.icon}
              {comparison.verdict}
            </span>
          }
        >
          <div className={cn('flex items-start gap-2 rounded-xl border p-3 mb-3', cmpVerdict.bg)}>
            <span className={cmpVerdict.color}>{cmpVerdict.icon}</span>
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{reExam(comparison.message)}</p>
          </div>
          {(comparison.subjects?.length ?? 0) > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left font-semibold px-3 py-2">Subject</th>
                    <th className="text-center font-semibold px-2 py-2">Prev</th>
                    <th className="text-center font-semibold px-2 py-2">Now</th>
                    <th className="text-center font-semibold px-2 py-2">Δ Marks</th>
                    <th className="text-right font-semibold px-3 py-2">Δ %</th>
                  </tr>
                </thead>
                <tbody>
                  {(comparison.subjects ?? []).map((s, i) => <ComparisonSubjectRow key={i} s={s} />)}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Score growth journey (waterfall) ── */}
      {waterfall && (waterfall.bars?.length ?? 0) > 0 && (
        <SectionCard title={reExam(waterfall.title) || 'Score Growth Journey'} icon={<TrendingUp className="w-4 h-4" />}>
          <GrowthWaterfall wf={waterfall} />
        </SectionCard>
      )}

      {/* ── Growth analysis (per-period) ── */}
      {growth.length > 0 && (
        <SectionCard title="Growth Analysis" icon={<Activity className="w-4 h-4" />}>
          <div className="space-y-2">
            {growth.map((s, i) => <GrowthSegmentRow key={i} s={s} />)}
          </div>
        </SectionCard>
      )}

      {/* ── Score trend + radar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {trendData.length > 1 && (
          <SectionCard title="Score Trend" icon={<TrendingUp className="w-4 h-4" />}>
            <ScoreTrendChart points={trendData} />
            {score_trend?.overall?.observation && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">{reExam(score_trend.overall.observation)}</p>
            )}
          </SectionCard>
        )}
        {radarData.length > 0 && (
          <SectionCard title="Proficiency Radar" icon={<Target className="w-4 h-4" />}>
            <ProficiencyRadar data={radarData} firstLabel={firstExamLabel} latestLabel={latestExamLabel} />
          </SectionCard>
        )}
      </div>

      {/* ── Subject performance (table) ── */}
      {subject_performance.length > 0 && (
        <SectionCard title="Subject Performance" icon={<GraduationCap className="w-4 h-4" />}>
          <SubjectPerformanceTable subjects={subject_performance} />
        </SectionCard>
      )}

      {/* ── Subject-wise performance across exams (chart) ── */}
      {subjectChart && (subjectChart.subjects?.length ?? 0) > 0 && (
        <SectionCard title={reExam(subjectChart.title) || 'Subject-wise Performance'} icon={<BarChart3 className="w-4 h-4" />}>
          <SubjectChart chart={subjectChart} />
        </SectionCard>
      )}

      {/* ── Subject diagnostics ── */}
      {subject_diagnostics.length > 0 && (
        <SectionCard title="Subject Diagnostics" icon={<AlertTriangle className="w-4 h-4" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {subject_diagnostics.map((d, i) => <DiagnosticCard key={i} d={d} />)}
          </div>
        </SectionCard>
      )}

      {/* ── Behavioural profile ── */}
      {behaviour && (behaviour.parameters?.length ?? 0) > 0 && (
        <SectionCard
          title="Behavioural Profile"
          icon={<Brain className="w-4 h-4" />}
          accent={<span className="text-[10px] text-gray-400 italic">derived proxy</span>}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {behaviour.parameters.map((p, i) => <BehaviourCard key={i} p={p} />)}
          </div>
          {behaviour.note && (
            <p className="text-[11px] text-gray-400 italic leading-relaxed mt-3">{behaviour.note}</p>
          )}
        </SectionCard>
      )}

      {/* ── Improvement plan (table) ── */}
      {improvement_plan.length > 0 && (
        <SectionCard title="Improvement Plan" icon={<Target className="w-4 h-4" />}>
          <ImprovementPlanTable items={improvement_plan} />
        </SectionCard>
      )}

      {/* ── Stakeholder action guide ── */}
      {stakeholderGuide.length > 0 && (
        <SectionCard title="Stakeholder Action Guide" icon={<Users className="w-4 h-4" />}>
          <StakeholderGuide items={stakeholderGuide} />
        </SectionCard>
      )}

      {/* ── Report certification & acknowledgement ── */}
      {certification && (
        <SectionCard title="Report Certification & Acknowledgement" icon={<ClipboardList className="w-4 h-4" />}>
          <Certification data={certification} />
        </SectionCard>
      )}

      {/* ── Unavailable sections ── */}
      {unavailable_sections.length > 0 && (
        <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-3.5">
          <div className="flex items-center gap-2 mb-1.5">
            <Lock className="w-3.5 h-3.5 text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Not included in this report</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {unavailable_sections.map((s, i) => (
              <span key={i} className="text-[11px] text-gray-400 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
