import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Loader2,
  RotateCcw,
  Search,
  Target,
} from 'lucide-react';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { useAdminAttemptsReport } from '@/hooks/use-admin-attempts-report';
import {
  EXAM_GROUP_OPTIONS,
  EXPORT_LIMIT,
  dateRangeBackwards,
  downloadAttemptsReport,
  examGroupLabel,
  hasFilters,
  type AttemptReportFilters,
  type AttemptReportRow,
} from '@/lib/adminReportsApi';
import { cn } from '@/lib/utils';

const DASH = '—';
const PAGE_SIZES = [25, 50, 100, 200];

/** The search box waits for a pause in typing, so each keystroke is not a request. */
function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const FIELD =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:ring-brand-700';

const STATUS: Record<string, { label: string; cls: string }> = {
  submitted: {
    label: 'Submitted',
    cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
  },
  timed_out: {
    label: 'Timed out',
    cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  },
  in_progress: {
    label: 'In progress',
    cls: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900',
  },
};

/** "86.5%" — a percentage to one decimal place, without a trailing ".0". */
const pct = (n: number | null | undefined) => (n == null ? DASH : `${Math.round(n * 10) / 10}%`);
const num = (n: number | null | undefined) => (n == null ? DASH : String(Math.round(n * 100) / 100));
const minutes = (n: number | null | undefined) => (n == null ? DASH : `${Math.round(n * 10) / 10} min`);
const count = (n: number) => n.toLocaleString('en-IN');

/**
 * Admin → Attempts Report: every test attempt, mock and practice, with the student's details — filter it, read it
 * here, and download exactly what the filters match as an Excel sheet.
 */
