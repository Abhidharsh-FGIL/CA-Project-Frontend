import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ClipboardList, FileText, Loader2, Mail, Phone, Sparkles, Tag, Target, UserX } from 'lucide-react';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { AttemptDetailView } from '@/components/evaluation/EvalAssessmentReport';
import { useAdminHistoryUser } from '@/hooks/use-admin-history';
import { useEvalAssessments } from '@/hooks/use-eval-assessments';
import { placementLine } from '@/lib/assessment-hierarchy';
import { displayTitle } from '@/lib/display-title';
import {
  DASH,
  attemptStatus,
  formatDate,
  formatDateTime,
  formatDuration,
  formatPercent,
  formatScore,
  promoScope,
} from '@/lib/admin-history-format';
import type { HistoryAttempt, HistoryModeFilter } from '@/lib/adminHistoryApi';
import { cn } from '@/lib/utils';

const TABS: Array<{ value: HistoryModeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'mock', label: 'Mock' },
  { value: 'practice', label: 'Practice' },
];

const STATUS_TONE = {
  ok: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  live: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900',
} as const;

/**
 * Admin → one user's history as its own page: the address says which user, and an attempt opened from the table
 * is kept there too (`?assessment=…&attempt=…`), so Back closes it.
 */
export default function AdminUserHistoryPage() {
  const { userId } = useParams<{ userId: string }>();
  const [params, setParams] = useSearchParams();
  const openAssessment = params.get('assessment');
  const openAttempt = params.get('attempt');

  if (openAssessment && openAttempt) {
    return (
      <GenVerseShell>
        <div className="pb-6">
          <AttemptDetailView assessmentId={openAssessment} attemptId={openAttempt} studentLabel="" onBack={() => setParams({})} />
        </div>
      </GenVerseShell>
    );
  }

  return (
    <GenVerseShell>
      <UserHistoryDetail
        userId={userId}
        onOpenAttempt={a => setParams({ assessment: a.test_id, attempt: a.attempt_id })}
      />
    </GenVerseShell>
  );
}

/**
 * One user's details, the tests they attended and the promo codes they used.
 *
 * Shared by the admin History page and the Evaluation Hub's History tab, so both read the same server figures.
 * `onBack` replaces the "All users" link where the caller keeps the list itself; `onOpenAttempt` is what a Report
 * button does, for an assessment attempt.
 */
