import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ClipboardList, Eye, FileText, History, Loader2, Search, Target, Users } from 'lucide-react';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { EvalAssessmentReport } from '@/components/evaluation/EvalAssessmentReport';
import { EvalReportsList } from '@/components/evaluation/EvalReportsList';
import { useAdminHistoryUsers } from '@/hooks/use-admin-history';
import { DASH, formatDate, formatDateTime } from '@/lib/admin-history-format';
import type { HistorySource, HistoryUser } from '@/lib/adminHistoryApi';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

/** The search box waits for a pause in typing, so each keystroke is not a request. */
function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type HistoryView = 'user' | 'assessment';

const VIEWS: Array<{ value: HistoryView; label: string; icon: typeof Users }> = [
  { value: 'user', label: 'By user', icon: Users },
  { value: 'assessment', label: 'By assessment', icon: FileText },
];

/**
 * Admin → History, read two ways: by user (who took what, and the promo codes they used) and by
 * assessment (who took each assessment, and how they did). The choice, and an assessment opened in it,
 * live in the address, so Back returns to where you were and a link opens the same view.
 */
export default function AdminHistoryPage() {
  const [params, setParams] = useSearchParams();
  const view: HistoryView = params.get('view') === 'assessment' ? 'assessment' : 'user';
  const assessmentId = view === 'assessment' ? params.get('assessment') : null;

  const setView = (next: HistoryView) => setParams(next === 'user' ? {} : { view: next });
  const openAssessment = (id: string) => setParams({ view: 'assessment', assessment: id });
  const closeAssessment = () => setParams({ view: 'assessment' });

  return (
    <GenVerseShell>
      <PageHeader
        title="History"
        description={
          view === 'user'
            ? 'Which tests each user has attended, and the promo codes they used.'
            : 'Who took each assessment, and how they did.'
        }
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'History' }]}
        actions={
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-0.5" role="tablist" aria-label="How to read history">
            {VIEWS.map(v => (
              <button
                key={v.value}
                type="button"
                role="tab"
                aria-selected={view === v.value}
                onClick={() => setView(v.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors',
                  view === v.value
                    ? 'bg-white dark:bg-gray-900 text-orange-700 dark:text-orange-300 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200',
                )}
              >
                <v.icon className="w-3.5 h-3.5" aria-hidden />
                {v.label}
              </button>
            ))}
          </div>
        }
      />

      {view === 'user' ? (
        <UserHistoryList />
      ) : assessmentId ? (
        <EvalAssessmentReport assessmentId={assessmentId} onBack={closeAssessment} />
      ) : (
        <EvalReportsList onViewReport={openAssessment} />
      )}
    </GenVerseShell>
  );
}

/**
 * Everyone, most recent test-taker first, with what they attended and the promo codes they used.
 *
 * `onOpen` says what choosing someone does; by default it goes to that person's own page.
 */
