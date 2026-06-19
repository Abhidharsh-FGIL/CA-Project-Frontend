import { useMemo, useState } from 'react';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  Search,
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Download,
  Tag,
  Receipt,
  Calendar,
  TrendingUp,
  ClipboardCheck,
  Filter,
  CreditCard,
  PiggyBank,
  ArrowUpRight,
  Wallet,
  Smartphone,
  Building2,
  Coins,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  formatPaymentMethod,
  type PaymentTransaction,
  type TransactionStatus,
  type TransactionType,
} from '@/data/userPortalSampleData';

const STATUS_META: Record<TransactionStatus, { label: string; cls: string; dot: string; icon: typeof CheckCircle2 }> = {
  success: {
    label: 'Paid',
    cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    cls: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900',
    dot: 'bg-red-500',
    icon: XCircle,
  },
  refunded: {
    label: 'Refunded',
    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    dot: 'bg-amber-500',
    icon: RefreshCcw,
  },
};

const METHOD_ICON: Record<PaymentTransaction['payment_method'], typeof CreditCard> = {
  card: CreditCard,
  upi: Smartphone,
  netbanking: Building2,
  wallet: Wallet,
};

type FilterType = 'all' | TransactionType;
type FilterStatus = 'all' | TransactionStatus;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function PaymentHistoryPage() {
  const { transactions } = useUserPortal();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter(t => typeFilter === 'all' || t.type === typeFilter)
      .filter(t => statusFilter === 'all' || t.status === statusFilter)
      .filter(t => {
        if (!q) return true;
        return (
          t.item_name.toLowerCase().includes(q) ||
          t.invoice_no.toLowerCase().includes(q) ||
          (t.promo_code || '').toLowerCase().includes(q)
        );
      });
  }, [transactions, search, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const successful = transactions.filter(t => t.status === 'success');
    const totalSpent = successful.reduce((s, t) => s + t.final_amount, 0);
    const totalSaved = successful.reduce((s, t) => s + t.discount_amount, 0);
    const subRevenue = successful
      .filter(t => t.type === 'subscription')
      .reduce((s, t) => s + t.final_amount, 0);
    const testRevenue = successful
      .filter(t => t.type === 'test')
      .reduce((s, t) => s + t.final_amount, 0);
    const subCount = successful.filter(t => t.type === 'subscription').length;
    const testCount = successful.filter(t => t.type === 'test').length;
    return { totalSpent, totalSaved, subRevenue, testRevenue, subCount, testCount };
  }, [transactions]);

  // 6-month spending chart
  const monthlyData = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; label: string; total: number; tests: number; subs: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth()}`,
        label: MONTH_SHORT[d.getMonth()],
        total: 0,
        tests: 0,
        subs: 0,
      });
    }
    for (const t of transactions) {
      if (t.status !== 'success') continue;
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const b = buckets.find(b => b.key === key);
      if (!b) continue;
      b.total += t.final_amount;
      if (t.type === 'test') b.tests += t.final_amount;
      else b.subs += t.final_amount;
    }
    const max = Math.max(1, ...buckets.map(b => b.total));
    return { buckets, max };
  }, [transactions]);

  // Payment method breakdown
  const methodStats = useMemo(() => {
    const successful = transactions.filter(t => t.status === 'success');
    const total = successful.length;
    const counts: Record<PaymentTransaction['payment_method'], number> = {
      card: 0,
      upi: 0,
      netbanking: 0,
      wallet: 0,
    };
    for (const t of successful) counts[t.payment_method] += 1;
    return Object.entries(counts)
      .map(([method, count]) => ({
        method: method as PaymentTransaction['payment_method'],
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
      }))
      .filter(m => m.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [transactions]);

  // Group by month label
  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; txns: PaymentTransaction[] }>();
    for (const t of filtered) {
      const d = new Date(t.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      if (!map.has(key)) map.set(key, { key, label, total: 0, txns: [] });
      const bucket = map.get(key)!;
      bucket.txns.push(t);
      if (t.status === 'success') bucket.total += t.final_amount;
    }
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [filtered]);

  // Donut math for tests vs subs
  const donutTotal = stats.subRevenue + stats.testRevenue;
  const subPct = donutTotal ? (stats.subRevenue / donutTotal) * 100 : 0;
  const subDash = `${(subPct / 100) * 251.2} 251.2`; // 2πr where r=40 → ~251.2

  return (
    <UserShell>
      {/* ───── Hero header ───── */}
      <div className="mb-6 animate-fadeIn">
        <div className="relative overflow-hidden rounded-3xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 bg-[length:200%_auto] animate-gradient-x text-white shadow-xl shadow-indigo-200/40 dark:shadow-indigo-950/40">
          <div className="absolute inset-0 bg-soft-dots opacity-15 pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-black/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative p-5 sm:p-7 lg:p-9">
            <div className="flex items-start justify-between gap-4 flex-col lg:flex-row">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/25 rounded-full px-3 py-1 mb-3">
                  <Receipt className="w-3 h-3" />
                  <p className="text-[10px] uppercase tracking-[0.25em] font-bold">
                    Billing & Receipts
                  </p>
                </div>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight">
                  Payment History
                </h1>
                <p className="text-sm opacity-90 mt-2 max-w-md">
                  Every test purchase and plan upgrade — receipts, promo savings, and methods in one view.
                </p>
              </div>

              {/* Lifetime total chip */}
              <div className="flex gap-3 flex-wrap">
                <div className="bg-white/15 backdrop-blur border border-white/25 rounded-2xl px-4 py-3 min-w-[140px]">
                  <p className="text-[10px] uppercase tracking-widest opacity-80">Lifetime spend</p>
                  <p className="text-2xl font-bold leading-tight mt-0.5">
                    ₹{stats.totalSpent.toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="bg-white/15 backdrop-blur border border-white/25 rounded-2xl px-4 py-3 min-w-[140px]">
                  <p className="text-[10px] uppercase tracking-widest opacity-80">Saved with promos</p>
                  <p className="text-2xl font-bold leading-tight mt-0.5 inline-flex items-center gap-1">
                    ₹{stats.totalSaved.toLocaleString('en-IN')}
                    <ArrowUpRight className="w-4 h-4 opacity-70" />
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───── Analytics row ───── */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* Spending trend */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 animate-slideUp">
          <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Spending Trend
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Last 6 months</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] flex-shrink-0">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                <span className="text-gray-600 dark:text-gray-400">Tests</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                <span className="text-gray-600 dark:text-gray-400">Plans</span>
              </span>
            </div>
          </div>

          <div className="h-44 flex items-stretch gap-2 sm:gap-3">
            {monthlyData.buckets.map((b, i) => {
              const totalPct = (b.total / monthlyData.max) * 100;
              const testShare = b.total > 0 ? (b.tests / b.total) * totalPct : 0;
              const subShare = b.total > 0 ? (b.subs / b.total) * totalPct : 0;
              return (
                <div key={b.key} className="flex-1 h-full flex flex-col items-center gap-1 group">
                  <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 h-4 leading-4 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                    ₹{b.total.toLocaleString('en-IN')}
                  </p>
                  <div
                    className="w-full flex-1 min-h-0 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/40 relative animate-fadeIn"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    {/* Tests bar (bottom) */}
                    <div
                      className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-emerald-500 to-emerald-400 group-hover:from-emerald-600 group-hover:to-emerald-500 transition-all duration-500"
                      style={{ height: `${testShare}%` }}
                    />
                    {/* Subscription bar (stacked on top) */}
                    <div
                      className="absolute left-0 right-0 bg-gradient-to-t from-indigo-500 to-indigo-400 group-hover:from-indigo-600 group-hover:to-indigo-500 transition-all duration-500"
                      style={{ height: `${subShare}%`, bottom: `${testShare}%` }}
                    />
                  </div>
                  <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-1">{b.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tests vs Subscriptions donut */}
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 animate-slideUp"
          style={{ animationDelay: '0.05s' }}
        >
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1">
            <PiggyBank className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            Where it goes
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Lifetime breakdown</p>

          {donutTotal === 0 ? (
            <div className="h-32 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
              No spending yet
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative w-28 h-28 flex-shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  {/* Tests background ring (full circle) */}
                  <circle cx="50" cy="50" r="40" fill="none" strokeWidth="14" className="stroke-emerald-400 dark:stroke-emerald-500" />
                  {/* Subscriptions arc on top */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    strokeWidth="14"
                    strokeDasharray={subDash}
                    className="stroke-indigo-500 dark:stroke-indigo-400 transition-all"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-gray-500 dark:text-gray-400">Total</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight tabular-nums">
                    ₹{donutTotal.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <div className="flex-1 space-y-2 min-w-0">
                <DonutLegend
                  color="indigo"
                  label="Plans"
                  value={stats.subRevenue}
                  count={stats.subCount}
                  pct={Math.round(subPct)}
                />
                <DonutLegend
                  color="emerald"
                  label="Tests"
                  value={stats.testRevenue}
                  count={stats.testCount}
                  pct={Math.round(100 - subPct)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ───── Payment methods strip ───── */}
      {methodStats.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-50/60 via-white to-purple-50/60 dark:from-indigo-950/30 dark:via-gray-900 dark:to-purple-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900 p-4 mb-6 animate-fadeIn">
          <div className="flex items-center gap-2 mb-3">
            <Coins className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
              Your Payment Methods
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {methodStats.map(m => {
              const Icon = METHOD_ICON[m.method];
              return (
                <div
                  key={m.method}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors hover-lift"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <Icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 tabular-nums">{m.pct}%</span>
                  </div>
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{formatPaymentMethod(m.method)}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{m.count} txns</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ───── Filters ───── */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 mb-4 animate-fadeIn">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by invoice, item, or promo code…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400 hidden sm:block" />
            <FilterChip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>
              All
            </FilterChip>
            <FilterChip active={typeFilter === 'test'} onClick={() => setTypeFilter('test')} icon={<ClipboardCheck className="w-3 h-3" />}>
              Tests
            </FilterChip>
            <FilterChip active={typeFilter === 'subscription'} onClick={() => setTypeFilter('subscription')} icon={<Sparkles className="w-3 h-3" />}>
              Plans
            </FilterChip>

            <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />

            <FilterChip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>
              Any status
            </FilterChip>
            <FilterChip active={statusFilter === 'success'} onClick={() => setStatusFilter('success')}>
              Paid
            </FilterChip>
            <FilterChip active={statusFilter === 'refunded'} onClick={() => setStatusFilter('refunded')}>
              Refunded
            </FilterChip>
          </div>
        </div>
      </div>

      {/* ───── Transaction timeline ───── */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center animate-fadeIn">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950/60 dark:to-purple-950/60 flex items-center justify-center">
            <Receipt className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No transactions match your filters</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Try clearing filters or buy a test to see receipts here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group, gi) => (
            <div key={group.key} className="animate-slideUp" style={{ animationDelay: `${gi * 0.04}s` }}>
              {/* Month header bar */}
              <div className="flex items-center gap-3 mb-3">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-950/60 dark:to-purple-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full">
                  <Calendar className="w-3.5 h-3.5" />
                  <p className="text-xs font-bold">{group.label}</p>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 dark:from-indigo-900 to-transparent" />
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                  {group.txns.length} {group.txns.length === 1 ? 'item' : 'items'}
                </p>
                {group.total > 0 && (
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                    ₹{group.total.toLocaleString('en-IN')}
                  </p>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {group.txns.map(t => (
                  <ReceiptCard key={t.txn_id} txn={t} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </UserShell>
  );
}

function DonutLegend({
  color,
  label,
  value,
  count,
  pct,
}: {
  color: 'indigo' | 'emerald';
  label: string;
  value: number;
  count: number;
  pct: number;
}) {
  const cls =
    color === 'indigo'
      ? 'bg-indigo-500'
      : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <span className={cn('w-2.5 h-2.5 rounded-sm flex-shrink-0', cls)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</p>
          <p className="text-xs font-bold tabular-nums text-gray-900 dark:text-gray-100">{pct}%</p>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
          ₹{value.toLocaleString('en-IN')} · {count} txns
        </p>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
        active
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-md shadow-indigo-200/60 dark:shadow-indigo-900/40'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function ReceiptCard({ txn }: { txn: PaymentTransaction }) {
  const [expanded, setExpanded] = useState(false);
  const StatusIcon = STATUS_META[txn.status].icon;
  const MethodIcon = METHOD_ICON[txn.payment_method];
  const isSub = txn.type === 'subscription';

  return (
    <div
      className={cn(
        'group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-all duration-300',
        'hover:shadow-lg hover:shadow-indigo-100/40 dark:hover:shadow-indigo-950/40 hover:border-indigo-200 dark:hover:border-indigo-800 hover-lift card-shine',
      )}
    >
      {/* Left accent bar */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1',
          isSub
            ? 'bg-gradient-to-b from-indigo-500 via-purple-500 to-pink-500'
            : 'bg-gradient-to-b from-emerald-500 via-teal-500 to-cyan-500',
        )}
      />

      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full text-left p-4 pl-5"
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm',
              isSub
                ? 'bg-gradient-to-br from-indigo-500 to-purple-500 text-white'
                : 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white',
            )}
          >
            {isSub ? <Sparkles className="w-5 h-5" /> : <ClipboardCheck className="w-5 h-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                {txn.item_name}
              </p>
              <p
                className={cn(
                  'text-base font-bold tabular-nums flex-shrink-0',
                  txn.status === 'failed' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100',
                )}
              >
                ₹{txn.final_amount.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {isSub && txn.billing_cycle && (
                <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                  {txn.billing_cycle}
                </span>
              )}
              {!isSub && txn.mode && (
                <span
                  className={cn(
                    'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                    txn.mode === 'mock'
                      ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300'
                      : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
                  )}
                >
                  {txn.mode}
                </span>
              )}
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border',
                  STATUS_META[txn.status].cls,
                )}
              >
                <StatusIcon className="w-2.5 h-2.5" />
                {STATUS_META[txn.status].label}
              </span>
              {txn.promo_code && (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                  <Tag className="w-2.5 h-2.5" />
                  {txn.promo_code}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 mt-2 text-[10px] text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono truncate">{txn.invoice_no}</span>
                <span>·</span>
                <span className="inline-flex items-center gap-1 flex-shrink-0">
                  <MethodIcon className="w-3 h-3" />
                  {formatPaymentMethod(txn.payment_method)}
                </span>
              </div>
              <span className="flex-shrink-0">
                {new Date(txn.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
              </span>
            </div>
          </div>
        </div>

        {txn.discount_amount > 0 && txn.status === 'success' && (
          <div className="mt-3 pt-2.5 border-t border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-between text-[11px]">
            <span className="text-gray-500 dark:text-gray-400">You saved</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              ₹{txn.discount_amount.toLocaleString('en-IN')}
            </span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-3 bg-gradient-to-br from-gray-50/80 to-indigo-50/40 dark:from-gray-800/40 dark:to-indigo-950/20 animate-fadeIn">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
            <DetailRow label="Base amount" value={`₹${txn.base_amount.toLocaleString('en-IN')}`} />
            {txn.discount_amount > 0 && (
              <DetailRow
                label="Discount"
                value={`−₹${txn.discount_amount.toLocaleString('en-IN')}`}
                accent="emerald"
              />
            )}
            <DetailRow label="Final paid" value={`₹${txn.final_amount.toLocaleString('en-IN')}`} bold />
            <DetailRow
              label="Date"
              value={new Date(txn.created_at).toLocaleString('en-IN', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            />
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 flex-wrap">
            <button
              onClick={e => {
                e.stopPropagation();
                toast.success(`Receipt ${txn.invoice_no} downloaded (demo)`);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors press"
            >
              <Download className="w-3.5 h-3.5" />
              Receipt
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                navigator.clipboard.writeText(txn.invoice_no);
                toast.success('Invoice number copied');
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors press"
            >
              <FileText className="w-3.5 h-3.5" />
              Copy ID
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  bold = false,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  accent?: 'emerald';
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={cn(
          'text-xs tabular-nums',
          bold ? 'font-bold text-gray-900 dark:text-gray-100' : 'text-gray-700 dark:text-gray-300',
          accent === 'emerald' && 'text-emerald-700 dark:text-emerald-400 font-semibold',
        )}
      >
        {value}
      </span>
    </div>
  );
}
