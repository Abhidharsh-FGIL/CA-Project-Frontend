import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Search,
  Filter,
  Download,
  Users,
  UserCheck,
  Lock,
  LockOpen,
  Crown,
  Sparkles,
  Star,
  Phone,
  Mail,
  X,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Ban,
  ClipboardCheck,
  IndianRupee,
  ShieldOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAdminUsers, useAdminUserActions } from '@/hooks/use-admin-users';
import { usersApi, paymentsApi, type AdminUserOut, type PaymentTxnOut, type PlanOut } from '@/lib/adminApi';
import { useAdminPlans } from '@/hooks/use-admin-plans';
import type { SubscriptionTier } from '@/data/userPortalSampleData';
import { useInfiniteList } from '@/hooks/use-infinite-list';

type UserStatus = 'active' | 'locked' | 'suspended';

const STATUS_META: Record<UserStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  active: {
    label: 'Active',
    cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
    icon: CheckCircle2,
  },
  locked: {
    label: 'Locked',
    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    icon: Lock,
  },
  suspended: {
    label: 'Suspended',
    cls: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900',
    icon: Ban,
  },
};

const TIER_META: Record<SubscriptionTier, { icon: typeof Sparkles; color: string; pill: string; label: string }> = {
  free: {
    icon: Star,
    color: 'from-gray-400 to-gray-500',
    pill: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
    label: 'Free',
  },
  standard: {
    icon: Sparkles,
    color: 'from-blue-500 to-cyan-500',
    pill: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300',
    label: 'Standard',
  },
  ultimate: {
    icon: Sparkles,
    color: 'from-brand-500 to-brand-400',
    pill: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-brand-300',
    label: 'Ultimate',
  },
  premium: {
    icon: Crown,
    color: 'from-amber-500 to-orange-500',
    pill: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
    label: 'Premium',
  },
};

/**
 * Monthly or Yearly, for a paid user. The server's own `billing_cycle` when it sends one; otherwise worked out
 * from the plan's start and end; otherwise, with only the end date, "Yearly" when more than two months are left
 * (no monthly plan runs that long). Null when it cannot be told.
 */
function cycleOf(u: AdminUserOut): 'monthly' | 'yearly' | null {
  if (u.subscription_tier === 'free') return null;
  if (u.billing_cycle) return u.billing_cycle;
  if (u.subscription_start && u.subscription_expiry) {
    const days = (Date.parse(u.subscription_expiry) - Date.parse(u.subscription_start)) / 86_400_000;
    if (Number.isFinite(days) && days > 0) return days > 60 ? 'yearly' : 'monthly';
  }
  if (u.subscription_expiry && (Date.parse(u.subscription_expiry) - Date.now()) / 86_400_000 > 62) return 'yearly';
  return null;
}

