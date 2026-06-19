import { useMemo, useState } from 'react';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Search,
  Filter,
  Download,
  Shield,
  Plus,
  Edit2,
  Trash2,
  Archive,
  CheckCircle2,
  PlayCircle,
  PauseCircle,
  Lock,
  Unlock,
  LogIn,
  LogOut,
  FileText,
  ClipboardCheck,
  BookOpen,
  Tag,
  Sparkles,
  User as UserIcon,
  Calendar,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAdminAuditLog } from '@/hooks/use-admin-audit';
import { auditApi, type AuditLogOut } from '@/lib/adminApi';

type ActionMeta = { label: string; icon: typeof CheckCircle2; cls: string };
const DEFAULT_ACTION_META: ActionMeta = {
  label: 'Action',
  icon: CheckCircle2,
  cls: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800',
};

const ACTION_META: Record<string, ActionMeta> = {
  question_create: { label: 'Question Created', icon: Plus, cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
  question_edit: { label: 'Question Edited', icon: Edit2, cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' },
  question_delete: { label: 'Question Deleted', icon: Trash2, cls: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40' },
  test_publish: { label: 'Test Published', icon: PlayCircle, cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
  test_archive: { label: 'Test Archived', icon: Archive, cls: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800' },
  test_deactivate: { label: 'Test Deactivated', icon: PauseCircle, cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  paper_create: { label: 'Paper Created', icon: FileText, cls: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40' },
  paper_delete: { label: 'Paper Deleted', icon: Trash2, cls: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40' },
  course_create: { label: 'Course Created', icon: BookOpen, cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
  course_archive: { label: 'Course Archived', icon: Archive, cls: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800' },
  promo_create: { label: 'Promo Created', icon: Tag, cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  promo_pause: { label: 'Promo Paused', icon: PauseCircle, cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  plan_update: { label: 'Plan Updated', icon: Sparkles, cls: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40' },
  user_lock: { label: 'User Locked', icon: Lock, cls: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  user_unlock: { label: 'User Unlocked', icon: Unlock, cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40' },
  login: { label: 'Sign In', icon: LogIn, cls: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' },
  logout: { label: 'Sign Out', icon: LogOut, cls: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800' },
};

const RESOURCE_ICON: Record<string, typeof CheckCircle2> = {
  question: ClipboardCheck,
  test: PlayCircle,
  paper: FileText,
  course: BookOpen,
  promo: Tag,
  plan: Sparkles,
  user: UserIcon,
  session: LogIn,
};

type FilterRange = '24h' | '7d' | '30d' | 'all';

export default function AdminAuditPage() {
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<FilterRange>('30d');
  const [actorFilter, setActorFilter] = useState<'all' | string>('all');

  const dateParams = useMemo(() => {
    if (dateRange === 'all') return {};
    const ms = dateRange === '24h' ? 86400000 : dateRange === '7d' ? 7 * 86400000 : 30 * 86400000;
    return {
      date_from: new Date(Date.now() - ms).toISOString(),
      date_to: new Date().toISOString(),
    };
  }, [dateRange]);

  const { data: logsData, isLoading: logsLoading } = useAdminAuditLog({
    entity_type: entityFilter !== 'all' ? entityFilter : undefined,
    ...dateParams,
    limit: 100,
  });

  const logs: AuditLogOut[] = logsData?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs
      .filter(l => actorFilter === 'all' || l.actor_name === actorFilter)
      .filter(l =>
        !q ||
        l.action.toLowerCase().includes(q) ||
        (l.entity_id || '').toLowerCase().includes(q) ||
        (l.actor_name || '').toLowerCase().includes(q),
      );
  }, [logs, search, actorFilter]);

  const stats = useMemo(() => {
    const byAction = new Map<string, number>();
    for (const l of logs) byAction.set(l.action, (byAction.get(l.action) || 0) + 1);
    return {
      total: logs.length,
      byAction: Array.from(byAction.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4),
      uniqueActors: new Set(logs.map(l => l.actor_name).filter(Boolean)).size,
    };
  }, [logs]);

  const actors = useMemo(() => {
    return Array.from(new Set(logs.map(l => l.actor_name).filter((n): n is string => Boolean(n))));
  }, [logs]);

  const { visible: visibleEntries, sentinelRef: auditSentinelRef, hasMore: auditHasMore, shown: auditShown, total: auditTotal } = useInfiniteList<AuditLogOut>(filtered, 25);

  // Group by day (only visible entries)
  const grouped = useMemo(() => {
    const map = new Map<string, AuditLogOut[]>();
    for (const l of visibleEntries) {
      const key = new Date(l.timestamp).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return Array.from(map.entries());
  }, [visibleEntries]);

  const exportCSV = () => {
    auditApi.exportCsv({
      ...dateParams,
      entity_type: entityFilter !== 'all' ? entityFilter : undefined,
    });
    toast.success('Export started');
  };

  return (
    <GenVerseShell>
      <PageHeader
        title="Audit Log"
        description="Immutable timeline of admin actions."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Audit Log' }]}
        actions={
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-3 py-2 rounded-lg shadow-md press"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        }
      />

      {logsLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
      <div className="space-y-5 pb-6">
        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatChip icon={<Shield />} label="Total Events" value={stats.total} tone="indigo" />
          <StatChip icon={<UserIcon />} label="Unique Actors" value={stats.uniqueActors} tone="emerald" />
          {stats.byAction.slice(0, 2).map(([action, count]) => {
            const meta = ACTION_META[action] ?? DEFAULT_ACTION_META;
            return <StatChip key={action} icon={<meta.icon />} label={meta.label} value={count} tone="amber" />;
          })}
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
                placeholder="Search by description, actor, or resource…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <Chip active={entityFilter === 'all'} onClick={() => setEntityFilter('all')}>All Resources</Chip>
              {['question', 'test', 'paper', 'course', 'promo', 'plan', 'user'].map(r => (
                <Chip key={r} active={entityFilter === r} onClick={() => setEntityFilter(r)}>
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </Chip>
              ))}
              <span className="w-px h-5 bg-gray-200 dark:bg-gray-700 mx-1" />
              <Calendar className="w-4 h-4 text-gray-400" />
              {(['24h', '7d', '30d', 'all'] as FilterRange[]).map(r => (
                <Chip key={r} active={dateRange === r} onClick={() => setDateRange(r)}>
                  {r === 'all' ? 'All time' : r}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <UserIcon className="w-4 h-4 text-gray-400" />
              <Chip active={actorFilter === 'all'} onClick={() => setActorFilter('all')}>All Actors</Chip>
              {actors.map(name => (
                <Chip key={name} active={actorFilter === name} onClick={() => setActorFilter(name)}>
                  {name}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline */}
        {logs.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center">
            <Shield className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No audit entries match the filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, entries]) => (
              <div key={day}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-950/60 dark:to-purple-950/60 text-indigo-700 dark:text-indigo-300 px-3 py-1.5 rounded-full">
                    <Calendar className="w-3.5 h-3.5" />
                    <p className="text-xs font-bold">{day}</p>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-indigo-200 dark:from-indigo-900 to-transparent" />
                  <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                    {entries.length} {entries.length === 1 ? 'event' : 'events'}
                  </p>
                </div>

                <div className="relative pl-8">
                  {/* Spine */}
                  <div className="absolute left-3 top-2 bottom-2 w-px bg-gradient-to-b from-indigo-200 dark:from-indigo-900 via-purple-200 dark:via-purple-900 to-transparent" />

                  <div className="space-y-2">
                    {entries.map(entry => {
                      const meta = ACTION_META[entry.action] ?? DEFAULT_ACTION_META;
                      const ActionIcon = meta.icon;
                      const ResourceIcon = RESOURCE_ICON[entry.entity_type] ?? Shield;
                      return (
                        <div
                          key={entry.log_id}
                          className="relative bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800 transition-all"
                        >
                          {/* Spine dot */}
                          <div className={cn('absolute -left-7 top-3 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white dark:ring-gray-950', meta.cls)}>
                            <ActionIcon className="w-3 h-3" />
                          </div>

                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', meta.cls)}>
                                  {meta.label}
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                                  <ResourceIcon className="w-3 h-3" />
                                  {entry.entity_type}
                                </span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.entity_id ?? '—'}</p>
                              {entry.details && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                                  {typeof entry.details === 'object'
                                    ? Object.entries(entry.details).map(([k, v]) => `${k}: ${v}`).join(' · ')
                                    : String(entry.details)}
                                </p>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0 min-w-0">
                              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">{entry.actor_name ?? '—'}</p>
                              {entry.actor_role && (
                                <p className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">
                                  {entry.actor_role.replace('_', ' ')}
                                </p>
                              )}
                              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 tabular-nums">
                                {new Date(entry.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
            <div ref={auditSentinelRef} className="h-1" />
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
              {auditHasMore ? `Loading more… (${auditShown} of ${auditTotal})` : `All ${auditTotal} entries loaded`}
            </p>
          </div>
        )}
      </div>
      )}
    </GenVerseShell>
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
  tone: 'indigo' | 'emerald' | 'amber';
}) {
  const TONE: Record<typeof tone, string> = {
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
  };
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover-lift">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5', TONE[tone])}>
          {icon}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 truncate">{label}</p>
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
        'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border whitespace-nowrap',
        active
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-sm'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700',
      )}
    >
      {children}
    </button>
  );
}
