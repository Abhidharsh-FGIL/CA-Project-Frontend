import { useMemo, useState } from 'react';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Search,
  Filter,
  Download,
  TrendingUp,
  IndianRupee,
  ClipboardCheck,
  Sparkles,
  CheckCircle2,
  XCircle,
  RefreshCcw,
  Receipt,
  Tag,
  Wallet,
  Calendar,
  X,
  CreditCard,
  Smartphone,
  Building2,
  ArrowUpRight,
  BarChart3,
  Coins,
  Crown,
  Star,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAdminPayments, useAdminPaymentAnalytics, useAdminPaymentActions } from '@/hooks/use-admin-payments';
import { paymentsApi, type PaymentTxnOut } from '@/lib/adminApi';

type AdminTxnStatus = 'success' | 'failed' | 'refunded';
type AdminTxnType = 'test' | 'subscription';

const STATUS_META: Record<AdminTxnStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  success: {
    label: 'Success',
    cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Failed',
    cls: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900',
    icon: XCircle,
  },
  refunded: {
    label: 'Refunded',
    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    icon: RefreshCcw,
  },
};

const METHOD_LABEL: Record<string, string> = {
  card: 'Card',
  upi: 'UPI',
  netbanking: 'Net Banking',
  wallet: 'Wallet',
};

const METHOD_ICON: Record<string, typeof CreditCard> = {
  card: CreditCard,
  upi: Smartphone,
  netbanking: Building2,
  wallet: Wallet,
};

const METHOD_COLOR: Record<string, string> = {
  card: 'bg-indigo-500',
  upi: 'bg-emerald-500',
  netbanking: 'bg-purple-500',
  wallet: 'bg-amber-500',
};

const TIER_META: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  standard: { label: 'Standard', icon: Sparkles, color: 'from-blue-500 to-cyan-500' },
  ultimate: { label: 'Ultimate', icon: Sparkles, color: 'from-indigo-500 to-purple-500' },
  premium: { label: 'Premium', icon: Crown, color: 'from-amber-500 to-orange-500' },
  free: { label: 'Free', icon: Star, color: 'from-gray-400 to-gray-500' },
};

type FilterType = 'all' | AdminTxnType;
type FilterStatus = 'all' | AdminTxnStatus;
type FilterRange = '7d' | '30d' | '90d' | 'all';