function CycleTag({ user }: { user: AdminUserOut }) {
  const cycle = cycleOf(user);
  if (!cycle) return null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold',
        cycle === 'yearly'
          ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900'
          : 'bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900',
      )}
    >
      {cycle === 'yearly' ? 'Yearly' : 'Monthly'}
    </span>
  );
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** The last ten digits of a mobile number, so "+91 97890 33463" and "9789033463" are the same. */
const phoneKey = (phone: string | null | undefined) => {
  const d = (phone ?? '').replace(/\D/g, '');
  return d.length >= 10 ? d.slice(-10) : null;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * What a user has spent. Their recorded payments when there are any. A paid user with none on record (a plan given
 * by an admin, or bought before payments were logged) is shown at the current price of their plan and billing
 * cycle, from the backend's plan list, marked as such.
 */
function spendFor(
  u: AdminUserOut,
  paid: Map<string, number> | undefined,
  plans: PlanOut[] | undefined,
): { text: string; fromPlan: boolean; cycle: 'monthly' | 'yearly' | null } {
  const recorded = paid?.get(String(u.user_id)) ?? 0;
  if (recorded > 0) return { text: inr(recorded), fromPlan: false, cycle: null };
  if (u.subscription_tier !== 'free') {
    const plan = plans?.find(p => p.name === u.subscription_tier);
    if (plan) {
      const cycle = cycleFromPlan(u, plan);
      const price = cycle === 'yearly' ? plan.price_yearly : plan.price_monthly || plan.price;
      if (price > 0) return { text: inr(price), fromPlan: true, cycle };
    }
  }
  return { text: paid ? inr(0) : '—', fromPlan: false, cycle: null };
}

/** Monthly or yearly — the user's own, or the plan duration their dates are nearest to. Monthly when unknown. */
function cycleFromPlan(u: AdminUserOut, plan: PlanOut): 'monthly' | 'yearly' {
  const known = cycleOf(u);
  if (known) return known;
  if (u.subscription_start && u.subscription_expiry) {
    const days = (Date.parse(u.subscription_expiry) - Date.parse(u.subscription_start)) / 86_400_000;
    if (Number.isFinite(days) && plan.duration_days_monthly && plan.duration_days_yearly) {
      return Math.abs(days - plan.duration_days_yearly) < Math.abs(days - plan.duration_days_monthly) ? 'yearly' : 'monthly';
    }
  }
  return 'monthly';
}

function SpentCell({ spend }: { spend: ReturnType<typeof spendFor> }) {
  return (
    <div
      className="text-right"
      title={spend.fromPlan ? 'No payment on record for this user — this is the current price of their plan' : undefined}
    >
      <p className={cn('text-sm font-bold tabular-nums', spend.fromPlan ? 'text-gray-600 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100')}>
        {spend.text}
      </p>
      {spend.fromPlan && (
        <p className="text-[9px] text-gray-400 whitespace-nowrap">{spend.cycle === 'yearly' ? 'Yearly' : 'Monthly'} plan price</p>
      )}
    </div>
  );
}

/**
 * What each user has paid: every successful transaction's final amount, summed per user. Refunded and failed
 * payments count for nothing. The list is read page by page, so every transaction is counted.
 */
function useSpendByUser() {
  return useQuery({
    queryKey: ['admin-users-spend'],
    staleTime: 60 * 1000,
    queryFn: async () => {
      const all: PaymentTxnOut[] = [];
      for (let page = 1; page <= 50; page++) {
        const res = await paymentsApi.list({ page, limit: 100 });
        all.push(...(res?.items ?? []));
        if (!res || page >= (res.pages ?? 1) || (res.items ?? []).length === 0) break;
      }
      const spend = new Map<string, number>();
      all.forEach(t => {
        if (String(t.payment_status).toLowerCase() !== 'success') return;
        spend.set(String(t.user_id), (spend.get(t.user_id) ?? 0) + (Number(t.final_amount) || 0));
      });
      return spend;
    },
  });
}

export default function AdminUsersPage() {
  const [page] = useState(1);
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | SubscriptionTier>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: usersData, isLoading: usersLoading } = useAdminUsers({
    search: search || undefined,
    tier: tierFilter !== 'all' ? tierFilter : undefined,
    is_active: statusFilter === 'active' ? true : undefined,
    account_suspended: statusFilter === 'suspended' ? true : undefined,
    page,
    limit: 100,
  });
  const users: AdminUserOut[] = usersData?.items ?? [];
  // The cards count every user, whatever the filters below show — the same request with no filters.
  const { data: allData } = useAdminUsers({ page: 1, limit: 100 });
  const everyone: AdminUserOut[] = allData?.items ?? [];
  const { data: spendByUser, isError: spendFailed } = useSpendByUser();
  // "—" until the payments are in (or when they could not be read), never a ₹0 that is not known to be true.
  const { data: plans } = useAdminPlans();
  const spendOf = (u: AdminUserOut) => spendFor(u, spendByUser, plans);
  const tierCount = (tier: SubscriptionTier) => everyone.filter(u => u.subscription_tier === tier).length;
  // Under "Paying users": how they split across the paid plans people are actually on — "22 Standard · 3 Ultimate".
  const paidBreakdown = (Object.keys(TIER_META) as SubscriptionTier[])
    .filter(t => t !== 'free' && tierCount(t) > 0)
    .map(t => `${tierCount(t)} ${TIER_META[t].label}`)
    .join(' · ');
  /**
   * The tier filters: the plans switched on in the backend, plus any tier users are still on (a switched-off plan
   * with holders, or Free). Nothing else — a tier no plan offers and nobody holds is not a filter. Cheapest first.
   */
  const tierChips = useMemo(() => {
    const held = new Set(everyone.map(u => u.subscription_tier));
    const price = (t: string) => {
      const p = plans?.find(x => x.name === t);
      return p ? p.price_monthly || p.price || 0 : t === 'free' ? -1 : Number.MAX_SAFE_INTEGER;
    };
    const tiers = new Set<string>([...(plans ?? []).filter(p => p.active).map(p => p.name), ...held]);
    return [...tiers]
      .filter((t): t is SubscriptionTier => t in TIER_META)
      .sort((a, b) => price(a) - price(b))
      .map(t => ({ tier: t, label: TIER_META[t].label, active: plans?.find(p => p.name === t)?.active ?? t === 'free' }));
  }, [plans, everyone]);
  const spentOf = (u: AdminUserOut) => spendOf(u).text;
  if (spendFailed) console.warn('[Users] could not read payments for the Spent column');
  // How many accounts each mobile number is on — one person signing up again under a new email.
  const phoneCount = useMemo(() => {
    const m = new Map<string, number>();
    everyone.forEach(u => {
      const k = phoneKey(u.phone);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    });
    return m;
  }, [everyone]);
  const sharedPhone = (u: AdminUserOut) => {
    const k = phoneKey(u.phone);
    return k ? (phoneCount.get(k) ?? 0) > 1 : false;
  };
  // Derive selected from the live list so the modal always reflects post-mutation state
  const selected = users.find(u => u.user_id === selectedId) ?? null;
  const { lock, unlock, suspend, reactivate } = useAdminUserActions();

  const filtered = useMemo(() => {
    // 'locked' has no backend filter param — apply client-side
    if (statusFilter === 'locked') return users.filter(u => u.account_locked);
    return users;
  }, [users, statusFilter]);

  const { visible: visibleUsers, sentinelRef: usersSentinelRef, hasMore: usersHasMore, shown: usersShown, total: usersTotal } = useInfiniteList<AdminUserOut>(filtered, 25);

  const stats = useMemo(() => {
    return {
      total: allData?.total ?? everyone.length,
      active: everyone.filter(u => u.is_active && !u.account_locked && !u.account_suspended).length,
      locked: everyone.filter(u => u.account_locked).length,
      paying: everyone.filter(u => u.subscription_tier !== 'free').length,
      expiringSoon: everyone.filter(u => {
        if (u.subscription_tier === 'free' || !u.subscription_expiry) return false;
        const days = (new Date(u.subscription_expiry).getTime() - Date.now()) / 86_400_000;
        return days > 0 && days <= 7;
      }).length,
    };
  }, [everyone, allData?.total]);

  const toggleLock = (user: AdminUserOut) => {
    if (user.account_locked) {
      unlock.mutate(user.user_id);
    } else {
      lock.mutate(user.user_id);
    }
  };

  const toggleSuspend = (user: AdminUserOut) => {
    if (user.account_suspended) {
      reactivate.mutate(user.user_id);
    } else {
      suspend.mutate({ userId: user.user_id });
    }
  };

  const exportCSV = () => {
    usersApi.exportCsv();
    toast.success('Exporting users CSV…');
  };

  return (
    <GenVerseShell>
      <PageHeader
        title="User Management"
        description="View, filter, and moderate platform users."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Users' }]}
        actions={
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-brand-600 to-brand-400 hover:from-brand-700 hover:to-brand-500 text-white px-3 py-2 rounded-lg shadow-md press"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        }
      />

      <div className="space-y-5 pb-6">
        {usersLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-200 dark:border-blue-900 border-t-brand-600 dark:border-t-blue-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatChip icon={<Users />} label="Total Users" value={stats.total} tone="indigo" />
          <StatChip icon={<UserCheck />} label="Active" value={stats.active} tone="emerald" />
          <StatChip icon={<Crown />} label="Paying Users" value={stats.paying} tone="amber" sub={paidBreakdown || undefined} />
          <StatChip icon={<AlertTriangle />} label="Expiring ≤7d" value={stats.expiringSoon} tone="rose" />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, email, or phone…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 dark:focus:ring-brand-700"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <Chip active={tierFilter === 'all'} onClick={() => setTierFilter('all')}>All Tiers</Chip>
              {tierChips.map(t => (
                <Chip key={t.tier} active={tierFilter === t.tier} onClick={() => setTierFilter(t.tier)}>
                  <span className={cn(!t.active && 'line-through opacity-70')} title={t.active ? undefined : 'This plan is switched off'}>
                    {t.label}
                  </span>
                  <span className={cn('ml-1 tabular-nums', tierFilter === t.tier ? 'text-white/80' : 'text-gray-400')}>
                    {tierCount(t.tier)}
                  </span>
                </Chip>
              ))}
              <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
              <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All Status</Chip>
              <Chip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>Active</Chip>
              <Chip active={statusFilter === 'locked'} onClick={() => setStatusFilter('locked')}>Locked</Chip>
              <Chip active={statusFilter === 'suspended'} onClick={() => setStatusFilter('suspended')}>Suspended</Chip>
            </div>
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-800/60 dark:to-blue-950/30 border-b border-gray-100 dark:border-gray-800">
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                  <th className="px-3 py-3">Name</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Phone</th>
                  <th className="px-3 py-3">Subscription</th>
                  <th className="px-3 py-3">Joined On</th>
                  <th className="px-3 py-3">Expiry</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Activity</th>
                  <th className="px-3 py-3 text-right">Spent</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
                      <Users className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">No users match the filters</p>
                    </td>
                  </tr>
                ) : (
                  visibleUsers.map(u => {
                    const tierMeta = TIER_META[u.subscription_tier];
                    const TierIcon = tierMeta.icon;
                    const derivedStatus: UserStatus = u.account_locked ? 'locked' : u.account_suspended ? 'suspended' : 'active';
                    const statusMeta = STATUS_META[derivedStatus];
                    const StatusIcon = statusMeta.icon;
                    const days = u.subscription_expiry ? (new Date(u.subscription_expiry).getTime() - Date.now()) / 86_400_000 : -1;
                    const expiringSoon = u.subscription_tier !== 'free' && days > 0 && days <= 7;
                    return (
                      <tr
                        key={u.user_id}
                        onClick={() => setSelectedId(u.user_id)}
                        className="border-b border-gray-50 dark:border-gray-800 hover:bg-gradient-to-r hover:from-blue-50/40 hover:to-purple-50/40 dark:hover:from-blue-950/20 dark:hover:to-purple-950/20 cursor-pointer transition-colors"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
                              {u.name[0]}
                            </div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 max-w-[160px] truncate" title={u.name}>
                              {u.name}
                            </p>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300">
                          <span className="block max-w-[220px] truncate" title={u.email}>{u.email}</span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap tabular-nums">
                          {u.phone || <span className="text-gray-400">—</span>}
                          {sharedPhone(u) && (
                            <button
                              type="button"
                              title="This number is on more than one account — click to list them"
                              onClick={e => {
                                e.stopPropagation();
                                setSearch(phoneKey(u.phone) ?? '');
                              }}
                              className="mt-0.5 block text-[9px] font-semibold text-violet-600 hover:underline dark:text-violet-400"
                            >
                              Duplicate phone ({phoneCount.get(phoneKey(u.phone)!)})
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-start gap-1">
                            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', tierMeta.pill)}>
                              <TierIcon className="w-2.5 h-2.5" />
                              {tierMeta.label}
                            </span>
                            <CycleTag user={u} />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {fmtDate(u.created_at)}
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {u.subscription_tier === 'free' || !u.subscription_expiry ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <div className={cn('inline-flex items-center gap-1', expiringSoon && 'text-rose-600 dark:text-rose-400')}>
                              {expiringSoon && <AlertTriangle className="w-3 h-3" />}
                              {fmtDate(u.subscription_expiry)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', statusMeta.cls)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-xs text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          <p className="inline-flex items-center gap-1">
                            <ClipboardCheck className="w-3 h-3 text-gray-400" />
                            {u.total_attempts} {u.total_attempts === 1 ? 'test' : 'tests'}
                          </p>
                          {u.last_login && (
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Last: {fmtDate(u.last_login)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <SpentCell spend={spendOf(u)} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.account_suspended ? (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                reactivate.mutate(u.user_id);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold bg-brand-600 hover:bg-brand-700 text-white px-2 py-1 rounded-md"
                            >
                              Unsuspend
                            </button>
                          ) : (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                suspend.mutate({ userId: u.user_id });
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-600 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 rounded-md"
                            >
                              <ShieldOff className="w-3 h-3" /> Suspend
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {visibleUsers.map(u => {
            const tierMeta = TIER_META[u.subscription_tier];
            const TierIcon = tierMeta.icon;
            const derivedStatus: UserStatus = u.account_locked ? 'locked' : u.account_suspended ? 'suspended' : 'active';
            const statusMeta = STATUS_META[derivedStatus];
            const StatusIcon = statusMeta.icon;
            return (
              <button
                key={u.user_id}
                onClick={() => setSelectedId(u.user_id)}
                className="w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 text-left hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {u.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {u.phone || 'No phone'} · Joined {fmtDate(u.created_at)}
                      {u.subscription_tier !== 'free' && u.subscription_expiry ? ` · Expires ${fmtDate(u.subscription_expiry)}` : ''}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{spentOf(u)}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider', tierMeta.pill)}>
                    <TierIcon className="w-2.5 h-2.5" />
                    {tierMeta.label}
                  </span>
                  <CycleTag user={u} />
                  <span className={cn('inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border', statusMeta.cls)}>
                    <StatusIcon className="w-2.5 h-2.5" />
                    {statusMeta.label}
                  </span>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 ml-auto">
                    {u.total_attempts} {u.total_attempts === 1 ? 'test' : 'tests'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length > 0 && (
          <>
            <div ref={usersSentinelRef} className="h-1" />
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
              {usersHasMore ? `Loading more… (${usersShown} of ${usersTotal})` : `All ${usersTotal} users loaded`}
            </p>
          </>
        )}
      </div>

      {selected && (
        <UserDetailModal
          user={selected}
          onClose={() => setSelectedId(null)}
          onToggleLock={() => toggleLock(selected)}
          onToggleSuspend={() => toggleSuspend(selected)}
          spent={spendOf(selected).fromPlan ? `${spentOf(selected)} (plan price — no payment on record)` : spentOf(selected)}
        />
      )}
    </GenVerseShell>
  );
}

function UserDetailModal({
  user,
  onClose,
  onToggleLock,
  onToggleSuspend,
  spent,
}: {
  user: AdminUserOut;
  onClose: () => void;
  onToggleLock: () => void;
  onToggleSuspend: () => void;
  spent: string;
}) {
  const tierMeta = TIER_META[user.subscription_tier];
  const TierIcon = tierMeta.icon;
  const derivedStatus: UserStatus = user.account_locked ? 'locked' : user.account_suspended ? 'suspended' : 'active';
  const statusMeta = STATUS_META[derivedStatus];
  const StatusIcon = statusMeta.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-scaleIn max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className={cn('relative p-5 bg-gradient-to-br text-white bg-[length:200%_auto] animate-gradient-x', tierMeta.color)}>
          <div className="absolute inset-0 bg-soft-dots opacity-15" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-xl font-bold">
              {user.name[0]}
            </div>
            <div>
              <h2 className="text-lg font-bold">{user.name}</h2>
              <p className="text-xs opacity-90">{user.user_id}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur">
                  <TierIcon className="w-2.5 h-2.5" />
                  {tierMeta.label}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 backdrop-blur">
                  <StatusIcon className="w-2.5 h-2.5" />
                  {statusMeta.label}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <DetailGroup label="Contact">
            <DetailRow icon={<Mail className="w-3.5 h-3.5" />} value={user.email} />
            <DetailRow icon={<Phone className="w-3.5 h-3.5" />} value={user.phone ?? '—'} />
          </DetailGroup>

          <DetailGroup label="Subscription">
            <DetailRow
              icon={<TierIcon className="w-3.5 h-3.5" />}
              label="Plan"
              value={cycleOf(user) ? `${tierMeta.label} · ${cycleOf(user) === 'yearly' ? 'Yearly' : 'Monthly'}` : tierMeta.label}
            />
            <DetailRow
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Expiry"
              value={
                user.subscription_tier === 'free' || !user.subscription_expiry
                  ? '—'
                  : new Date(user.subscription_expiry).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
              }
            />
          </DetailGroup>

          <DetailGroup label="Activity">
            <DetailRow
              icon={<ClipboardCheck className="w-3.5 h-3.5" />}
              label="Total Attempts"
              value={String(user.total_attempts)}
            />
            <DetailRow
              icon={<IndianRupee className="w-3.5 h-3.5" />}
              label="Lifetime Spend"
              value={spent}
            />
            <DetailRow
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Joined"
              value={new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            />
            <DetailRow
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Last Login"
              value={user.last_login
                ? new Date(user.last_login).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : '—'}
            />
          </DetailGroup>

          <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              onClick={onToggleLock}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors',
                user.account_locked
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-300',
              )}
            >
              {user.account_locked ? (
                <><LockOpen className="w-3.5 h-3.5" /> Unlock Account</>
              ) : (
                <><Lock className="w-3.5 h-3.5" /> Lock Account</>
              )}
            </button>
            <button
              onClick={onToggleSuspend}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition-colors',
                user.account_suspended
                  ? 'bg-brand-600 hover:bg-brand-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-700 dark:text-gray-300 hover:text-red-700 dark:hover:text-red-300',
              )}
            >
              {user.account_suspended ? (
                <>
                  <UserCheck className="w-3.5 h-3.5" /> Unsuspend
                </>
              ) : (
                <>
                  <ShieldOff className="w-3.5 h-3.5" /> Suspend
                </>
              )}
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
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
      <div className="bg-gray-50/60 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl p-3 space-y-1.5">{children}</div>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label?: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">{icon}</span>
      {label && <span className="text-gray-500 dark:text-gray-400 min-w-[110px]">{label}</span>}
      <span className="text-gray-900 dark:text-gray-100 font-medium tabular-nums truncate">{value}</span>
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose';
  sub?: string;
}) {
  const TONE: Record<typeof tone, string> = {
    indigo: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    rose: 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400',
  };
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover-lift">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5', TONE[tone])}>
          {icon}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{sub}</p>}
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
          ? 'bg-gradient-to-r from-brand-600 to-brand-400 text-white border-transparent shadow-sm'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-brand-700',
      )}
    >
      {children}
    </button>
  );
}
