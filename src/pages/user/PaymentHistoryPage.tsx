import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Download, Loader2, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { UserShell } from '@/components/user/UserShell';
import { cn } from '@/lib/utils';
import {
  describeValidity,
  downloadInvoice,
  formatPurchaseTime,
  getPurchaseHistory,
  type Purchase,
} from '@/lib/purchase-history';

type Filter = 'all' | 'plan' | 'topup';

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'plan', label: 'Plans' },
  { key: 'topup', label: 'Top-ups' },
];

const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900' },
  expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
  replaced: { label: 'Replaced', cls: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
  used_up: { label: 'Used up', cls: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700' },
};

export default function PaymentHistoryPage() {
  const [filter, setFilter] = useState<Filter>('all');

  const q = useInfiniteQuery({
    queryKey: ['purchase-history', filter],
    queryFn: ({ pageParam }) => getPurchaseHistory({ kind: filter === 'all' ? undefined : filter, page: pageParam, limit: 20 }),
    initialPageParam: 1,
    getNextPageParam: last => (last.page < last.pages ? last.page + 1 : undefined),
  });

  const items = q.data?.pages.flatMap(p => p.items) ?? [];

  return (
    <UserShell>
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <Receipt className="w-6 h-6 text-blue-600" /> Purchase History
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Every plan and top-up you have paid for, newest first.</p>
      </div>

      <div className="mb-4 inline-flex gap-1 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/40 p-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-xs font-bold transition-colors',
              filter === f.key ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 dark:text-gray-400',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {q.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      ) : q.isError ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {(q.error as Error)?.message || 'Could not load your purchases.'}
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-10 text-center text-sm text-gray-500">
          No purchases yet
        </p>
      ) : (
        <>
          <ul className="space-y-3">
            {items.map(p => (
              <PurchaseRow key={p.txn_id} p={p} />
            ))}
          </ul>
          {q.hasNextPage && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => q.fetchNextPage()}
                disabled={q.isFetchingNextPage}
                className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-5 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 disabled:opacity-60"
              >
                {q.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </UserShell>
  );
}

function PurchaseRow({ p }: { p: Purchase }) {
  const [downloading, setDownloading] = useState(false);
  const v = describeValidity(p);
  const status = v.status ? STATUS_STYLE[v.status] : null;
  const discounted = p.discount_amount > 0;
  const gst = p.gst_amount ?? 0;

  const download = async () => {
    setDownloading(true);
    try {
      await downloadInvoice(p);
    } catch (e) {
      // A 401 has already been told to the person (the session popup); anything else says what went wrong.
      if (!(e as { handled?: boolean }).handled) toast.error((e as Error).message || 'Could not download the invoice.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <li className="rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">{p.name}</p>
            <span
              className={cn(
                'rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                p.kind === 'plan'
                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-300',
              )}
            >
              {p.kind === 'plan' ? 'Plan' : 'Top-up'}
            </span>
            {p.kind === 'plan' && p.billing_cycle && (
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{cap(p.billing_cycle)}</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{formatPurchaseTime(p.purchased_at)}</p>
        </div>

        <div className="text-right">
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{rupees(p.amount_paid)}</p>
          {discounted && <p className="text-xs text-gray-400 line-through">{rupees(p.base_amount)}</p>}
          {gst > 0 && <p className="text-xs text-gray-500 dark:text-gray-400">incl. GST {rupees(gst)}</p>}
        </div>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 border-t border-gray-100 dark:border-gray-800 pt-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Invoice ID" value={p.invoice_no ?? '—'} mono />
        <Field label="Payment ID" value={p.payment_id ?? '—'} mono />
        <Field label="Paid with" value={p.payment_method ? cap(p.payment_method) : '—'} />
        {p.promo_code && <Field label="Promo code" value={p.promo_code} mono />}
        {gst > 0 && <Field label="GST" value={rupees(gst)} />}
        <div className="sm:col-span-2 lg:col-span-4">
          <dt className="text-gray-400">Validity</dt>
          <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-semibold text-gray-800 dark:text-gray-100">
            <span>{v.line}</span>
            {status && (
              <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold', status.cls)}>{status.label}</span>
            )}
            {v.detail && <span className="font-normal text-gray-500 dark:text-gray-400">{v.detail}</span>}
          </dd>
        </div>
      </dl>

      {p.invoice_url && (
        <div className="mt-3 flex justify-end border-t border-gray-100 dark:border-gray-800 pt-3">
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-60"
          >
            {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {downloading ? 'Downloading…' : 'Download invoice'}
          </button>
        </div>
      )}
    </li>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-gray-400">{label}</dt>
      <dd className={cn('mt-0.5 truncate font-semibold text-gray-800 dark:text-gray-100', mono && 'font-mono')}>{value}</dd>
    </div>
  );
}