export default function AdminPaymentsPage() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<FilterType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('success');
  const [rangeFilter, setRangeFilter] = useState<FilterRange>('30d');
  const [selected, setSelected] = useState<PaymentTxnOut | null>(null);

  // Date range params for API calls
  const dateParams = useMemo(() => {
    const now = new Date();
    if (rangeFilter === 'all') return {} as { date_from?: string; date_to?: string };
    const days = rangeFilter === '7d' ? 7 : rangeFilter === '30d' ? 30 : 90;
    const from = new Date(now.getTime() - days * 86_400_000);
    return { date_from: from.toISOString(), date_to: now.toISOString() };
  }, [rangeFilter]);

  const { data: txnData, isLoading: txnLoading } = useAdminPayments({ ...dateParams, limit: 100 });
  const transactions: PaymentTxnOut[] = txnData?.items ?? [];
  const { data: analytics } = useAdminPaymentAnalytics(dateParams.date_from, dateParams.date_to);
  const { refund } = useAdminPaymentActions();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter(t => typeFilter === 'all' || t.payment_type === typeFilter)
      .filter(t => statusFilter === 'all' || t.payment_status === statusFilter)
      .filter(t => {
        if (!q) return true;
        return (
          (t.item_name || '').toLowerCase().includes(q) ||
          (t.invoice_no || '').toLowerCase().includes(q) ||
          (t.promo_code || '').toLowerCase().includes(q) ||
          t.user_id.toLowerCase().includes(q) ||
          t.txn_id.toLowerCase().includes(q)
        );
      });
  }, [search, typeFilter, statusFilter, transactions]);

  const { visible: visibleTransactions, sentinelRef: txSentinelRef, hasMore: txHasMore, shown: txShown, total: txTotal } = useInfiniteList(filtered, 25);

  // KPI stats — sourced from analytics API; fall back to computing from loaded transactions
  const stats = useMemo(() => {
    const revenue = analytics?.total_revenue ?? 0;
    const subRevenue = analytics?.revenue_by_type?.subscription ?? 0;
    const testRevenue = analytics?.revenue_by_type?.test ?? 0;
    const txnCount = analytics?.successful_transactions ?? 0;
    const failedCount = analytics?.failed_transactions ?? 0;
    // discountsGiven and uniqueUsers are not returned by the analytics API; derive from loaded page
    const successful = transactions.filter(t => t.payment_status === 'success');
    const discountsGiven = successful.reduce((s, t) => s + t.discount_amount, 0);
    const uniqueUsers = new Set(successful.map(t => t.user_id)).size;
    const avgOrderValue = txnCount ? Math.round(revenue / txnCount) : 0;
    return {
      revenue,
      discountsGiven,
      subRevenue,
      testRevenue,
      failedCount,
      uniqueUsers,
      txnCount,
      avgOrderValue,
    };
  }, [analytics, transactions]);

  // Daily revenue chart — built from analytics.revenue_by_day (last 14 entries)
  const revenueChart = useMemo(() => {
    const apiDays = analytics?.revenue_by_day ?? [];
    // Take last 14 days from the API data; fall back to empty buckets
    const now = new Date();
    const days = 14;
    const buckets: { key: string; label: string; total: number; tests: number; subs: number; count: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const apiEntry = apiDays.find(e => e.date.startsWith(key));
      buckets.push({
        key,
        label: d.toLocaleDateString('en-IN', { day: 'numeric' }),
        total: apiEntry?.amount ?? 0,
        tests: 0,
        subs: 0,
        count: 0,
      });
    }
    const max = Math.max(1, ...buckets.map(b => b.total));
    return { buckets, max };
  }, [analytics]);

  // Payment method breakdown — derived from the loaded transaction page
  const methodStats = useMemo(() => {
    const successful = transactions.filter(t => t.payment_status === 'success');
    const total = successful.reduce((s, t) => s + t.final_amount, 0);
    const counts: Record<string, { count: number; amount: number }> = {};
    for (const t of successful) {
      const method = t.payment_method || 'other';
      if (!counts[method]) counts[method] = { count: 0, amount: 0 };
      counts[method].count += 1;
      counts[method].amount += t.final_amount;
    }
    return Object.entries(counts)
      .map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.amount,
        pct: total ? (data.amount / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  // Promo code performance — derived from loaded transaction page
  const promoStats = useMemo(() => {
    const withPromo = transactions.filter(t => t.payment_status === 'success' && t.promo_code);
    const byCode = new Map<string, { redemptions: number; discountTotal: number; revenue: number }>();
    for (const t of withPromo) {
      const code = t.promo_code!;
      if (!byCode.has(code)) byCode.set(code, { redemptions: 0, discountTotal: 0, revenue: 0 });
      const s = byCode.get(code)!;
      s.redemptions += 1;
      s.discountTotal += t.discount_amount;
      s.revenue += t.final_amount;
    }
    return Array.from(byCode.entries())
      .map(([code, s]) => ({ code, ...s }))
      .sort((a, b) => b.redemptions - a.redemptions);
  }, [transactions]);

  // Subscription tier revenue — derived from loaded transaction page (item_id used as tier key)
  const tierStats = useMemo(() => {
    const subs = transactions.filter(t => t.payment_status === 'success' && t.payment_type === 'subscription');
    const byTier = new Map<string, { count: number; revenue: number }>();
    for (const t of subs) {
      const tier = t.item_id ?? 'unknown';
      if (!byTier.has(tier)) byTier.set(tier, { count: 0, revenue: 0 });
      const s = byTier.get(tier)!;
      s.count += 1;
      s.revenue += t.final_amount;
    }
    return Array.from(byTier.entries())
      .map(([tier, s]) => ({ tier, ...s }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [transactions]);

  const exportCSV = () => {
    paymentsApi.exportCsv(dateParams.date_from, dateParams.date_to);
    toast.success('Export started — your download will begin shortly');
  };

  // Donut math
  const subPct = stats.revenue ? (stats.subRevenue / stats.revenue) * 100 : 0;
  const subDash = `${(subPct / 100) * 251.2} 251.2`;

  return (
    <GenVerseShell>
      <PageHeader
        title="Payments & Revenue"
        description="Platform-wide transaction ledger and revenue analytics."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Payments' }]}
      />

      <div className="space-y-5 pb-6">
        {/* ───── Hero header ───── */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 bg-[length:200%_auto] animate-gradient-x text-white shadow-xl shadow-indigo-200/40 dark:shadow-indigo-950/40 animate-fadeIn">
          <div className="absolute inset-0 bg-soft-dots opacity-15 pointer-events-none" />
          <div className="absolute -top-20 -right-20 w-72 h-72 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-black/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative p-5 sm:p-7 lg:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/25 rounded-full px-3 py-1 mb-3">
                <Coins className="w-3 h-3" />
                <p className="text-[10px] uppercase tracking-[0.25em] font-bold">Revenue Dashboard</p>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold leading-tight">
                ₹{stats.revenue.toLocaleString('en-IN')}
              </h1>
              <p className="text-sm opacity-90 mt-1">
                Total revenue · {stats.txnCount} successful transactions ·{' '}
                {rangeFilter === 'all' ? 'all time' : `last ${rangeFilter}`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 w-full lg:w-auto">
              <div className="bg-white/15 backdrop-blur border border-white/25 rounded-xl px-3 py-2 text-center">
                <p className="text-[9px] uppercase tracking-wider opacity-80">Avg Order</p>
                <p className="text-base sm:text-lg font-bold tabular-nums">
                  ₹{stats.avgOrderValue.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-white/15 backdrop-blur border border-white/25 rounded-xl px-3 py-2 text-center">
                <p className="text-[9px] uppercase tracking-wider opacity-80">Paying Users</p>
                <p className="text-base sm:text-lg font-bold tabular-nums">{stats.uniqueUsers}</p>
              </div>
              <div className="bg-white/15 backdrop-blur border border-white/25 rounded-xl px-3 py-2 text-center">
                <p className="text-[9px] uppercase tracking-wider opacity-80">Promo Savings</p>
                <p className="text-base sm:text-lg font-bold tabular-nums">
                  ₹{(stats.discountsGiven / 1000).toFixed(1)}k
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ───── Range toggle pinned to top of dashboard ───── */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-gray-500 dark:text-gray-400 inline-flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            Showing data for
          </p>
          <div className="inline-flex items-center bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-1 shadow-sm">
            {(['7d', '30d', '90d', 'all'] as FilterRange[]).map(r => (
              <button
                key={r}
                onClick={() => setRangeFilter(r)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
                  rangeFilter === r
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100',
                )}
              >
                {r === 'all' ? 'All' : r}
              </button>
            ))}
          </div>
        </div>

        {/* ───── Analytics row 1: Revenue chart + Type split donut ───── */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Daily revenue chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 animate-slideUp">
            <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Daily Revenue
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Last 14 days</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] flex-shrink-0">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" />
                  <span className="text-gray-600 dark:text-gray-400">Tests</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" />
                  <span className="text-gray-600 dark:text-gray-400">Subscriptions</span>
                </span>
              </div>
            </div>

            <div className="h-48 flex items-stretch gap-1 sm:gap-1.5">
              {revenueChart.buckets.map((b, i) => {
                const totalPct = (b.total / revenueChart.max) * 100;
                const testShare = b.total > 0 ? (b.tests / b.total) * totalPct : 0;
                const subShare = b.total > 0 ? (b.subs / b.total) * totalPct : 0;
                return (
                  <div key={b.key} className="flex-1 h-full flex flex-col items-center gap-1 group">
                    <p className="text-[9px] font-bold text-gray-700 dark:text-gray-300 h-3.5 leading-none opacity-0 group-hover:opacity-100 transition-opacity tabular-nums whitespace-nowrap">
                      ₹{b.total >= 1000 ? `${(b.total / 1000).toFixed(1)}k` : b.total}
                    </p>
                    <div
                      className="w-full flex-1 min-h-0 rounded-md overflow-hidden bg-gray-50 dark:bg-gray-800/40 relative animate-fadeIn"
                      style={{ animationDelay: `${i * 0.04}s` }}
                    >
                      <div
                        className="absolute left-0 right-0 bottom-0 bg-gradient-to-t from-emerald-500 to-emerald-400 group-hover:from-emerald-600 group-hover:to-emerald-500 transition-all duration-500"
                        style={{ height: `${testShare}%` }}
                        title={`₹${b.tests.toLocaleString('en-IN')} in tests`}
                      />
                      <div
                        className="absolute left-0 right-0 bg-gradient-to-t from-indigo-500 to-indigo-400 group-hover:from-indigo-600 group-hover:to-indigo-500 transition-all duration-500"
                        style={{ height: `${subShare}%`, bottom: `${testShare}%` }}
                        title={`₹${b.subs.toLocaleString('en-IN')} in subscriptions`}
                      />
                    </div>
                    <p className="text-[9px] font-semibold text-gray-500 dark:text-gray-400 leading-none">
                      {b.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Type split donut */}
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 animate-slideUp"
            style={{ animationDelay: '0.05s' }}
          >
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              Revenue Mix
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Tests vs Subscriptions</p>

            {stats.revenue === 0 ? (
              <div className="h-32 flex items-center justify-center text-xs text-gray-400 dark:text-gray-500">
                No revenue in range
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="40" fill="none" strokeWidth="14" className="stroke-emerald-400 dark:stroke-emerald-500" />
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
                    <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-tight tabular-nums">
                      ₹{stats.revenue >= 10_000 ? `${(stats.revenue / 1000).toFixed(1)}k` : stats.revenue}
                    </p>
                  </div>
                </div>

                <div className="flex-1 space-y-2 min-w-0">
                  <DonutLegend
                    color="indigo"
                    label="Subscriptions"
                    value={stats.subRevenue}
                    pct={Math.round(subPct)}
                  />
                  <DonutLegend
                    color="emerald"
                    label="Tests"
                    value={stats.testRevenue}
                    pct={Math.round(100 - subPct)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ───── Analytics row 2: Payment methods + Promos + Tiers ───── */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Payment methods */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 animate-slideUp">
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1">
              <Coins className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Payment Methods
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Share of total revenue</p>

            <div className="space-y-3">
              {methodStats.map(m => {
                const Icon = METHOD_ICON[m.method];
                return (
                  <div key={m.method}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="inline-flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {METHOD_LABEL[m.method]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                          ₹{m.amount.toLocaleString('en-IN')}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500 tabular-nums">
                          {m.pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full transition-all duration-700 rounded-full', METHOD_COLOR[m.method])}
                        style={{ width: `${m.pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top promo codes */}
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 animate-slideUp"
            style={{ animationDelay: '0.05s' }}
          >
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1">
              <Tag className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Top Promo Codes
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              {promoStats.length} active code{promoStats.length === 1 ? '' : 's'} · ₹{stats.discountsGiven.toLocaleString('en-IN')} given
            </p>

            {promoStats.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No promo redemptions in range</p>
            ) : (
              <div className="space-y-2">
                {promoStats.slice(0, 5).map(p => (
                  <div
                    key={p.code}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-amber-50/40 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 hover:border-amber-200 dark:hover:border-amber-800 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <code className="text-[11px] font-bold bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded">
                        {p.code}
                      </code>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                        {p.redemptions} redemptions
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        −₹{p.discountTotal.toLocaleString('en-IN')}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
                        ₹{p.revenue.toLocaleString('en-IN')} net
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subscription tier mix */}
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 animate-slideUp"
            style={{ animationDelay: '0.1s' }}
          >
            <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              Subscription Tiers
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Revenue by plan</p>

            {tierStats.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500 italic">No subscriptions in range</p>
            ) : (
              <div className="space-y-2.5">
                {tierStats.map(t => {
                  const meta = TIER_META[t.tier] || TIER_META.standard;
                  const TierIcon = meta.icon;
                  const tierPct = stats.subRevenue ? (t.revenue / stats.subRevenue) * 100 : 0;
                  return (
                    <div
                      key={t.tier}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center text-white flex-shrink-0 bg-gradient-to-br',
                          meta.color,
                        )}
                      >
                        <TierIcon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-bold text-gray-900 dark:text-gray-100 capitalize">
                            {meta.label}
                          </p>
                          <p className="text-xs font-bold tabular-nums text-gray-900 dark:text-gray-100">
                            ₹{t.revenue.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full bg-gradient-to-r rounded-full transition-all duration-700', meta.color)}
                            style={{ width: `${tierPct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                          {t.count} {t.count === 1 ? 'sub' : 'subs'} · {tierPct.toFixed(0)}%
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ───── Secondary KPI strip ───── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MiniKpi
            icon={<IndianRupee className="w-3.5 h-3.5" />}
            label="Net Revenue"
            value={`₹${stats.revenue.toLocaleString('en-IN')}`}
            tone="indigo"
          />
          <MiniKpi
            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
            label="Discounts"
            value={`₹${stats.discountsGiven.toLocaleString('en-IN')}`}
            tone="emerald"
          />
          <MiniKpi
            icon={<XCircle className="w-3.5 h-3.5" />}
            label="Failed"
            value={String(stats.failedCount)}
            tone="red"
          />
          <MiniKpi
            icon={<RefreshCcw className="w-3.5 h-3.5" />}
            label="Refunded"
            value={`₹${stats.refunded.toLocaleString('en-IN')}`}
            tone="amber"
          />
        </div>

        {/* ───── Transactions header + filters ───── */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Transaction Ledger
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 inline-flex items-center gap-1.5">
                  {filtered.length} of {transactions.length} entries
                  {txnLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                </p>
              </div>
              <button
                onClick={exportCSV}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-3 py-2 rounded-lg transition-colors shadow-md shadow-indigo-200/40 dark:shadow-indigo-950/40 press"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mb-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by user, email, invoice, item, or promo…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <Chip active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>All Types</Chip>
              <Chip active={typeFilter === 'test'} onClick={() => setTypeFilter('test')}>Tests</Chip>
              <Chip active={typeFilter === 'subscription'} onClick={() => setTypeFilter('subscription')}>Subscriptions</Chip>

              <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />

              <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All Status</Chip>
              <Chip active={statusFilter === 'success'} onClick={() => setStatusFilter('success')}>Success</Chip>
              <Chip active={statusFilter === 'failed'} onClick={() => setStatusFilter('failed')}>Failed</Chip>
              <Chip active={statusFilter === 'refunded'} onClick={() => setStatusFilter('refunded')}>Refunded</Chip>
            </div>
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-indigo-50/30 dark:from-gray-800/60 dark:to-indigo-950/30 border-b border-gray-100 dark:border-gray-800">
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                  <th className="px-4 py-3">Invoice</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Promo</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {txnLoading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-400" />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Loading transactions…</p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                      </div>
                      <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">No transactions match the filters</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Try widening the date range or clearing search</p>
                    </td>
                  </tr>
                ) : (
                  visibleTransactions.map((t, i) => {
                    const statusMeta = STATUS_META[t.payment_status] ?? STATUS_META.success;
                    const StatusIcon = statusMeta.icon;
                    const method = t.payment_method ?? '';
                    const MethodIcon = METHOD_ICON[method] ?? CreditCard;
                    return (
                      <tr
                        key={t.txn_id}
                        onClick={() => setSelected(t)}
                        className={cn(
                          'border-b border-gray-50 dark:border-gray-800 hover:bg-gradient-to-r hover:from-indigo-50/40 hover:to-purple-50/40 dark:hover:from-indigo-950/20 dark:hover:to-purple-950/20 cursor-pointer transition-all animate-fadeIn group',
                        )}
                        style={{ animationDelay: `${Math.min(i * 0.02, 0.5)}s` }}
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-gray-700 dark:text-gray-300 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {t.invoice_no ?? '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                          {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          <p className="text-[10px] text-gray-400 dark:text-gray-500">
                            {new Date(t.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                              {t.user_id[0]?.toUpperCase() ?? '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate font-mono text-xs">{t.user_id}</p>
                              <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">—</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 text-white shadow-sm',
                                t.payment_type === 'subscription'
                                  ? 'bg-gradient-to-br from-indigo-500 to-purple-500'
                                  : 'bg-gradient-to-br from-emerald-500 to-teal-500',
                              )}
                            >
                              {t.payment_type === 'subscription' ? <Sparkles className="w-3.5 h-3.5" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[200px]">
                                {t.item_name ?? '—'}
                              </p>
                              <p className="text-[10px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">
                                {t.payment_type}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {t.promo_code ? (
                            <code className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-900">
                              <Tag className="w-2.5 h-2.5" />
                              {t.promo_code}
                            </code>
                          ) : (
                            <span className="text-gray-300 dark:text-gray-700 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {t.discount_amount > 0 && (
                            <p className="text-[10px] text-gray-400 dark:text-gray-500 line-through tabular-nums">
                              ₹{t.base_amount.toLocaleString('en-IN')}
                            </p>
                          )}
                          <p
                            className={cn(
                              'text-sm font-bold tabular-nums',
                              t.payment_status === 'failed' ? 'text-gray-400 line-through' : 'text-gray-900 dark:text-gray-100',
                            )}
                          >
                            ₹{t.final_amount.toLocaleString('en-IN')}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            <MethodIcon className="w-3 h-3 text-gray-400" />
                            {method ? (METHOD_LABEL[method] ?? method) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border',
                              statusMeta.cls,
                            )}
                          >
                            <StatusIcon className="w-3 h-3" />
                            {statusMeta.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filtered.length > 0 && (
            <div className="hidden md:flex border-t border-gray-100 dark:border-gray-800 px-4 py-2.5 items-center justify-between bg-gradient-to-r from-gray-50/50 to-indigo-50/30 dark:from-gray-800/30 dark:to-indigo-950/20">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing <strong className="text-gray-700 dark:text-gray-300">{filtered.length}</strong> of {transactions.length} transactions
              </p>
              <p className="text-xs font-bold text-gray-700 dark:text-gray-300 inline-flex items-center gap-1">
                Filtered total:
                <span className="text-indigo-600 dark:text-indigo-400 tabular-nums">
                  ₹
                  {filtered
                    .filter(t => t.payment_status === 'success')
                    .reduce((s, t) => s + t.final_amount, 0)
                    .toLocaleString('en-IN')}
                </span>
              </p>
            </div>
          )}

          {/* Mobile card list */}
          <div className="md:hidden space-y-2 p-3">
            {txnLoading ? (
              <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-8 text-center">
                <Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-400" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-800/40 rounded-xl p-8 text-center">
                <Receipt className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-gray-700" />
                <p className="text-sm text-gray-500 dark:text-gray-400">No transactions match the filters</p>
              </div>
            ) : (
              visibleTransactions.map(t => {
                const statusMeta = STATUS_META[t.payment_status] ?? STATUS_META.success;
                const StatusIcon = statusMeta.icon;
                return (
                  <button
                    key={t.txn_id}
                    onClick={() => setSelected(t)}
                    className="w-full bg-gray-50/60 dark:bg-gray-800/40 rounded-xl border border-gray-100 dark:border-gray-800 p-3 text-left hover:border-indigo-300 dark:hover:border-indigo-800 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {t.user_id[0]?.toUpperCase() ?? '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate font-mono text-xs">{t.user_id}</p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{t.item_name ?? '—'}</p>
                        </div>
                      </div>
                      <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100 flex-shrink-0">
                        ₹{t.final_amount.toLocaleString('en-IN')}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border',
                            statusMeta.cls,
                          )}
                        >
                          <StatusIcon className="w-2.5 h-2.5" />
                          {statusMeta.label}
                        </span>
                        {t.promo_code && (
                          <code className="text-[9px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-1 py-0.5 rounded">
                            {t.promo_code}
                          </code>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500">
                        {new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {filtered.length > 0 && (
            <>
              <div ref={txSentinelRef} className="h-1" />
              <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
                {txHasMore ? `Loading more… (${txShown} of ${txTotal})` : `All ${txTotal} transactions loaded`}
              </p>
            </>
          )}
        </div>
      </div>

      {selected && (
        <TxnDetailModal
          txn={selected}
          onClose={() => setSelected(null)}
          onRefund={(id) => refund.mutate(id)}
        />
      )}
    </GenVerseShell>
  );
}

function DonutLegend({
  color,
  label,
  value,
  pct,
}: {
  color: 'indigo' | 'emerald';
  label: string;
  value: number;
  pct: number;
}) {
  const cls = color === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <span className={cn('w-2.5 h-2.5 rounded-sm flex-shrink-0', cls)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{label}</p>
          <p className="text-xs font-bold tabular-nums text-gray-900 dark:text-gray-100">{pct}%</p>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
          ₹{value.toLocaleString('en-IN')}
        </p>
      </div>
    </div>
  );
}

function MiniKpi({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'indigo' | 'emerald' | 'red' | 'amber';
}) {
  const TONE: Record<typeof tone, string> = {
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    red: 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover-lift transition-all">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center', TONE[tone])}>
          {icon}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border',
        active
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-sm shadow-indigo-200/40'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700',
      )}
    >
      {children}
    </button>
  );
}

function TxnDetailModal({ txn, onClose, onRefund }: { txn: PaymentTxnOut; onClose: () => void; onRefund?: (id: string) => void }) {
  const statusMeta = STATUS_META[txn.payment_status] ?? STATUS_META.success;
  const StatusIcon = statusMeta.icon;
  const method = txn.payment_method ?? '';
  const MethodIcon = METHOD_ICON[method] ?? CreditCard;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-scaleIn max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative p-5 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 bg-[length:200%_auto] animate-gradient-x text-white">
          <div className="absolute inset-0 bg-soft-dots opacity-15" />
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold opacity-90">Transaction Detail</p>
            <p className="text-xl font-bold mt-1 font-mono">{txn.invoice_no ?? txn.txn_id}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur">
                <StatusIcon className="w-3 h-3" />
                {statusMeta.label}
              </span>
              <span className="text-[10px] opacity-90">
                {new Date(txn.created_at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <DetailGroup label="Customer">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-sm">
                {txn.user_id[0]?.toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">—</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">—</p>
                <p className="text-[10px] font-mono text-gray-400 dark:text-gray-500">{txn.user_id}</p>
              </div>
            </div>
          </DetailGroup>

          <DetailGroup label="Purchase">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center justify-center w-7 h-7 rounded-lg text-white shadow-sm',
                    txn.payment_type === 'subscription'
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-500'
                      : 'bg-gradient-to-br from-emerald-500 to-teal-500',
                  )}
                >
                  {txn.payment_type === 'subscription' ? <Sparkles className="w-4 h-4" /> : <ClipboardCheck className="w-4 h-4" />}
                </span>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{txn.item_name ?? '—'}</p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 ml-9 capitalize">
                {txn.payment_type} · ID: <span className="font-mono">{txn.item_id ?? '—'}</span>
              </p>
              {txn.gateway_txn_ref && (
                <p className="text-xs text-gray-500 dark:text-gray-400 ml-9">
                  Gateway ref: <span className="font-mono">{txn.gateway_txn_ref}</span>
                </p>
              )}
            </div>
          </DetailGroup>

          <DetailGroup label="Amount breakdown">
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center justify-between text-gray-700 dark:text-gray-300">
                <span>Base amount</span>
                <span className="tabular-nums">₹{txn.base_amount.toLocaleString('en-IN')}</span>
              </div>
              {txn.discount_amount > 0 && (
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400">
                  <span className="inline-flex items-center gap-1">
                    <Tag className="w-3 h-3" />
                    Discount {txn.promo_code && <code className="bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-1 rounded text-[10px]">{txn.promo_code}</code>}
                  </span>
                  <span className="tabular-nums font-medium">−₹{txn.discount_amount.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-1.5 flex items-center justify-between text-base font-bold text-gray-900 dark:text-gray-100">
                <span>Final paid</span>
                <span className="tabular-nums">₹{txn.final_amount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </DetailGroup>

          <DetailGroup label="Payment">
            <div className="flex items-center gap-2 text-sm">
              <MethodIcon className="w-4 h-4 text-gray-400" />
              <span className="text-gray-700 dark:text-gray-300">{method ? (METHOD_LABEL[method] ?? method) : '—'}</span>
              {txn.gateway && <span className="text-[10px] text-gray-400 dark:text-gray-500">via {txn.gateway}</span>}
            </div>
          </DetailGroup>

          <div className="flex items-center gap-2">
            {txn.payment_status === 'success' && onRefund && (
              <button
                onClick={() => { onRefund(txn.txn_id); onClose(); }}
                className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-3 py-2 rounded-lg transition-colors press border border-amber-200 dark:border-amber-900"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Refund
              </button>
            )}
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(txn, null, 2));
                toast.success('Transaction JSON copied');
              }}
              className="flex-1 flex items-center justify-center gap-2 text-xs font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg transition-colors press"
            >
              <Receipt className="w-3.5 h-3.5" />
              Copy transaction JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      <div className="bg-gray-50/60 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl p-3">
        {children}
      </div>
    </div>
  );
}
