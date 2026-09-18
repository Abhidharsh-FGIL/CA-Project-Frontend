/**
 * The redesigned student report Overview (mockup screen 1) — replaces `ReportBody`/
 * `AttemptReport` for the student portal only. `ReportBody`/`AttemptReport` stay
 * untouched: `EvalAssessmentReport.tsx` (admin/evaluator side) still renders the
 * original component and must keep working unchanged.
 *
 * Every number here reads directly off the already-computed `AttemptReportModel` —
 * nothing is recalculated. Only the layout and a handful of short presentation
 * strings (insight card titles, the trophy card's line) are new.
 */
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  Calendar,
  ListChecks,
  Clock,
  GraduationCap,
  Target,
  Zap,
  Trophy,
  Sparkles,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import type { AttemptReportModel } from '@/lib/attempt-report';
import { insightHeadline, motivationalNote } from '@/lib/attempt-report';
import { priorityBadge } from '@/lib/study-plan';
import { ReportCard, SectionHeader, StatTile, ACCENT, subjectHue, type Accent } from '@/components/user/report-ui';
import type { ExamContext } from '@/lib/exam-report-config';
import { cn } from '@/lib/utils';

const BADGE_ACCENT: Record<'Highest' | 'High' | 'Medium', Accent> = {
  Highest: 'rose',
  High: 'amber',
  Medium: 'sky',
};

/** Subject name over its question count, as two lines — "label" is "name|count". */
function SubjectAxisTick({ x, y, payload }: any) {
  const [name, count] = String(payload?.value ?? '').split('|');
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={11} textAnchor="middle" fontSize={9} className="fill-gray-600 dark:fill-gray-300">
        {name.length > 10 ? `${name.slice(0, 9)}…` : name}
      </text>
      <text x={0} y={0} dy={23} textAnchor="middle" fontSize={8} className="fill-gray-400 dark:fill-gray-500">
        ({count})
      </text>
    </g>
  );
}

