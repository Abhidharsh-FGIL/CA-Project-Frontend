/**
 * The personalised study plan — reference screens 10, 11 and 12.
 *
 * Real content as of the priorities/topic-diagnoses/weekly-plan redesign: every
 * tab prefers `analysis.priorities` + `.topic_diagnoses` + `.weekly_plan` +
 * `.daily_plan` (all backend-generated from this attempt's own validated
 * priorities — see the backend LLM architecture overhaul plan and its later
 * priority-engine/study-plan redesign) and falls back to the older
 * deterministic `StudyPlan` (from `buildStudyPlan`) only while those sections
 * aren't ready yet.
 *
 * No invented study duration: a session's `minutes` is only ever a real
 * number when the student's own availability was configured on the backend
 * (see llm_study_plan.py) — never a fabricated default like the old system's
 * flat 90-minute suggestion.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  Lightbulb,
  Sprout,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ACCENT,
  NotAvailable,
  ReportCard,
  SectionHeader,
  StatTile,
  UnderlineTabs,
  type Accent,
} from '@/components/user/report-ui';
import type { AttemptReportModel } from '@/lib/attempt-report';
import type { DailyBlock, FocusArea, StudyPlan } from '@/lib/study-plan';
import { priorityBadge } from '@/lib/study-plan';
import type {
  AttemptAnalysisPriority,
  AttemptAnalysisResponse,
  AttemptAnalysisTopicDiagnosis,
  DailyPlanTask,
} from '@/lib/userPortalApi';

type PlanTab = 'queue' | 'weekly' | 'daily';

const RANK_ACCENT: Accent[] = ['rose', 'amber', 'indigo', 'sky', 'violet'];

const fmtPct = (v: number | null) => (v == null ? '—' : `${v}%`);

const INTERVENTION_BADGE: Record<AttemptAnalysisPriority['intervention'], { label: string; accent: Accent }> = {
  concept_rebuild: { label: 'Concept Rebuild', accent: 'rose' },
  rule_application: { label: 'Rule Application', accent: 'amber' },
  practice_reinforcement: { label: 'Practice', accent: 'sky' },
  maintenance: { label: 'Maintain', accent: 'emerald' },
  foundation_rebuild: { label: 'Foundation Rebuild', accent: 'rose' },
};

function priorityName(p: AttemptAnalysisPriority): string {
  if (p.level === 'subject_foundation') return `${p.subject ?? p.scope_id} Foundations`;
  return p.subtopic ?? p.topic ?? p.subject ?? p.scope_id;
}

/** Whether any session anywhere in the generated week carries a real
 * `minutes` value — the signal that real availability was configured,
 * since the backend enforces null everywhere when it wasn't (see item 7). */
function hasConfiguredMinutes(analysis: AttemptAnalysisResponse | null | undefined): boolean {
  return !!analysis?.weekly_plan?.week.some(d => d.sessions.some(s => s.minutes != null));
}

