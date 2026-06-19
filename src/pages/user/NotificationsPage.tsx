import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { Bell, Check, Trash2, Sparkles, Clock, FileText, AlertTriangle, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';

const TYPE_META = {
  new_test: {
    icon: Sparkles,
    color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40',
    label: 'New Test',
  },
  subscription_expiry: {
    icon: AlertTriangle,
    color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40',
    label: 'Subscription',
  },
  report_ready: {
    icon: FileText,
    color: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40',
    label: 'Report',
  },
  system: {
    icon: Bell,
    color: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/60',
    label: 'System',
  },
} as const;

type FilterKey = 'all' | 'unread' | 'new_test' | 'report_ready' | 'subscription_expiry';

export default function NotificationsPage() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
  } = useUserPortal();

  const [filter, setFilter] = useState<FilterKey>('all');

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.is_read);
    return notifications.filter(n => n.type === filter);
  }, [notifications, filter]);

  // Group by Today / Yesterday / Earlier
  const grouped = useMemo(() => {
    const today: typeof filtered = [];
    const yesterday: typeof filtered = [];
    const earlier: typeof filtered = [];
    const now = new Date();
    const todayKey = now.toDateString();
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestKey = yest.toDateString();

    filtered.forEach(n => {
      const k = new Date(n.created_at).toDateString();
      if (k === todayKey) today.push(n);
      else if (k === yestKey) yesterday.push(n);
      else earlier.push(n);
    });
    return { today, yesterday, earlier };
  }, [filtered]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const filterCount = (k: FilterKey) => {
    if (k === 'all') return notifications.length;
    if (k === 'unread') return unreadCount;
    return notifications.filter(n => n.type === k).length;
  };

  return (
    <UserShell>
      {/* Hero header */}
      <div className="mb-6 animate-fadeIn">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/50 dark:via-purple-950/50 dark:to-pink-950/50 bg-[length:200%_auto] animate-gradient-x p-5 sm:p-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-300/30 dark:bg-purple-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-300/30 dark:bg-indigo-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-700 dark:text-indigo-300 font-bold mb-2">
                Inbox
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <span className="gradient-text-animated">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-bounce-soft">
                    {unreadCount}
                  </span>
                )}
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5">
                {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}.` : "You're all caught up."}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {unreadCount > 0 && (
                <button
                  onClick={markAllNotificationsRead}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 dark:bg-gray-900/60 backdrop-blur border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-800 transition-all press"
                >
                  <Check className="w-3.5 h-3.5" /> Mark all read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAllNotifications}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/80 dark:bg-gray-900/60 backdrop-blur border border-red-200 dark:border-red-900 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-all press"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear all
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filter chips — horizontal scroll on narrow screens to keep them on one line */}
      <div className="flex gap-2 mb-5 overflow-x-auto sm:overflow-x-visible flex-nowrap sm:flex-wrap -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0 scrollbar-thin animate-fadeIn" style={{ animationDelay: '0.1s' }}>
        <FilterChip label="All" active={filter === 'all'} count={filterCount('all')} onClick={() => setFilter('all')} />
        <FilterChip label="Unread" active={filter === 'unread'} count={filterCount('unread')} onClick={() => setFilter('unread')} accent />
        <FilterChip label="New Tests" active={filter === 'new_test'} count={filterCount('new_test')} onClick={() => setFilter('new_test')} />
        <FilterChip label="Reports" active={filter === 'report_ready'} count={filterCount('report_ready')} onClick={() => setFilter('report_ready')} />
        <FilterChip label="Subscription" active={filter === 'subscription_expiry'} count={filterCount('subscription_expiry')} onClick={() => setFilter('subscription_expiry')} />
      </div>

      {/* Notifications list — grouped by date */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm animate-fadeIn">
          <div className="p-16 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 flex items-center justify-center mx-auto mb-4 animate-bounce-soft">
              <Inbox className="w-10 h-10 text-indigo-400 dark:text-indigo-500" />
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {filter === 'all' ? "No notifications yet" : "Nothing here"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {filter === 'all'
                ? "We'll let you know when new tests, reports, or updates arrive."
                : "Try a different filter to see other notifications."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-fadeIn" style={{ animationDelay: '0.15s' }}>
          {grouped.today.length > 0 && (
            <DateSection title="Today" notifications={grouped.today} formatTime={formatTime} onRead={markNotificationRead} navigate={navigate} />
          )}
          {grouped.yesterday.length > 0 && (
            <DateSection title="Yesterday" notifications={grouped.yesterday} formatTime={formatTime} onRead={markNotificationRead} navigate={navigate} />
          )}
          {grouped.earlier.length > 0 && (
            <DateSection title="Earlier" notifications={grouped.earlier} formatTime={formatTime} onRead={markNotificationRead} navigate={navigate} />
          )}
        </div>
      )}
    </UserShell>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
  accent,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all press whitespace-nowrap',
        active
          ? accent
            ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm shadow-red-200 dark:shadow-red-900/40'
            : 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm shadow-indigo-200 dark:shadow-indigo-900/40'
          : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700',
      )}
    >
      {label}
      <span
        className={cn(
          'text-[10px] font-bold px-1.5 py-0.5 rounded-full tabular-nums',
          active ? 'bg-white/25' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function DateSection({
  title,
  notifications,
  formatTime,
  onRead,
  navigate,
}: {
  title: string;
  notifications: ReturnType<typeof useUserPortal>['notifications'];
  formatTime: (iso: string) => string;
  onRead: (id: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2 px-1">
        <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400 font-bold">
          {title}
        </p>
        <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full font-semibold">
          {notifications.length}
        </span>
        <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
      </div>
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm">
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {notifications.map((n, i) => {
            const meta = TYPE_META[n.type];
            const Icon = meta.icon;
            return (
              <button
                key={n.notification_id}
                onClick={() => {
                  onRead(n.notification_id);
                  if (n.test_id) navigate(`/user/courses`);
                }}
                className={cn(
                  'group w-full text-left p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-colors flex gap-3 items-start animate-slideInLeft',
                  !n.is_read && 'bg-indigo-50/30 dark:bg-indigo-950/20',
                )}
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 group-hover:rotate-6', meta.color)}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className={cn('text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded', meta.color)}>
                      {meta.label}
                    </span>
                    {!n.is_read && (
                      <span className="text-[9px] font-bold bg-indigo-500 text-white px-1.5 py-0.5 rounded animate-pulse">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className={cn('text-sm leading-snug', n.is_read ? 'text-gray-700 dark:text-gray-300' : 'text-gray-900 dark:text-gray-100 font-semibold')}>
                    {n.message}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatTime(n.created_at)}
                  </p>
                </div>
                {!n.is_read && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
