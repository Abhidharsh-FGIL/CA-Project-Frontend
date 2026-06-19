import { useMemo, useState } from 'react';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Search,
  Plus,
  Tag,
  Copy,
  Pause,
  Play,
  Trash2,
  Filter,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  PauseCircle,
  TrendingUp,
  Sparkles,
  ClipboardCheck,
  Globe,
  Calendar,
  Infinity as InfinityIcon,
  Percent,
  Edit2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAdminPromos, useAdminPromoActions } from '@/hooks/use-admin-promos';
import { type PromoCodeOut, type PromoScope, type PromoStatus } from '@/lib/adminApi';

const STATUS_META: Record<PromoStatus, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  active: {
    label: 'Active',
    cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
    icon: CheckCircle2,
  },
  expired: {
    label: 'Expired',
    cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
    icon: Clock,
  },
  exhausted: {
    label: 'Exhausted',
    cls: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900',
    icon: XCircle,
  },
  paused: {
    label: 'Paused',
    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
    icon: PauseCircle,
  },
};

const SCOPE_META: Record<PromoScope, { label: string; icon: typeof ClipboardCheck; bandBg: string; chipBg: string; accentText: string }> = {
  test: {
    label: 'Test',
    icon: ClipboardCheck,
    bandBg: 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-b border-emerald-100 dark:border-emerald-900/40',
    chipBg: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
    accentText: 'text-emerald-700 dark:text-emerald-300',
  },
  subscription: {
    label: 'Subscription',
    icon: Sparkles,
    bandBg: 'bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-b border-indigo-100 dark:border-indigo-900/40',
    chipBg: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
    accentText: 'text-indigo-700 dark:text-indigo-300',
  },
  platform: {
    label: 'Platform-wide',
    icon: Globe,
    bandBg: 'bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-b border-amber-100 dark:border-amber-900/40',
    chipBg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
    accentText: 'text-amber-700 dark:text-amber-300',
  },
};