export function StudyPlanView({
  plan,
  model,
  analysis,
  onBack,
}: {
  plan: StudyPlan;
  model: AttemptReportModel;
  analysis?: AttemptAnalysisResponse | null;
  onBack?: () => void;
}) {
  const [tab, setTab] = useState<PlanTab>('queue');
  const livePriorities = analysis?.priorities;
  // Shape, not just presence — see ReportOverview.tsx's priorityRows for
  // why: a backend still running the pre-redesign code returns priorities
  // in the old shape (no `level`, `intervention` a free-text sentence
  // instead of the enum), and reading `.intervention` off those would
  // throw rather than degrade.
  const isLive = !!livePriorities?.length && livePriorities.every(p => p.intervention in INTERVENTION_BADGE);
  // Once the new weekly plan is live, its own minutes fields are the only
  // source of truth (see item 7 — never a fabricated default); while it
  // isn't ready yet, fall back to the deterministic plan's own real flag
  // rather than assuming "not set".
  const minutesConfigured = isLive ? hasConfiguredMinutes(analysis) : plan.constraints.budgetKnown;

  return (
    <div className="space-y-3 sm:space-y-4">
      <ReportCard>
        <SectionHeader
          icon={<Flag className="w-4 h-4" />}
          title="Personalised study plan"
          subtitle={`Based on ${plan.testName}`}
          action={
            onBack && (
              <button
                type="button"
                onClick={onBack}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline whitespace-nowrap"
              >
                Back to report
              </button>
            )
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <StatTile value={fmtPct(plan.baseline.scorePct)} label="Baseline score" hint="From this attempt" />
          <StatTile value={fmtPct(plan.baseline.accuracy)} label="Accuracy" hint="Of questions attempted" />
          {minutesConfigured ? (
            <StatTile
              value={`${plan.constraints.minutesPerDay} min`}
              label="Daily study time"
              hint="Your recorded availability"
              accent="indigo"
            />
          ) : (
            <StatTile value="Not set" label="Study time" hint="Set your availability to size sessions" accent="slate" />
          )}
        </div>

        {!minutesConfigured && (
          <p className="mt-2.5 text-[10px] text-gray-400 dark:text-gray-500">
            No study-time availability is recorded for your account — sessions below describe what to do, not how
            long to spend, until you set it.
          </p>
        )}

        <div className="mt-3">
          <UnderlineTabs<PlanTab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'queue', label: 'Learning Queue' },
              { value: 'weekly', label: '7 Days Plan' },
              { value: 'daily', label: 'Daily Plan' },
            ]}
          />
        </div>
      </ReportCard>

      {tab === 'queue' && <LearningQueue plan={plan} analysis={analysis} />}
      {tab === 'weekly' && <WeeklyPlan plan={plan} analysis={analysis} />}
      {tab === 'daily' && <DailyPlan plan={plan} analysis={analysis} />}
    </div>
  );
}

const BADGE_ACCENT: Record<'Highest' | 'High' | 'Medium', Accent> = {
  Highest: 'rose',
  High: 'amber',
  Medium: 'sky',
};

// ─── Learning Queue (mockup screen 7) ──────────────────────────────────────────

