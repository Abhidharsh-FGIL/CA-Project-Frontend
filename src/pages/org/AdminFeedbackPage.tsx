import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Download, Loader2, MessageSquareHeart, RotateCcw, Search, Star } from 'lucide-react';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { useAdminFeedback, useAdminFeedbackSummary, useSetFeedbackStatus } from '@/hooks/use-feedback';
import {
  CATEGORY_OPTIONS,
  EXPORT_LIMIT,
  STATUS_OPTIONS,
  categoryLabel,
  downloadFeedback,
  feedbackDateRangeBackwards,
  feedbackHasFilters,
  type AdminFeedbackRow,
  type FeedbackFilters,
  type FeedbackStatus,
} from '@/lib/feedbackApi';
import { cn } from '@/lib/utils';

const DASH = '—';
const PAGE_SIZES = [25, 50, 100];
const count = (n: number) => n.toLocaleString('en-IN');

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

const STATUS_CLS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900',
  reviewed: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900',
  resolved: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900',
};

/** Admin → Feedback: what students have written, who sent it, and where each one stands. */
export default function AdminFeedbackPage() {
  const [filters, setFilters] = useState<FeedbackFilters>({});
  const [text, setText] = useState('');
  const search = useDebounced(text.trim());
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [downloading, setDownloading] = useState(false);

  const active: FeedbackFilters = { ...filters, search };
  const backwards = feedbackDateRangeBackwards(active);
  useEffect(() => setPage(1), [filters, search, limit]);

  const list = useAdminFeedback(active, page, limit);
  const summary = useAdminFeedbackSummary(active);
  const setStatus = useSetFeedbackStatus();
  const rows = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, list.data?.pages ?? Math.ceil(total / limit));
  const tooBig = total > EXPORT_LIMIT;
  const canDownload = !backwards && !downloading && !list.isLoading && total > 0 && !tooBig;

  const set = <K extends keyof FeedbackFilters>(key: K, value: FeedbackFilters[K]) => setFilters(f => ({ ...f, [key]: value }));
  const clear = () => {
    setFilters({});
    setText('');
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadFeedback(active);
      toast.success('Feedback downloaded.');
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : 'Could not download the feedback.');
    } finally {
      setDownloading(false);
    }
  };

  const changeStatus = (row: AdminFeedbackRow, status: FeedbackStatus) => {
    if (status === row.status) return;
    setStatus.mutate(
      { id: row.feedback_id, status },
      { onError: e => toast.error(e instanceof Error && e.message ? e.message : 'Could not change the status.') },
    );
  };

  const s = summary.data;

  return (
    <GenVerseShell>
      <PageHeader
        title="Feedback"
        description="What students have written to us, with who sent it. Mark each one as you deal with it."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Feedback' }]}
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
        {/* Summary */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Tile label="Feedback" value={s ? count(s.total) : DASH} />
          <Tile label="Average rating" value={s?.average_rating != null ? `${Math.round(s.average_rating * 10) / 10} / 5` : DASH} stars={s?.average_rating ?? null} />
          <Tile label="Not read yet" value={s ? count(s.new_count) : DASH} accent />
        </div>
        {s && s.total > 0 && (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <ul className="space-y-1.5">
              {[5, 4, 3, 2, 1].map(n => {
                const c = s.by_rating?.[String(n)] ?? 0;
                return (
                  <li key={n} className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => set('rating', filters.rating === n ? '' : n)}
                      className={cn('flex w-10 flex-shrink-0 items-center gap-1 font-semibold tabular-nums hover:text-orange-600', filters.rating === n ? 'text-orange-600' : 'text-gray-600 dark:text-gray-300')}
                      title={`Show only ${n}-star feedback`}
                    >
                      {n} <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    </button>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${(c / s.total) * 100}%` }} />
                    </div>
                    <span className="w-10 flex-shrink-0 text-right tabular-nums text-gray-500 dark:text-gray-400">{count(c)}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Filters */}
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Field label="From date">
              <input type="date" value={filters.date_from ?? ''} max={filters.date_to || undefined} onChange={e => set('date_from', e.target.value)} className={FIELD} />
            </Field>
            <Field label="To date">
              <input type="date" value={filters.date_to ?? ''} min={filters.date_from || undefined} onChange={e => set('date_to', e.target.value)} className={FIELD} />
            </Field>
            <Field label="Rating">
              <select value={filters.rating ?? ''} onChange={e => set('rating', e.target.value ? Number(e.target.value) : '')} className={FIELD}>
                <option value="">All</option>
                {[5, 4, 3, 2, 1].map(n => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="About">
              <select value={filters.category ?? ''} onChange={e => set('category', e.target.value as FeedbackFilters['category'])} className={FIELD}>
                <option value="">All</option>
                {CATEGORY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select value={filters.status ?? ''} onChange={e => set('status', e.target.value as FeedbackFilters['status'])} className={FIELD}>
                <option value="">All</option>
                {STATUS_OPTIONS.map(o => (
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
                  placeholder="Name, email or words"
                  aria-label="Search feedback"
                  className={cn(FIELD, 'pl-9')}
                />
                {list.isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" aria-hidden />}
              </div>
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
            <p className="tabular-nums">
              {backwards ? (
                <span className="font-semibold text-red-600 dark:text-red-400">“From” is after “To”. Change the dates.</span>
              ) : list.data ? (
                <>
                  <span className="font-semibold text-gray-800 dark:text-gray-100">{count(total)}</span> message{total === 1 ? '' : 's'}
                  {feedbackHasFilters(active) ? ' match these filters' : ' in all'} · newest first
                </>
              ) : (
                'Loading…'
              )}
            </p>
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1.5">
                Rows per page
                <select value={limit} onChange={e => setLimit(Number(e.target.value))} className="rounded-md border border-gray-200 bg-white px-1.5 py-1 text-xs dark:border-gray-700 dark:bg-gray-800">
                  {PAGE_SIZES.map(n => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {feedbackHasFilters(active) && (
                <button type="button" onClick={clear} className="inline-flex items-center gap-1 font-semibold text-orange-700 hover:underline dark:text-orange-300">
                  <RotateCcw className="h-3 w-3" /> Clear filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* List */}
        {list.isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/20">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Could not load the feedback</p>
            <p className="mt-1 text-xs text-red-600/80 dark:text-red-300/70">{(list.error as Error)?.message}</p>
            <button type="button" onClick={() => list.refetch()} className="mt-3 text-xs font-semibold text-red-700 underline dark:text-red-300">
              Try again
            </button>
          </div>
        ) : backwards ? null : list.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-brand-600 dark:border-blue-900 dark:border-t-blue-400" />
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
            <MessageSquareHeart className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{feedbackHasFilters(active) ? 'No feedback matches these filters.' : 'No feedback yet.'}</p>
          </div>
        ) : (
          <>
            <ul className="space-y-2.5">
              {rows.map(r => (
                <li key={r.feedback_id} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/org/history/${r.user_id}`} className="block truncate text-sm font-semibold text-gray-900 hover:text-orange-700 hover:underline dark:text-gray-100">
                        {r.name || DASH}
                      </Link>
                      <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{[r.email, r.mobile].filter(Boolean).join(' · ') || DASH}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={cn('h-3.5 w-3.5', n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600')} />
                        ))}
                      </span>
                      <select
                        value={r.status}
                        onChange={e => changeStatus(r, e.target.value as FeedbackStatus)}
                        aria-label="Status"
                        className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset focus:outline-none', STATUS_CLS[r.status] ?? STATUS_CLS.new)}
                      >
                        {STATUS_OPTIONS.map(o => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm text-gray-700 dark:text-gray-200">{r.message}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                    <span className="rounded-md bg-gray-50 px-1.5 py-0.5 font-semibold ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:ring-gray-700">{categoryLabel(r.category)}</span>
                    <span className="tabular-nums">{r.created_at_ist || DASH} IST</span>
                    {r.page && <span className="truncate">from {r.page}</span>}
                  </p>
                </li>
              ))}
            </ul>

            {pages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                  Page {list.data?.page ?? page} of {count(pages)}
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

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</span>
      {children}
    </label>
  );
}

function Tile({ label, value, accent, stars }: { label: string; value: string; accent?: boolean; stars?: number | null }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <p className={cn('mt-1 text-2xl font-extrabold tabular-nums', accent ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100')}>{value}</p>
      {stars != null && (
        <span className="mt-1 inline-flex items-center gap-0.5" aria-hidden>
          {[1, 2, 3, 4, 5].map(n => (
            <Star key={n} className={cn('h-3.5 w-3.5', n <= Math.round(stars) ? 'fill-amber-400 text-amber-400' : 'text-gray-300 dark:text-gray-600')} />
          ))}
        </span>
      )}
    </div>
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