export function UserHistoryList({
  onOpen,
  source,
  hidePromos = false,
  showPlan = false,
}: {
  onOpen?: (user: HistoryUser) => void;
  source?: HistorySource;
  /** An institute's view leaves out the promo codes a student used. */
  hidePromos?: boolean;
  /** Adds each student's plan and when it ends. */
  showPlan?: boolean;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim());
  const [page, setPage] = useState(1);

  // A new search starts from the first page.
  useEffect(() => setPage(1), [search]);

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminHistoryUsers({ search, page, limit: PAGE_SIZE }, source);
  const users = data?.items ?? [];
  const pages = Math.max(1, data?.pages ?? 1);
  const open = (u: HistoryUser) => (onOpen ? onOpen(u) : navigate(`/org/history/${u.user_id}`));

  return (
      <div className="space-y-4 pb-6">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name or email…"
              aria-label="Search users"
              className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-brand-700"
            />
            {isFetching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" aria-hidden />}
          </div>
          {data && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              {data.total.toLocaleString('en-IN')} user{data.total === 1 ? '' : 's'}
              {search && ` matching “${search}”`} · most recent test first
            </p>
          )}
        </div>

        {isError ? (
          <div className="rounded-2xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/20 p-6 text-center">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Could not load user history</p>
            <p className="mt-1 text-xs text-red-600/80 dark:text-red-300/70">{(error as Error)?.message}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 text-xs font-semibold text-red-700 dark:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-900 border-t-brand-600 dark:border-t-blue-400 rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 py-16 text-center">
            <History className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {search ? 'No users match your search.' : 'No users yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-gray-100 dark:border-gray-800">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Email</th>
                      {showPlan && <th className="px-4 py-3">Plan</th>}
                      {showPlan && <th className="px-4 py-3">Plan expires</th>}
                      {showPlan && <th className="px-4 py-3">Joined</th>}
                      <th className="px-4 py-3 text-center">Mock attended</th>
                      <th className="px-4 py-3 text-center">Practice attended</th>
                      <th className="px-4 py-3">Last attempt</th>
                      {!hidePromos && <th className="px-4 py-3">Promo codes used</th>}
                      <th className="px-4 py-3 text-right">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr
                        key={u.user_id}
                        onClick={() => open(u)}
                        className="border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-orange-50/40 dark:hover:bg-gray-800/40 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.name}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 max-w-[240px] truncate">{u.email}</td>
                        {showPlan && <td className="px-4 py-3"><PlanChip tier={u.subscription_tier} period={u.subscription_period} /></td>}
                        {showPlan && <td className="px-4 py-3 whitespace-nowrap"><PlanExpiry tier={u.subscription_tier} expiry={u.subscription_expiry} /></td>}
                        {showPlan && <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-700 dark:text-gray-200">{u.joined_at ? formatDate(u.joined_at) : DASH}</td>}
                        <td className="px-4 py-3 text-center"><Count n={showPlan ? u.mock_used_this_plan ?? u.mock_attempts : u.mock_attempts} tone="mock" available={showPlan ? u.mock_available : undefined} /></td>
                        <td className="px-4 py-3 text-center"><Count n={showPlan ? u.practice_used_this_plan ?? u.practice_attempts : u.practice_attempts} tone="practice" available={showPlan ? u.practice_available : undefined} /></td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap">{formatDateTime(u.last_attempt_at)}</td>
                        {!hidePromos && <td className="px-4 py-3"><Promos codes={u.promo_codes_used} /></td>}
                        <td className="px-4 py-3 text-right">
                          <ViewButton onClick={() => open(u)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="md:hidden space-y-2.5">
              {users.map(u => (
                <button
                  key={u.user_id}
                  type="button"
                  onClick={() => open(u)}
                  className="w-full text-left rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-3.5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{u.name}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0 mt-1" />
                  </div>
                  {showPlan && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                      <PlanChip tier={u.subscription_tier} period={u.subscription_period} />
                      <PlanExpiry tier={u.subscription_tier} expiry={u.subscription_expiry} />
                    </div>
                  )}
                  <div className="mt-2.5 flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1.5">Mock <Count n={showPlan ? u.mock_used_this_plan ?? u.mock_attempts : u.mock_attempts} tone="mock" available={showPlan ? u.mock_available : undefined} /></span>
                    <span className="inline-flex items-center gap-1.5">Practice <Count n={showPlan ? u.practice_used_this_plan ?? u.practice_attempts : u.practice_attempts} tone="practice" available={showPlan ? u.practice_available : undefined} /></span>
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Last attempt: {formatDateTime(u.last_attempt_at)}</p>
                  {!hidePromos && u.promo_codes_used.length > 0 && <div className="mt-2"><Promos codes={u.promo_codes_used} /></div>}
                </button>
              ))}
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                  Page {data?.page ?? page} of {pages}
                </p>
                <div className="flex items-center gap-1.5">
                  <PageButton disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} label="Previous page">
                    <ChevronLeft className="w-4 h-4" />
                  </PageButton>
                  <PageButton disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))} label="Next page">
                    <ChevronRight className="w-4 h-4" />
                  </PageButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>
  );
}

/** The plan a student is on, as a small chip: free is quiet, a paid plan is not. */
export function PlanChip({ tier, period }: { tier: string | null | undefined; period?: string | null }) {
  const name = (tier || 'free').toLowerCase();
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset',
        name === 'free'
          ? 'bg-gray-50 text-gray-500 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700'
          : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900',
      )}
    >
      {name}
      {name !== 'free' && period && <span className="font-medium opacity-80"> · {period}</span>}
    </span>
  );
}

/** When the plan ends: a date for a paid plan, a dash for a free one or one with no date, "Expired" once it has passed. */
export function PlanExpiry({ tier, expiry }: { tier: string | null | undefined; expiry: string | null | undefined }) {
  if ((tier || 'free').toLowerCase() === 'free' || !expiry) return <span className="text-gray-300 dark:text-gray-600">{DASH}</span>;
  const ended = Date.parse(expiry) < Date.now();
  return (
    <span className={cn('text-xs', ended ? 'font-semibold text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200')}>
      {formatDate(expiry)}
      {ended && ' · expired'}
    </span>
  );
}

function Count({ n, tone, available }: { n: number; tone: 'mock' | 'practice'; available?: number | null }) {
  const Icon = tone === 'mock' ? ClipboardList : Target;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ring-1 ring-inset',
        n === 0
          ? 'bg-gray-50 text-gray-400 ring-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:ring-gray-700'
          : tone === 'mock'
            ? 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900'
            : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
      )}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {n}
      {available != null && <span className="font-semibold opacity-70">/ {available}</span>}
    </span>
  );
}

/** The codes a person redeemed, or a dash when there are none. */
export function Promos({ codes }: { codes: string[] }) {
  if (codes.length === 0) return <span className="text-gray-300 dark:text-gray-600">{DASH}</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {codes.map(c => (
        <span
          key={c}
          className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

function ViewButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-inset ring-orange-200 hover:bg-orange-100 dark:bg-orange-950/30 dark:text-orange-300 dark:ring-orange-900"
    >
      <Eye className="w-3.5 h-3.5" aria-hidden /> View
    </button>
  );
}

function PageButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  );
}