function LiveLearningQueue({
  priorities,
  diagnoses,
}: {
  priorities: AttemptAnalysisPriority[];
  diagnoses: AttemptAnalysisTopicDiagnosis[];
}) {
  const diagnosesById = new Map(diagnoses.map(d => [d.scope_id, d]));

  return (
    <div className="space-y-4">
      <ReportCard>
        <p className="text-lg font-extrabold text-[#1e2a5a] dark:text-gray-100">Your Personalised Study Plan</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">A focused plan based on your performance.</p>
      </ReportCard>

      <ReportCard flush>
        {priorities.map((p, i) => {
          const diagnosis = diagnosesById.get(p.scope_id);
          const badge = INTERVENTION_BADGE[p.intervention];
          return (
            <div
              key={p.scope_id}
              className={cn(
                'flex items-start gap-3 px-4 sm:px-5 py-3.5',
                i > 0 && 'border-t border-gray-100 dark:border-gray-800',
              )}
            >
              <span
                className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full text-white text-[12px] font-bold flex items-center justify-center"
                style={{ background: ACCENT[RANK_ACCENT[i % RANK_ACCENT.length]].hex }}
              >
                {p.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100 truncate">{priorityName(p)}</p>
                <p className="text-[11px] text-gray-400">
                  {p.level === 'subject_foundation'
                    ? `${p.correct}/${p.questions_seen} across multiple tested areas`
                    : `${p.subject ?? ''} · ${p.correct}/${p.questions_seen}`}
                </p>
                {diagnosis && (
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug mt-1">
                    {diagnosis.next_action}
                  </p>
                )}
                {diagnosis && (
                  <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-0.5">
                    Mastery: {diagnosis.mastery_check}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                <span
                  className={cn(
                    'text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap',
                    ACCENT[badge.accent].chip,
                  )}
                >
                  {badge.label}
                </span>
              </div>
            </div>
          );
        })}
      </ReportCard>

      <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-3.5 flex items-center gap-2.5">
        <Sprout className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <p className="text-[12px] text-emerald-800 dark:text-emerald-200">
          This plan adapts automatically as you complete practice and assessments. Keep learning, keep improving!
        </p>
      </div>
    </div>
  );
}

function LearningQueue({
  plan,
  analysis,
}: {
  plan: StudyPlan;
  analysis?: AttemptAnalysisResponse | null;
}) {
  const navigate = useNavigate();

  // Same shape check as the stat-row `isLive` above — this function is also
  // reachable on its own (the tab renders independently), so it cannot
  // assume the caller already validated the shape.
  if (analysis?.priorities?.length && analysis.priorities.every(p => p.intervention in INTERVENTION_BADGE)) {
    return <LiveLearningQueue priorities={analysis.priorities} diagnoses={analysis.topic_diagnoses ?? []} />;
  }

  if (plan.focusAreas.length === 0) {
    return (
      <ReportCard>
        <NotAvailable reason="This attempt did not produce a measured priority, so there is nothing to plan around yet." />
      </ReportCard>
    );
  }

  return (
    <div className="space-y-4">
      <ReportCard>
        <p className="text-lg font-extrabold text-[#1e2a5a] dark:text-gray-100">Your Personalised Study Plan</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">A focused plan to help you improve.</p>
      </ReportCard>

      <ReportCard flush>
        {plan.focusAreas.map((f, i) => {
          const badge = priorityBadge(f.rank);
          return (
            <div
              key={f.subjectId}
              className={cn(
                'flex items-center gap-3 px-4 sm:px-5 py-3.5',
                i > 0 && 'border-t border-gray-100 dark:border-gray-800',
              )}
            >
              <span
                className={cn(
                  'flex-shrink-0 w-7 h-7 rounded-full text-white text-[12px] font-bold flex items-center justify-center',
                )}
                style={{ background: ACCENT[RANK_ACCENT[i] ?? 'slate'].hex }}
              >
                {f.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-[#1e2a5a] dark:text-gray-100 truncate">{f.name}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug truncate">{f.headline}</p>
              </div>
              <span
                className={cn(
                  'flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap',
                  ACCENT[BADGE_ACCENT[badge]].chip,
                )}
              >
                {badge} Priority
              </span>
              <button
                type="button"
                onClick={() => navigate(`/user/report/${plan.sourceAttemptId}/subjects/${f.subjectId}`)}
                className="flex-shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg px-3 py-1.5 hover:from-indigo-700 hover:to-purple-700 whitespace-nowrap"
              >
                Open <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </ReportCard>

      {plan.queued.length > 0 && (
        <p className="text-[11px] text-gray-400 dark:text-gray-500">Queued for a later cycle: {plan.queued.join(', ')}.</p>
      )}

      <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-3.5 flex items-center gap-2.5">
        <Sprout className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <p className="text-[12px] text-emerald-800 dark:text-emerald-200">
          This plan adapts automatically as you complete practice and assessments. Keep learning, keep improving!
        </p>
      </div>
    </div>
  );
}

// ─── 7 Days Plan (mockup screen 8) ─────────────────────────────────────────────

function WeeklyPlan({ plan, analysis }: { plan: StudyPlan; analysis?: AttemptAnalysisResponse | null }) {
  const [week, setWeek] = useState(1);
  const liveWeek = analysis?.weekly_plan?.week;

  if (liveWeek) {
    return (
      <div className="space-y-4">
        <ReportCard>
          <div className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </span>
            <div>
              <p className="text-base font-extrabold text-[#1e2a5a] dark:text-gray-100">
                7 Days Plan
              </p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                Built only from your own validated learning priorities.
              </p>
            </div>
          </div>
        </ReportCard>

        {liveWeek.map((day, di) => (
          <ReportCard key={day.day} flush={day.sessions.length > 0}>
            <p className={cn('text-[12px] font-bold text-[#1e2a5a] dark:text-gray-100', day.sessions.length > 0 ? 'px-4 sm:px-5 pt-3.5' : '')}>
              Day {di + 1}
            </p>
            {day.sessions.length === 0 ? (
              <p className="text-[11px] text-gray-400 mt-1">Rest / catch-up day.</p>
            ) : (
              day.sessions.map((s, si) => (
                <div
                  key={`${s.priority_id}-${si}`}
                  className={cn('px-4 sm:px-5 py-3', si === 0 ? 'mt-1' : 'border-t border-gray-100 dark:border-gray-800')}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100 truncate">
                      {[s.subject, s.topic, s.subtopic].filter(Boolean).join(' → ')}
                    </p>
                    {s.minutes != null && (
                      <span className="flex-shrink-0 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg px-2.5 py-1 whitespace-nowrap">
                        ~{s.minutes} min
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-snug mt-1">{s.learning_activity}</p>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{s.practice_activity}</p>
                  <p className="text-[10px] text-indigo-500 dark:text-indigo-400 mt-1">Checkpoint: {s.checkpoint}</p>
                </div>
              ))
            )}
          </ReportCard>
        ))}

        <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-3.5 flex items-start gap-2.5">
          <Lightbulb className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
            Adjust the plan based on your progress and time availability.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReportCard>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </span>
            <div>
              <p className="text-base font-extrabold text-[#1e2a5a] dark:text-gray-100">
                7 Days Plan — Week {week}
              </p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                A realistic plan based on your learning queue.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setWeek(w => Math.max(1, w - 1))}
              disabled={week === 1}
              className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setWeek(w => Math.min(plan.weeks.length, w + 1))}
              disabled={week >= plan.weeks.length}
              className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </ReportCard>

      <ReportCard flush>
        {plan.weekly.map((r, i) => (
          <div
            key={r.day}
            className={cn(
              'flex items-center gap-3 px-4 sm:px-5 py-3',
              i > 0 && 'border-t border-gray-100 dark:border-gray-800',
            )}
          >
            <div className="flex-shrink-0 w-14 text-center">
              <p className="text-[11px] font-bold text-[#1e2a5a] dark:text-gray-100">Day {i + 1}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-bold text-gray-900 dark:text-gray-100 truncate">{r.focus}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{r.task}</p>
            </div>
            <span className="flex-shrink-0 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg px-2.5 py-1 whitespace-nowrap">
              ~{r.minutes} min
            </span>
          </div>
        ))}
      </ReportCard>

      <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-3.5 flex items-start gap-2.5">
        <Lightbulb className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
          Adjust the plan based on your progress and time availability.
          {plan.overBudget && (
            <span className="text-amber-700 dark:text-amber-400">
              {' '}
              This week asks for more than {plan.constraints.minutesPerDay} minutes a day across{' '}
              {plan.constraints.daysPerWeek} days — trim the lowest priority if that is not realistic.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Daily Plan (mockup screen 9) ──────────────────────────────────────────────

const TASK_TITLE: Record<DailyPlanTask['type'], string> = {
  learn: 'Learn',
  compare: 'Compare',
  practice: 'Practice',
  checkpoint: 'Mastery Check',
};

const TASK_ACCENT: Record<DailyPlanTask['type'], Accent> = {
  learn: 'emerald',
  compare: 'sky',
  practice: 'indigo',
  checkpoint: 'violet',
};

/** A short, mockup-matching label for each block kind — the real content is
 * `DailyBlock.label` underneath; this is just the section it falls into. */
const KIND_TITLE: Record<DailyBlock['kind'], string> = {
  concept: 'Learn',
  notes: 'Understand',
  practice: 'Practice',
  review: 'Review',
  quiz: 'Quick Quiz',
};

const KIND_ACCENT: Record<DailyBlock['kind'], Accent> = {
  concept: 'emerald',
  notes: 'sky',
  practice: 'indigo',
  review: 'emerald',
  quiz: 'violet',
};

function todayLabel(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
}

function DailyPlan({ plan, analysis }: { plan: StudyPlan; analysis?: AttemptAnalysisResponse | null }) {
  const navigate = useNavigate();
  const liveEntries = analysis?.daily_plan;

  if (liveEntries && liveEntries.length > 0) {
    const totalMinutes = liveEntries.reduce((n, e) => n + (e.minutes ?? 0), 0);
    const anyMinutes = liveEntries.some(e => e.minutes != null);

    return (
      <div className="space-y-4">
        {liveEntries.map(entry => (
          <ReportCard key={entry.priority_id}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-start gap-2.5">
                <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-base font-extrabold text-[#1e2a5a] dark:text-gray-100">{entry.focus}</p>
                  <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{entry.objective}</p>
                </div>
              </div>
              {entry.minutes != null && (
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg px-2.5 py-1.5 whitespace-nowrap">
                  ~{entry.minutes} min
                </span>
              )}
            </div>

            <ol className="space-y-3">
              {entry.tasks.map((t, i) => (
                <li key={t.type} className="flex items-start gap-3">
                  <span
                    className="flex-shrink-0 w-7 h-7 rounded-full text-white text-[12px] font-bold flex items-center justify-center"
                    style={{ background: ACCENT[TASK_ACCENT[t.type]].hex }}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">{TASK_TITLE[t.type]}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{t.instruction}</p>
                  </div>
                </li>
              ))}
            </ol>
          </ReportCard>
        ))}

        <ReportCard>
          {anyMinutes && (
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-3">Estimated time today: ~{totalMinutes} min</p>
          )}
          <button
            type="button"
            onClick={() => navigate('/user/practice')}
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[13px] font-semibold px-3.5 py-2.5 hover:from-indigo-700 hover:to-purple-700 transition-all"
          >
            Start Practice <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </ReportCard>

        <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-3.5 flex items-center gap-2.5">
          <Sprout className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <p className="text-[12px] text-emerald-800 dark:text-emerald-200">
            Complete today's tasks to strengthen your concepts.
          </p>
        </div>
      </div>
    );
  }

  const top: FocusArea | undefined = plan.focusAreas[0];

  if (plan.daily.length === 0 || !top) {
    return (
      <ReportCard>
        <NotAvailable reason="A daily plan needs at least one measured priority from the attempt." />
      </ReportCard>
    );
  }

  const total = plan.daily.reduce((n, b) => n + b.minutes, 0);

  return (
    <div className="space-y-4">
      <ReportCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarDays className="w-4 h-4" />
            </span>
            <div>
              <p className="text-base font-extrabold text-[#1e2a5a] dark:text-gray-100">Today's Plan</p>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">{todayLabel()}</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg px-2.5 py-1.5 whitespace-nowrap">
            Estimated time ~{total} min
          </span>
        </div>
      </ReportCard>

      <ReportCard>
        <ol className="space-y-3.5">
          {plan.daily.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="flex-shrink-0 w-7 h-7 rounded-full text-white text-[12px] font-bold flex items-center justify-center"
                style={{ background: ACCENT[KIND_ACCENT[b.kind]].hex }}
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-900 dark:text-gray-100">
                  {KIND_TITLE[b.kind]} ({b.minutes} min)
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{b.label}</p>
              </div>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={() => navigate('/user/practice')}
          className="mt-4 w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-[13px] font-semibold px-3.5 py-2.5 hover:from-indigo-700 hover:to-purple-700 transition-all"
        >
          Start Practice <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </ReportCard>

      <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900 p-3.5 flex items-center gap-2.5">
        <Sprout className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
        <p className="text-[12px] text-emerald-800 dark:text-emerald-200">
          Complete today's tasks to strengthen your concepts.
        </p>
      </div>
    </div>
  );
}
