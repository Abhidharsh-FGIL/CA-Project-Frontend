import { useMemo, useState } from 'react';
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
import { usersApi, type AdminUserOut } from '@/lib/adminApi';
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
    color: 'from-indigo-500 to-purple-500',
    pill: 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300',
    label: 'Ultimate',
  },
  premium: {
    icon: Crown,
    color: 'from-amber-500 to-orange-500',
    pill: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
    label: 'Premium',
  },
};

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
      total: users.length,
      active: users.filter(u => u.is_active && !u.account_locked && !u.account_suspended).length,
      locked: users.filter(u => u.account_locked).length,
      premium: users.filter(u => u.subscription_tier === 'premium').length,
      paying: users.filter(u => u.subscription_tier !== 'free').length,
      expiringSoon: users.filter(u => {
        if (u.subscription_tier === 'free' || !u.subscription_expiry) return false;
        const days = (new Date(u.subscription_expiry).getTime() - Date.now()) / 86_400_000;
        return days > 0 && days <= 7;
      }).length,
    };
  }, [users]);

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
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-3 py-2 rounded-lg shadow-md press"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        }
      />

      <div className="space-y-5 pb-6">
        {usersLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatChip icon={<Users />} label="Total Users" value={stats.total} tone="indigo" />
          <StatChip icon={<UserCheck />} label="Active" value={stats.active} tone="emerald" />
          <StatChip icon={<Crown />} label="Paying Users" value={stats.paying} tone="amber" sub={`${stats.premium} on Premium`} />
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
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <Chip active={tierFilter === 'all'} onClick={() => setTierFilter('all')}>All Tiers</Chip>
              {(['free', 'standard', 'ultimate', 'premium'] as SubscriptionTier[]).map(t => (
                <Chip key={t} active={tierFilter === t} onClick={() => setTierFilter(t)}>
                  {TIER_META[t].label}
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
              <thead className="bg-gradient-to-r from-gray-50 to-indigo-50/30 dark:from-gray-800/60 dark:to-indigo-950/30 border-b border-gray-100 dark:border-gray-800">
                <tr className="text-left text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Subscription Expiry</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3 text-right">Spent</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
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
                        className="border-b border-gray-50 dark:border-gray-800 hover:bg-gradient-to-r hover:from-indigo-50/40 hover:to-purple-50/40 dark:hover:from-indigo-950/20 dark:hover:to-purple-950/20 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm">
                              {u.name[0]}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.name}</p>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider', tierMeta.pill)}>
                            <TierIcon className="w-2.5 h-2.5" />
                            {tierMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', statusMeta.cls)}>
                            <StatusIcon className="w-3 h-3" />
                            {statusMeta.label}
                          </span>
                          {!u.otp_verified && (
                            <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5">Not verified</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                          {u.subscription_tier === 'free' || !u.subscription_expiry ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <div className={cn('inline-flex items-center gap-1', expiringSoon && 'text-rose-600 dark:text-rose-400')}>
                              {expiringSoon && <AlertTriangle className="w-3 h-3" />}
                              {new Date(u.subscription_expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                          <p className="inline-flex items-center gap-1">
                            <ClipboardCheck className="w-3 h-3 text-gray-400" />
                            {u.total_attempts} {u.total_attempts === 1 ? 'test' : 'tests'}
                          </p>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                            {u.last_login
                              ? `Last: ${new Date(u.last_login).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                              : 'Never signed in'}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                            ₹0
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {u.account_suspended ? (
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                reactivate.mutate(u.user_id);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-2 py-1 rounded-md"
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
                className="w-full bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 text-left hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                    {u.name[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">₹0</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider', tierMeta.pill)}>
                    <TierIcon className="w-2.5 h-2.5" />
                    {tierMeta.label}
                  </span>
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
}: {
  user: AdminUserOut;
  onClose: () => void;
  onToggleLock: () => void;
  onToggleSuspend: () => void;
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
              value={tierMeta.label}
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
              value="₹0"
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
                : 'Never'}
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
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
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
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
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
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-sm'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700',
      )}
    >
      {children}
    </button>
  );
}