export default function AdminAttemptsReportPage() {
  const [filters, setFilters] = useState<AttemptReportFilters>({});
  const [text, setText] = useState('');
  const search = useDebounced(text.trim());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [downloading, setDownloading] = useState(false);

  const active: AttemptReportFilters = { ...filters, search };
  const backwards = dateRangeBackwards(active);

  // A change in what is asked for starts again from the first page.
  useEffect(() => setPage(1), [filters, search, limit]);

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminAttemptsReport(active, page, limit);
  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, data?.pages ?? Math.ceil(total / limit));
  const tooBig = total > EXPORT_LIMIT;
  const canDownload = !backwards && !downloading && !isLoading && total > 0 && !tooBig;

  const set = <K extends keyof AttemptReportFilters>(key: K, value: AttemptReportFilters[K]) =>
    setFilters(f => ({ ...f, [key]: value }));
  const clear = () => {
    setFilters({});
    setText('');
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadAttemptsReport(active);
      toast.success('Report downloaded.');
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not download the report.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <GenVerseShell>
      <PageHeader
        title="Attempts Report"
        description="Every test attempt, mock and practice, with the student's details. Filter it, then download it as Excel."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Attempts Report' }]}
        actions={
          <button
            type="button"
            onClick={download}
            disabled={!canDownload}
            title={tooBig ? `Too many rows to download (over ${count(EXPORT_LIMIT)}). Narrow the filters.` : 'Download what the filters match as an Excel sheet'}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-400 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-orange-200/60 transition hover:from-brand-600 hover:to-brand-500 disabled:cursor-not-allowed disabled:opacity-50 dark:shadow-none"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? 'Preparing…' : 'Download Excel'}
          </button>
        }
      />

      <div className="space-y-4 pb-6">
        {/* Filters */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Field label="From date">
              <input
                type="date"
                value={filters.date_from ?? ''}
                max={filters.date_to || undefined}
                onChange={e => set('date_from', e.target.value)}
                className={FIELD}
              />
            </Field>
            <Field label="To date">
              <input
                type="date"
                value={filters.date_to ?? ''}
                min={filters.date_from || undefined}
                onChange={e => set('date_to', e.target.value)}
                className={FIELD}
              />
            </Field>
            <Field label="Test type">
              <select value={filters.test_type ?? ''} onChange={e => set('test_type', e.target.value as AttemptReportFilters['test_type'])} className={FIELD}>
                <option value="">All</option>
                <option value="mock">Mock</option>
                <option value="practice">Practice</option>
              </select>
            </Field>
            <Field label="Exam group">
              <select value={filters.exam_group ?? ''} onChange={e => set('exam_group', e.target.value as AttemptReportFilters['exam_group'])} className={FIELD}>
                <option value="">All</option>
                {EXAM_GROUP_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Search" className="col-span-2 lg:col-span-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Name, email or mobile"
                  aria-label="Search by name, email or mobile"
                  className={cn(FIELD, 'pl-9')}
                />
                {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" aria-hidden />}
              </div>
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <p className="tabular-nums">
              {backwards ? (
                <span className="font-semibold text-red-600 dark:text-red-400">“From” is after “To”. Change the dates.</span>
              ) : data ? (
                <>
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{count(total)}</span> attempt{total === 1 ? '' : 's'}
                  {hasFilters(active) ? ' match these filters' : ' in all'} · newest first
                </>
              ) : (
                'Loading…'
              )}
            </p>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5">
                Rows per page
                <select
                  value={limit}
                  onChange={e => setLimit(Number(e.target.value))}
                  className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800"
                >
                  {PAGE_SIZES.map(n => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {hasFilters(active) && (
                <button type="button" onClick={clear} className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline dark:text-orange-300">
                  <RotateCcw className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>
          </div>

          {tooBig && (
            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              That is more than {count(EXPORT_LIMIT)} rows, which is too many for one Excel sheet. Narrow the dates, exam group or test type, then download.
            </p>
          )}
        </div>

        {/* Table */}
        {isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/20">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Could not load the report</p>
            <p className="mt-1 text-xs text-red-600/80 dark:text-red-300/70">{(error as Error)?.message}</p>
            <button type="button" onClick={() => refetch()} className="mt-3 text-xs font-semibold text-red-700 underline dark:text-red-300">
              Try again
            </button>
          </div>
        ) : backwards ? null : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-brand-600 dark:border-blue-900 dark:border-t-blue-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
            <FileSpreadsheet className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {hasFilters(active) ? 'No attempts match these filters.' : 'No attempts yet.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/60">
                    <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-3">Student</th>
                      <th className="px-3 py-3">Exam group</th>
                      <th className="px-3 py-3" title="This student's attempts in this exam group, all time">
                        Taken so far
                      </th>
                      <th className="px-3 py-3">Test</th>
                      <th className="px-3 py-3">Score</th>
                      <th className="px-3 py-3">Started (IST)</th>
                      <th className="px-3 py-3">Submitted (IST)</th>
                      <th className="px-3 py-3">Time</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.attempt_id} className="border-b border-gray-50 align-top last:border-0 hover:bg-orange-50/40 dark:border-gray-800 dark:hover:bg-gray-800/40">
                        <td className="max-w-[240px] px-4 py-3">
                          <Link to={`/org/history/${r.user_id}`} className="text-sm font-semibold text-gray-900 hover:text-orange-700 hover:underline dark:text-gray-100">
                            {r.name || DASH}
                          </Link>
                          <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{r.email || DASH}</p>
                          <p className="text-[11px] text-gray-500 tabular-nums dark:text-gray-400">{r.mobile || DASH}</p>
                        </td>
                        <td className="px-3 py-3">
                          <GroupChip group={r.exam_group} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <Tally n={r.total_mock} tone="mock" />
                            <Tally n={r.total_practice} tone="practice" />
                          </div>
                        </td>
                        <td className="max-w-[260px] px-3 py-3">
                          <TypeChip type={r.test_type} />
                          <p className="mt-1 line-clamp-2 text-xs leading-snug text-gray-700 dark:text-gray-200" title={r.test_name ?? undefined}>
                            {r.test_name || DASH}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                          <ScoreCell row={r} />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-gray-700 dark:text-gray-200">{r.started_ist || DASH}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-gray-700 dark:text-gray-200">{r.submitted_ist || DASH}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs tabular-nums text-gray-700 dark:text-gray-200">{minutes(r.time_taken_minutes)}</td>
                        <td className="px-3 py-3">
                          <StatusChip status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="space-y-2.5 md:hidden">
              {rows.map(r => (
                <div key={r.attempt_id} className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/org/history/${r.user_id}`} className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {r.name || DASH}
                      </Link>
                      <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{r.email || DASH}</p>
                      <p className="text-[11px] text-gray-500 tabular-nums dark:text-gray-400">{r.mobile || DASH}</p>
                    </div>
                    <StatusChip status={r.status} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <GroupChip group={r.exam_group} />
                    <TypeChip type={r.test_type} />
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Taken so far</span>
                    <Tally n={r.total_mock} tone="mock" />
                    <Tally n={r.total_practice} tone="practice" />
                  </div>
                  <p className="mt-2 text-xs leading-snug text-gray-700 dark:text-gray-200">{r.test_name || DASH}</p>
                  <div className="mt-2 flex items-baseline justify-between gap-3">
                    <ScoreCell row={r} />
                    <span className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">{minutes(r.time_taken_minutes)}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                    {r.started_ist || DASH} → {r.submitted_ist || DASH}
                  </p>
                </div>
              ))}
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                  Page {data?.page ?? page} of {count(pages)}
                </p>
                <div className="flex items-center gap-1.5">
                  <PageButton disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} label="Previous page">
                    <ChevronLeft className="h-4 w-4" />
                  </PageButton>
                  <PageButton disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))} label="Next page">
                    <ChevronRight className="h-4 w-4" />
                  </PageButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </GenVerseShell>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function GroupChip({ group }: { group: string }) {
  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-700">
      {examGroupLabel(group)}
    </span>
  );
}

function TypeChip({ type }: { type: string }) {
  const mock = type === 'mock';
  return (
    <span
      className={cn(
        'inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
        mock
          ? 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900'
          : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
      )}
    >
      {mock ? 'Mock' : type === 'practice' ? 'Practice' : type || DASH}
    </span>
  );
}

/** How many mocks or practice tests this student has taken in the exam group — all time. */
function Tally({ n, tone }: { n: number; tone: 'mock' | 'practice' }) {
  const Icon = tone === 'mock' ? ClipboardList : Target;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset',
        n === 0
          ? 'bg-gray-50 text-gray-400 ring-gray-200 dark:bg-gray-800 dark:text-gray-500 dark:ring-gray-700'
          : tone === 'mock'
            ? 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900'
            : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {tone === 'mock' ? 'Mock' : 'Practice'} {n}
    </span>
  );
}

function ScoreCell({ row }: { row: AttemptReportRow }) {
  if (row.score == null) return <span className="text-gray-300 dark:text-gray-600">{DASH}</span>;
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{pct(row.percentage)}</span>
      <span className="text-[11px] text-gray-500 dark:text-gray-400">
        {num(row.score)} / {num(row.max_score)}
      </span>
    </span>
  );
}

function StatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status || DASH, cls: 'bg-gray-50 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700' };
  return (
    <span className={cn('inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset', s.cls)}>{s.label}</span>
  );
}

function PageButton({ disabled, onClick, label, children }: { disabled: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  );
}
