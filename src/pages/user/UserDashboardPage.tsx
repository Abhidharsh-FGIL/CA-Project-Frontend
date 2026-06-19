import { Link } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { getPlan } from '@/data/userPortalSampleData';
import { BookOpen, TrendingUp, Clock, ChevronRight, AlertTriangle, Award, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function UserDashboardPage() {
  const { user, courses, history, notifications, isLoading } = useUserPortal();
  if (!user) return null;

  if (isLoading) {
    return (
      <UserShell>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      </UserShell>
    );
  }

  const plan = getPlan(user.subscription_tier);
  // Total tests taken = number of completed attempts from API history
  const completedAttempts = history.filter(h => h.status !== 'in_progress');
  const recentAttempts = completedAttempts.slice(0, 3);
  const avgScore =
    completedAttempts.length > 0
      ? Math.round(
          completedAttempts.reduce((s, h) => s + (h.percentage ?? 0), 0) / completedAttempts.length,
        )
      : 0;
  // Total tests available across enrolled courses
  const totalTests = courses.reduce((sum, c) => sum + (c.total_tests ?? 0), 0);

  const daysToExpiry = Math.ceil(
    (new Date(user.subscription_expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  );

  const expiryLabel = (() => {
    if (user.subscription_tier === 'free') return null; // free plans don't expire
    if (daysToExpiry > 1) return `expires in ${daysToExpiry} days`;
    if (daysToExpiry === 1) return 'expires tomorrow';
    if (daysToExpiry === 0) return 'expires today';
    if (daysToExpiry === -1) return 'expired yesterday';
    return `expired ${Math.abs(daysToExpiry)} days ago`;
  })();

  return (
    <UserShell>
      {/* Hero greeting */}
      <div className="mb-5 sm:mb-6 animate-fadeIn">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100">
          Welcome back, <span className="gradient-text-animated">{user.name.split(' ')[0]}</span>
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">Here's what's happening in your prep today.</p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4 mb-6">
        <StatCard
          icon={<BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
          label="Courses"
          value={courses.length}
          tone="indigo"
          index={0}
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
          label="Total Tests"
          value={totalTests}
          tone="emerald"
          index={1}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />}
          label="Avg Score"
          value={completedAttempts.length > 0 ? `${avgScore}%` : '—'}
          tone="amber"
          index={2}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-rose-600 dark:text-rose-400" />}
          label="Tests Taken"
          value={completedAttempts.length}
          tone="rose"
          index={3}
        />
      </div>

      {/* Subscription banner */}
      <div className="mb-6 animate-slideUp" style={{ animationDelay: '0.2s' }}>
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-pink-950/40 bg-[length:200%_auto] animate-gradient-x border border-indigo-100 dark:border-indigo-900 rounded-2xl p-4 sm:p-5 shadow-sm relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-32 h-32 bg-purple-200/40 dark:bg-purple-700/20 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between gap-3 flex-wrap relative">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-gray-800 shadow-md flex items-center justify-center flex-shrink-0 hover:rotate-12 transition-transform">
                <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {plan.name} Plan
                  {expiryLabel && (
                    <span className={cn(
                      'ml-1.5 text-[11px] font-medium',
                      daysToExpiry <= 0
                        ? 'text-red-600 dark:text-red-400'
                        : daysToExpiry <= 7
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-500 dark:text-gray-400',
                    )}>
                      {expiryLabel}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                  {typeof plan.features.mock_tests_per_month === 'number'
                    ? `${user.usage.mock_tests_attempted_month} / ${plan.features.mock_tests_per_month} mocks used this month`
                    : plan.features.mock_tests_per_month === 'unlimited'
                    ? 'Unlimited mock tests'
                    : 'Mock tests not included in this plan'}
                </p>
              </div>
            </div>
            {user.subscription_tier !== 'premium' && (
              <Link
                to="/user/subscription"
                className="group inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 hover:shadow-lg hover:shadow-indigo-300 press"
              >
                Upgrade <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            )}
          </div>
        </div>
      </div>

      {daysToExpiry <= 7 && daysToExpiry >= 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Subscription expiring soon</p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
              Your {plan.name} plan ends in {daysToExpiry} day{daysToExpiry !== 1 ? 's' : ''}. Renew to keep your benefits.
            </p>
          </div>
          <Link
            to="/user/subscription"
            className="text-xs font-semibold bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700"
          >
            Renew
          </Link>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Courses */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Your Courses</h2>
            <Link to="/user/courses" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
              View all
            </Link>
          </div>
          {courses.length === 0 ? (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No courses available yet.{' '}
                <Link to="/user/courses" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                  View courses
                </Link>
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {courses.map((c, i) => (
                <Link
                  key={c.course_id}
                  to={`/user/courses/${c.course_id}`}
                  className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-black/50 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-300 animate-slideUp hover-lift card-shine"
                  style={{ animationDelay: `${0.3 + i * 0.06}s` }}
                >
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-b border-indigo-100 dark:border-indigo-900/40 px-3 py-2 flex items-center justify-between">
                    <p className="text-base font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
                      {c.subject ?? c.name}
                    </p>
                    {c.exam_body && (
                      <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                        {c.exam_body}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {c.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{c.description}</p>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-indigo-400" />
                      {c.total_tests} test{c.total_tests !== 1 ? 's' : ''}
                    </p>
                  </div>
                </Link>
            ))}
          </div>
          )}
        </div>

        {/* Recent activity & notifications */}
        <div className="space-y-6 animate-slideInRight" style={{ animationDelay: '0.4s' }}>
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Recent Activity</h2>
              <Link to="/user/history" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                History
              </Link>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden shadow-sm">
              {recentAttempts.length === 0 ? (
                <p className="p-5 text-center text-sm text-gray-400 dark:text-gray-500">No tests taken yet.</p>
              ) : (
                recentAttempts.map(a => {
                  const pct = a.percentage ?? 0;
                  return (
                    <Link
                      key={a.attempt_id}
                      to={`/user/report/${a.attempt_id}`}
                      className="block p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-colors group"
                    >
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                        {a.test_name ?? 'Test Attempt'}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        {a.percentage !== null ? (
                          <span
                            className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                              pct >= 70
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : pct >= 50
                                ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                            }`}
                          >
                            {Math.round(pct)}%
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            In progress
                          </span>
                        )}
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          {new Date(a.start_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Notifications</h2>
              <Link to="/user/notifications" className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                View all
              </Link>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
              {notifications.slice(0, 3).map(n => (
                <div key={n.notification_id} className="p-4">
                  <div className="flex items-start gap-2">
                    {!n.is_read && <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${n.is_read ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-gray-100 font-medium'}`}>
                        {n.message}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <p className="p-5 text-center text-sm text-gray-400 dark:text-gray-500">All caught up.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </UserShell>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
  badge,
  index = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose';
  badge?: string;
  index?: number;
}) {
  const toneBg: Record<typeof tone, string> = {
    indigo: 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/60 dark:to-indigo-900/40',
    emerald: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/60 dark:to-emerald-900/40',
    amber: 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/60 dark:to-amber-900/40',
    rose: 'bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/60 dark:to-rose-900/40',
  } as any;
  const toneGlow: Record<typeof tone, string> = {
    indigo: 'hover:shadow-indigo-100/50 dark:hover:shadow-indigo-950/40',
    emerald: 'hover:shadow-emerald-100/50 dark:hover:shadow-emerald-950/40',
    amber: 'hover:shadow-amber-100/50 dark:hover:shadow-amber-950/40',
    rose: 'hover:shadow-rose-100/50 dark:hover:shadow-rose-950/40',
  } as any;
  const toneAccent: Record<typeof tone, string> = {
    indigo: 'from-indigo-500/10 via-transparent to-transparent',
    emerald: 'from-emerald-500/10 via-transparent to-transparent',
    amber: 'from-amber-500/10 via-transparent to-transparent',
    rose: 'from-rose-500/10 via-transparent to-transparent',
  } as any;
  return (
    <div
      className={`group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3 sm:p-4 animate-slideUp hover-lift hover:shadow-lg ${toneGlow[tone]} card-shine overflow-hidden`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${toneAccent[tone]} pointer-events-none`} />

      {badge && (
        <span className="absolute top-2 right-2 z-10 text-[9px] font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-1.5 py-0.5 rounded shadow-sm animate-bounce-soft">
          {badge}
        </span>
      )}

      <div className="relative flex items-center gap-3">
        <div className={`flex-shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl ${toneBg[tone]} flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 shadow-sm`}>
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none tracking-tight">{value}</p>
          <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}