export function ReportOverview({ model, exam }: { model: AttemptReportModel; exam: ExamContext | null }) {
  const navigate = useNavigate();
  const s = model.summary;
  const attemptId = model.meta.attemptId;

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <ReportCard>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-gray-100 leading-tight tracking-tight">
              {model.meta.testName}
            </p>
            {(exam?.examName || exam?.stageName) && (
              <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-1 font-medium">
                {[exam?.examName, exam?.stageName].filter(Boolean).join(' — ')}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
          {model.meta.date && (
            <span className="inline-flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-500" /> {new Date(model.meta.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          )}
          <span className="inline-flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-indigo-500" /> {s.totalQuestions} Questions
          </span>
          {s.timeAllowedSec != null && (
            <span className="inline-flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" /> {Math.round(s.timeAllowedSec / 60)} Minutes
            </span>
          )}
          {exam?.stageName && (
            <span className="inline-flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-indigo-500" /> {exam.stageName}
            </span>
          )}
        </div>
      </ReportCard>

      {/* ── Stat row ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatTile
          icon={<Target className="w-4 h-4" />}
          value={s.score != null ? `${s.score}${s.maxMarks != null ? ` / ${s.maxMarks}` : ''}` : '—'}
          label="Your Score"
          accent="indigo"
          emphasis
        />
        <StatTile
          icon={<Zap className="w-4 h-4" />}
          value={s.accuracy != null ? `${s.accuracy}%` : '—'}
          label="Accuracy"
          hint={`${s.correct} / ${s.attempted} correct`}
          accent="emerald"
        />
        <StatTile
          icon={<ListChecks className="w-4 h-4" />}
          value={s.attemptRate != null ? `${s.attemptRate}%` : '—'}
          label="Attempt Rate"
          hint={`${s.attempted} / ${s.totalQuestions} attempted`}
          accent="violet"
        />
        <StatTile
          icon={<Clock className="w-4 h-4" />}
          value={s.timeUsedSec != null ? `${Math.round(s.timeUsedSec / 60)} min` : '—'}
          label="Time Taken"
          hint={s.timeAllowedSec != null ? `of ${Math.round(s.timeAllowedSec / 60)} min allowed` : undefined}
          accent="sky"
        />
        <StatTile
          icon={<Trophy className="w-4 h-4" />}
          value="Keep going!"
          label="Momentum"
          hint={motivationalNote(model)}
          accent="amber"
          emphasis
        />
      </div>

      {/* ── AI Performance Insights ───────────────────────────────────────── */}
      <ReportCard>
        <SectionHeader
          icon={<Sparkles className="w-4 h-4" />}
          title="AI Performance Insights"
          subtitle="Based on your answers, here's what the data reveals."
          action={
            <button
              type="button"
              onClick={() => navigate(`/user/report/${attemptId}/insights`)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold px-3.5 py-2 hover:from-indigo-700 hover:to-purple-700 transition-all whitespace-nowrap"
            >
              View Detailed Insights <ArrowRight className="w-3.5 h-3.5" />
            </button>
          }
        />
        {model.diagnostics.length === 0 ? (
          <p className="text-[11px] text-gray-400">Not enough attempted questions yet for an insight.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {model.diagnostics.slice(0, 4).map(f => (
              <div key={f.rank} className={cn('rounded-xl p-3', ACCENT[f.confidence === 'HIGH' ? 'indigo' : 'slate'].wash)}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white/70 dark:bg-gray-900/50 text-[10px] font-bold flex items-center justify-center">
                    {f.rank}
                  </span>
                  <p className="text-[11px] font-bold text-gray-900 dark:text-gray-100 leading-tight">{insightHeadline(f)}</p>
                </div>
                <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        )}
      </ReportCard>

      {/* ── Subject bars + priorities ─────────────────────────────────────── */}
      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-4 items-start">
        <ReportCard>
          <SectionHeader
            icon={<Target className="w-4 h-4" />}
            title="Subject Performance Overview"
            action={
              <button
                type="button"
                onClick={() => navigate(`/user/report/${attemptId}/subjects`)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 text-[11px] font-semibold px-2.5 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors whitespace-nowrap"
              >
                View All Subjects <ArrowRight className="w-3 h-3" />
              </button>
            }
          />
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={model.subjects.map(sub => ({
                  label: `${sub.name}|${sub.metrics.questions}`,
                  accuracy: sub.metrics.accuracy ?? 0,
                }))}
              >
                <XAxis dataKey="label" tick={<SubjectAxisTick />} interval={0} height={40} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} width={30} />
                <Tooltip formatter={(v: number) => `${v}%`} labelFormatter={(v: string) => v.split('|')[0]} />
                <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                  {model.subjects.map((sub, i) => (
                    <Cell key={sub.subjectId} fill={subjectHue(i)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ReportCard>

        <ReportCard>
          <SectionHeader icon={<Lightbulb className="w-4 h-4" />} title="Priority Learning Areas" />
          {model.priorities.length === 0 ? (
            <p className="text-[11px] text-gray-400">Nothing to prioritise from this attempt yet.</p>
          ) : (
            <ol className="space-y-2">
              {model.priorities.map(p => {
                const subject = model.subjects.find(sub => sub.subjectId === p.nodeId);
                const badge = priorityBadge(p.rank);
                return (
                  <li key={p.nodeId} className="flex items-center gap-2.5">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold flex items-center justify-center">
                      {p.rank}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {subject?.name ?? p.nodeId}
                      </span>
                      {subject && (
                        <span className="block text-[10px] text-gray-400">
                          {subject.metrics.correct}/{subject.metrics.attempted || subject.metrics.questions} correct
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md',
                        ACCENT[BADGE_ACCENT[badge]].chip,
                      )}
                    >
                      {badge}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </ReportCard>
      </div>

      {/* ── Study plan CTA ─────────────────────────────────────────────────── */}
      <ReportCard className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-indigo-100 dark:border-indigo-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">Your Personalised Study Plan</p>
            <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-0.5">
              A focused plan based on your performance. Build concepts, practise smartly and improve step by step.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/user/study-plan/${attemptId}`)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-semibold px-3.5 py-2 hover:from-indigo-700 hover:to-purple-700 transition-all whitespace-nowrap"
          >
            View Study Plan <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </ReportCard>
    </div>
  );
}