export function UserHistoryDetail({
  userId,
  onBack,
  onOpenAttempt,
}: {
  userId: string | undefined;
  onBack?: () => void;
  onOpenAttempt: (attempt: HistoryAttempt) => void;
}) {
  const [mode, setMode] = useState<HistoryModeFilter>('all');
  const { data, isLoading, isFetching, isError, error } = useAdminHistoryUser(userId, mode);
  const notFound = isError && (error as { status?: number })?.status === 404;
  // The server names each test but not where it sits; an assessment's own tag says its group, subject and unit.
  const { data: assessments } = useEvalAssessments();
  const placeOf = useMemo(() => {
    const byId = new Map<string, string | null>();
    for (const row of (assessments ?? []) as Array<Record<string, any>>) byId.set(String(row.id), placementLine(row));
    return (id: string) => byId.get(id) ?? null;
  }, [assessments]);

  return (
      <div className="space-y-4 pb-6">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All users
          </button>
        ) : (
          <Link
            to="/org/history"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> All users
          </Link>
        )}

        {notFound ? (
          <Message icon={<UserX className="w-10 h-10" />} title="User not found" />
        ) : isError ? (
          <Message icon={<UserX className="w-10 h-10" />} title="Could not load this user’s history" detail={(error as Error)?.message} />
        ) : isLoading || !data ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-900 border-t-brand-600 dark:border-t-blue-400 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Header card */}
            <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {(data.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate">{data.name}</h1>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" aria-hidden />{data.email}</span>
                      <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" aria-hidden />{data.phone || DASH}</span>
                      <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" aria-hidden /><span className="capitalize">{data.subscription_tier || DASH}</span> plan</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" aria-hidden />Joined {formatDate(data.joined_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2.5">
                  <Stat icon={<ClipboardList className="w-4 h-4" />} label="Mock attended" value={data.mock_attempts} tone="violet" />
                  <Stat icon={<Target className="w-4 h-4" />} label="Practice attended" value={data.practice_attempts} tone="emerald" />
                </div>
              </div>
            </section>

            {/* Tests attended */}
            <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Tests attended <span className="font-semibold text-gray-400">({data.attempts.length})</span>
                </h2>
                <div className="flex items-center gap-2">
                  {isFetching && <Loader2 className="w-4 h-4 animate-spin text-gray-400" aria-hidden />}
                  <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5" role="tablist" aria-label="Test type">
                    {TABS.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        role="tab"
                        aria-selected={mode === t.value}
                        onClick={() => setMode(t.value)}
                        className={cn(
                          'rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                          mode === t.value
                            ? 'bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-300 shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {data.attempts.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  {mode === 'all' ? 'This user has not attended any test.' : `No ${mode} tests attended.`}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                        <th className="px-4 py-2.5">Test name</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5">Date &amp; time</th>
                        <th className="px-4 py-2.5">Time taken</th>
                        <th className="px-4 py-2.5 text-right">Score</th>
                        <th className="px-4 py-2.5 text-right">%</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5 text-right">Report</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.attempts.map(a => (
                        <AttemptRow
                          key={a.attempt_id}
                          a={a}
                          place={placeOf(a.test_id)}
                          onOpen={() => onOpenAttempt(a)}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Promo codes */}
            <section className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 px-4 py-3">
                <Tag className="w-4 h-4 text-amber-600" aria-hidden />
                <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  Promo codes used <span className="font-semibold text-gray-400">({data.promo_redemptions.length})</span>
                </h2>
              </div>
              {data.promo_redemptions.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400">No promo codes used.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800/60">
                      <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                        <th className="px-4 py-2.5">Code</th>
                        <th className="px-4 py-2.5">Type</th>
                        <th className="px-4 py-2.5 text-right">Discount</th>
                        <th className="px-4 py-2.5">Used on</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.promo_redemptions.map((p, i) => (
                        <tr key={`${p.code}-${p.redeemed_at}-${i}`} className="border-t border-gray-50 dark:border-gray-800">
                          <td className="px-4 py-2.5">
                            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-bold tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900">
                              {p.code}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200">{promoScope(p.scope)}</td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums text-gray-800 dark:text-gray-100">
                            {p.discount_pct == null ? DASH : `${p.discount_pct}%`}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatDateTime(p.redeemed_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
  );
}

function AttemptRow({ a, place, onOpen }: { a: HistoryAttempt; place: string | null; onOpen: () => void }) {
  const status = attemptStatus(a.status);
  // Only an assessment attempt has an admin report to open; an in-progress one has none yet.
  const canOpen = a.source === 'assessment' && a.status !== 'in_progress';
  return (
    <tr className="border-t border-gray-50 dark:border-gray-800 hover:bg-orange-50/30 dark:hover:bg-gray-800/30">
      <td className="px-4 py-2.5 text-[13px] font-semibold text-gray-900 dark:text-gray-100 max-w-[320px]">
        <span className="line-clamp-2">{displayTitle(a.test_name) || DASH}</span>
        {place && <span className="mt-0.5 block truncate text-[11px] font-medium text-gray-500 dark:text-gray-400">{place}</span>}
      </td>
      <td className="px-4 py-2.5">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset capitalize',
            a.mode === 'mock'
              ? 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900'
              : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
          )}
        >
          {a.mode}
        </span>
      </td>
      <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatDateTime(a.start_time)}</td>
      <td className="px-4 py-2.5 text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatDuration(a.time_taken_seconds)}</td>
      <td className="px-4 py-2.5 text-right text-[13px] font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatScore(a.score)}</td>
      <td className="px-4 py-2.5 text-right text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-200">{formatPercent(a.percentage)}</td>
      <td className="px-4 py-2.5">
        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap', STATUS_TONE[status.tone])}>
          {status.label}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        {canOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-200 hover:bg-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:ring-blue-900"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden /> Report
          </button>
        ) : (
          <span className="text-gray-300 dark:text-gray-600">{DASH}</span>
        )}
      </td>
    </tr>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: 'violet' | 'emerald' }) {
  return (
    <div
      className={cn(
        'min-w-[8.5rem] rounded-xl px-3.5 py-2.5',
        tone === 'violet'
          ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-300'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300',
      )}
    >
      <p className="flex items-center gap-1.5 text-[11px] font-semibold">{icon}{label}</p>
      <p className="mt-0.5 text-2xl font-extrabold tabular-nums leading-none">{value}</p>
    </div>
  );
}

function Message({ icon, title, detail }: { icon: React.ReactNode; title: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-16 text-center text-gray-400">
      <div className="mx-auto mb-3 flex justify-center">{icon}</div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</p>
      {detail && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{detail}</p>}
    </div>
  );
}