export default function AdminPromosPage() {
  const { data: promosData, isLoading: promosLoading } = useAdminPromos(1, 100);
  const promos: PromoCodeOut[] = promosData?.items ?? [];
  const promoActions = useAdminPromoActions();

  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<'all' | PromoScope>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | PromoStatus>('all');
  const [editing, setEditing] = useState<PromoCodeOut | 'new' | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PromoCodeOut | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return promos
      .filter(p => scopeFilter === 'all' || p.scope === scopeFilter)
      .filter(p => statusFilter === 'all' || p.promo_status === statusFilter)
      .filter(p => !q || p.code_string.toLowerCase().includes(q));
  }, [promos, scopeFilter, statusFilter, search]);

  const { visible: visiblePromos, sentinelRef: promoSentinelRef, hasMore: promoHasMore, shown: promoShown, total: promoTotal } = useInfiniteList(filtered, 24);

  const stats = useMemo(() => {
    const active = promos.filter(p => p.promo_status === 'active').length;
    const expired = promos.filter(p => p.promo_status === 'expired').length;
    const exhausted = promos.filter(p => p.promo_status === 'exhausted').length;
    const totalRedemptions = promos.reduce((s, p) => s + p.used_count, 0);
    return { active, expired, exhausted, totalRedemptions };
  }, [promos]);

  const handleSave = (promo: PromoCodeOut) => {
    const isNew = !promos.some(p => p.code_id === promo.code_id);
    if (isNew) {
      promoActions.create.mutate({
        code_string: promo.code_string,
        scope: promo.scope,
        discount_pct: promo.discount_pct,
        max_uses: promo.max_uses === -1 ? undefined : promo.max_uses,
        expiry_date: promo.expiry_date ?? undefined,
        test_id: promo.test_id ?? undefined,
        applies_to_tiers: promo.applies_to_tiers ?? undefined,
        applies_to_billing: promo.applies_to_billing ?? undefined,
      });
    } else {
      promoActions.update.mutate({
        codeId: promo.code_id,
        payload: {
          scope: promo.scope,
          discount_pct: promo.discount_pct,
          max_uses: promo.max_uses === -1 ? undefined : promo.max_uses,
          expiry_date: promo.expiry_date,
          test_id: promo.test_id ?? undefined,
        },
      });
    }
    setEditing(null);
  };

  const togglePause = (promo: PromoCodeOut) => {
    if (promo.promo_status === 'active') {
      promoActions.pause.mutate(promo.code_id);
    } else {
      promoActions.resume.mutate(promo.code_id);
    }
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    promoActions.delete.mutate(pendingDelete.code_id);
    setPendingDelete(null);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`${code} copied`);
  };

  return (
    <GenVerseShell>
      <PageHeader
        title="Promo Code Management"
        description="Create, track, and manage promo codes."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Promo Codes' }]}
        actions={
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-3 py-2 rounded-lg shadow-md shadow-indigo-200/40 press"
          >
            <Plus className="w-3.5 h-3.5" /> New Code
          </button>
        }
      />

      <div className="space-y-5 pb-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatChip icon={<CheckCircle2 />} label="Active Codes" value={stats.active} tone="emerald" />
          <StatChip icon={<TrendingUp />} label="Total Redemptions" value={stats.totalRedemptions.toLocaleString('en-IN')} tone="indigo" />
          <StatChip icon={<Clock />} label="Expired" value={stats.expired} tone="gray" />
          <StatChip icon={<XCircle />} label="Exhausted" value={stats.exhausted} tone="rose" />
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
                placeholder="Search by code or test name…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <Chip active={scopeFilter === 'all'} onClick={() => setScopeFilter('all')}>All Scopes</Chip>
              <Chip active={scopeFilter === 'test'} onClick={() => setScopeFilter('test')}>Test</Chip>
              <Chip active={scopeFilter === 'subscription'} onClick={() => setScopeFilter('subscription')}>Subscription</Chip>
              <Chip active={scopeFilter === 'platform'} onClick={() => setScopeFilter('platform')}>Platform</Chip>
              <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
              <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All Status</Chip>
              <Chip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>Active</Chip>
              <Chip active={statusFilter === 'paused'} onClick={() => setStatusFilter('paused')}>Paused</Chip>
              <Chip active={statusFilter === 'expired'} onClick={() => setStatusFilter('expired')}>Expired</Chip>
              <Chip active={statusFilter === 'exhausted'} onClick={() => setStatusFilter('exhausted')}>Exhausted</Chip>
            </div>
          </div>
        </div>

        {/* Grid */}
        {promosLoading ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center">
            <Loader2 className="w-10 h-10 text-indigo-400 mx-auto animate-spin mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading promo codes…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center">
            <Tag className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No promo codes match the filters.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visiblePromos.map(promo => (
              <PromoCard
                key={promo.code_id}
                promo={promo}
                onEdit={() => setEditing(promo)}
                onCopy={() => copyCode(promo.code_string)}
                onTogglePause={() => togglePause(promo)}
                onDelete={() => setPendingDelete(promo)}
              />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <>
            <div ref={promoSentinelRef} className="h-1" />
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
              {promoHasMore ? `Loading more… (${promoShown} of ${promoTotal})` : `All ${promoTotal} promo codes loaded`}
            </p>
          </>
        )}
      </div>

      {editing && (
        <PromoEditor
          promo={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={open => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete promo code?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-mono font-semibold">{pendingDelete?.code_string}</span>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GenVerseShell>
  );
}

function PromoCard({
  promo,
  onEdit,
  onCopy,
  onTogglePause,
  onDelete,
}: {
  promo: PromoCodeOut;
  onEdit: () => void;
  onCopy: () => void;
  onTogglePause: () => void;
  onDelete: () => void;
}) {
  const sMeta = STATUS_META[promo.promo_status] ?? STATUS_META.active;
  const StatusIcon = sMeta.icon;
  const scopeMeta = SCOPE_META[promo.scope] ?? SCOPE_META.platform;
  const ScopeIcon = scopeMeta.icon;
  // API uses -1 for unlimited; treat -1 and 0 as no limit
  const effectiveMaxUses = promo.max_uses > 0 ? promo.max_uses : null;
  const usagePct = effectiveMaxUses ? Math.min(100, (promo.used_count / effectiveMaxUses) * 100) : 0;
  const daysLeft = promo.expiry_date
    ? Math.ceil((new Date(promo.expiry_date).getTime() - Date.now()) / 86_400_000)
    : null;

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-colors hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800',
        promo.promo_status === 'expired' && 'opacity-70',
      )}
    >
      {/* Header band */}
      <div className={cn('px-3 py-2', scopeMeta.bandBg)}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className={cn('inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mb-0.5', scopeMeta.chipBg)}>
              <ScopeIcon className="w-2.5 h-2.5" />
              {scopeMeta.label}
            </div>
            <p className="text-sm font-bold font-mono leading-tight text-gray-900 dark:text-gray-100">{promo.code_string}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className={cn('text-xl font-bold leading-none', scopeMeta.accentText)}>{promo.discount_pct}%</p>
            <p className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-gray-400">off</p>
          </div>
        </div>
      </div>

      <div className="p-4">
        {promo.test_id && (
          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1 mb-2">
            <span className="font-semibold">For test:</span> <span className="font-mono">{promo.test_id}</span>
          </p>
        )}

        {/* Status pill */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={cn(
              'inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border',
              sMeta.cls,
            )}
          >
            <StatusIcon className="w-3 h-3" />
            {sMeta.label}
          </span>
          {daysLeft !== null && daysLeft > 0 && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {daysLeft} days left
            </span>
          )}
        </div>

        {/* Usage bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-400 mb-1">
            <span>Usage</span>
            <span className="font-bold tabular-nums text-gray-900 dark:text-gray-100">
              {promo.used_count.toLocaleString('en-IN')}
              {effectiveMaxUses ? (
                <> / {effectiveMaxUses.toLocaleString('en-IN')}</>
              ) : (
                <>
                  {' '}
                  / <InfinityIcon className="inline w-3 h-3 -mt-0.5" />
                </>
              )}
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full bg-gradient-to-r transition-all duration-700 rounded-full',
                effectiveMaxUses && usagePct >= 90
                  ? 'from-rose-500 to-red-500'
                  : effectiveMaxUses && usagePct >= 60
                  ? 'from-amber-500 to-orange-500'
                  : 'from-emerald-500 to-teal-500',
              )}
              style={{ width: effectiveMaxUses ? `${usagePct}%` : '100%' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1.5 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onCopy}
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-gray-300 hover:text-indigo-700 dark:hover:text-indigo-300 px-2 py-1.5 rounded-lg transition-colors"
          >
            <Copy className="w-3 h-3" /> Copy
          </button>
          <button
            onClick={onEdit}
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-gray-300 hover:text-indigo-700 dark:hover:text-indigo-300 px-2 py-1.5 rounded-lg transition-colors"
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          {(promo.promo_status === 'active' || promo.promo_status === 'paused') && (
            <button
              onClick={onTogglePause}
              className="inline-flex items-center justify-center gap-1 text-xs font-semibold bg-gray-50 dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-gray-500 hover:text-amber-700 dark:hover:text-amber-300 px-2 py-1.5 rounded-lg transition-colors"
              title={promo.promo_status === 'paused' ? 'Resume' : 'Pause'}
            >
              {promo.promo_status === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
            </button>
          )}
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-1 text-xs font-semibold bg-gray-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1.5 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PromoEditor({
  promo,
  onClose,
  onSave,
}: {
  promo: PromoCodeOut | null;
  onClose: () => void;
  onSave: (p: PromoCodeOut) => void;
}) {
  const isNew = !promo;
  const [form, setForm] = useState<PromoCodeOut>(
    promo || {
      code_id: `pc_${Date.now().toString(36)}`,
      code_string: '',
      scope: 'test',
      discount_pct: 100,
      max_uses: 100,
      used_count: 0,
      expiry_date: new Date(Date.now() + 30 * 86_400_000).toISOString().split('T')[0],
      created_by: null,
      created_at: new Date().toISOString(),
      promo_status: 'active',
      test_id: null,
      applies_to_tiers: null,
      applies_to_billing: null,
    },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code_string.trim()) {
      toast.error('Code string is required');
      return;
    }
    if (form.discount_pct < 1 || form.discount_pct > 100) {
      toast.error('Discount must be between 1 and 100');
      return;
    }
    onSave({
      ...form,
      code_string: form.code_string.toUpperCase().trim(),
      expiry_date: form.expiry_date
        ? new Date(form.expiry_date).toISOString()
        : null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-scaleIn max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative p-4 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 bg-[length:200%_auto] animate-gradient-x text-white">
          <div className="absolute inset-0 bg-soft-dots opacity-15" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold opacity-90">
              {isNew ? 'New Promo Code' : 'Edit Promo Code'}
            </p>
            <h2 className="text-lg font-bold mt-0.5 inline-flex items-center gap-2 font-mono">
              <Tag className="w-5 h-5" />
              {form.code_string || 'CODE_NAME'}
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Code String *">
              <input
                type="text"
                value={form.code_string}
                onChange={e => setForm(f => ({ ...f, code_string: e.target.value.toUpperCase() }))}
                placeholder="e.g. CAFOUND26"
                className="w-full px-3 py-2 text-sm font-mono uppercase border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
              />
            </FormField>
            <FormField label="Discount % *">
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.discount_pct}
                  onChange={e => setForm(f => ({ ...f, discount_pct: parseInt(e.target.value) || 0 }))}
                  className="w-full pl-3 pr-8 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
                />
                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              </div>
            </FormField>
          </div>

          <FormField label="Scope">
            <div className="flex gap-2">
              {(Object.keys(SCOPE_META) as PromoScope[]).map(s => {
                const meta = SCOPE_META[s];
                const Icon = meta.icon;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, scope: s }))}
                    className={cn(
                      'flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all',
                      form.scope === s
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-sm'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </FormField>

          {form.scope === 'test' && (
            <FormField label="Test ID">
              <input
                type="text"
                value={form.test_id || ''}
                onChange={e => setForm(f => ({ ...f, test_id: e.target.value || null }))}
                placeholder="e.g. test_found_mock_2"
                className="w-full px-3 py-2 text-sm font-mono border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
              />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Max Uses (blank = unlimited)">
              <input
                type="number"
                min={1}
                value={form.max_uses > 0 ? form.max_uses : ''}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    max_uses: e.target.value === '' ? -1 : parseInt(e.target.value),
                  }))
                }
                placeholder="Unlimited"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
              />
            </FormField>
            <FormField label="Expiry Date">
              <input
                type="date"
                value={form.expiry_date ? form.expiry_date.split('T')[0] : ''}
                onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value || null }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
              />
            </FormField>
          </div>

          {!isNew && (
            <div className="bg-gray-50/60 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 rounded-xl p-3 text-xs text-gray-500 dark:text-gray-400">
              <p>
                <span className="font-semibold">Current usage:</span> {form.used_count} redemptions
              </p>
              <p>
                <span className="font-semibold">Created:</span>{' '}
                {new Date(form.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}{' '}
                {form.created_by && <>by {form.created_by}</>}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg shadow-md press"
            >
              {isNew ? 'Create Code' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'emerald' | 'indigo' | 'gray' | 'rose';
}) {
  const TONE: Record<typeof tone, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
    gray: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
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
