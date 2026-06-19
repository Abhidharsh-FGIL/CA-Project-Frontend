import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import {
  Database,
  FileText,
  ClipboardCheck,
  Users,
  CreditCard,
  TrendingUp,
  Sparkles,
  PlusCircle,
  FilePlus,
  Link2,
  Copy,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Tag,
  Download,
  History as HistoryIcon,
  Activity,
  Award,
  ArrowUpRight,
  BookOpen,
  Shield,
  Settings as SettingsIcon,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  TIER_LABEL,
  TIER_COLOR,
  type AdminMetric,
} from '@/data/adminDashboardSampleData';
import {
  useDashboardMetrics,
  useDashboardSubscriptions,
  useDashboardRecentTests,
  useDashboardDailyAttempts,
  useDashboardRecentAttempts,
  useDashboardTopCourses,
} from '@/hooks/use-admin-dashboard';

const ICON_MAP = {
  bank: Database,
  paper: FileText,
  test: ClipboardCheck,
  users: Users,
  subscription: CreditCard,
  attempts: Activity,
  reports: Award,
  promo: Tag,
} as const;

const TONE_CLASSES: Record<
  AdminMetric['tone'],
  { iconBg: string; iconText: string; accent: string; glow: string }
> = {
  indigo: {
    iconBg: 'bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-950/60 dark:to-indigo-900/40',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    accent: 'from-indigo-500/10',
    glow: 'hover:shadow-indigo-100/50 dark:hover:shadow-indigo-950/40',
  },
  blue: {
    iconBg: 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/60 dark:to-blue-900/40',
    iconText: 'text-blue-600 dark:text-blue-400',
    accent: 'from-blue-500/10',
    glow: 'hover:shadow-blue-100/50 dark:hover:shadow-blue-950/40',
  },
  emerald: {
    iconBg: 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/60 dark:to-emerald-900/40',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    accent: 'from-emerald-500/10',
    glow: 'hover:shadow-emerald-100/50 dark:hover:shadow-emerald-950/40',
  },
  amber: {
    iconBg: 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/60 dark:to-amber-900/40',
    iconText: 'text-amber-600 dark:text-amber-400',
    accent: 'from-amber-500/10',
    glow: 'hover:shadow-amber-100/50 dark:hover:shadow-amber-950/40',
  },
  rose: {
    iconBg: 'bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/60 dark:to-rose-900/40',
    iconText: 'text-rose-600 dark:text-rose-400',
    accent: 'from-rose-500/10',
    glow: 'hover:shadow-rose-100/50 dark:hover:shadow-rose-950/40',
  },
  purple: {
    iconBg: 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/60 dark:to-purple-900/40',
    iconText: 'text-purple-600 dark:text-purple-400',
    accent: 'from-purple-500/10',
    glow: 'hover:shadow-purple-100/50 dark:hover:shadow-purple-950/40',
  },
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const metrics = useDashboardMetrics();
  const subscriptionDist = useDashboardSubscriptions();
  const recentTests = useDashboardRecentTests();
  const dailyAttempts = useDashboardDailyAttempts();
  const { data: recentAttemptsData } = useDashboardRecentAttempts();
  const recentAttempts = recentAttemptsData?.items ?? [];
  const topCourses = useDashboardTopCourses();

  const maxDay = useMemo(
    () => Math.max(1, ...dailyAttempts.map(d => d.practice + d.mock)),
    [dailyAttempts],
  );

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/take-assessment?token=${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedToken(token);
      toast.success('Test link copied to clipboard');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      toast.error('Could not copy link');
    }
  };

  const shareEmail = (testName: string, token: string) => {
    const url = `${window.location.origin}/take-assessment?token=${token}`;
    const subject = encodeURIComponent(`Test invitation: ${testName}`);
    const body = encodeURIComponent(
      `Hi,\n\nYou've been invited to take the following test:\n\n${testName}\n\nClick the link below to begin:\n${url}\n\nGood luck!\nFGIL Services`,
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return 'just now';
    if (min < 60) return `${min}m ago`;
    const h = Math.floor(min / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <GenVerseShell>
      <PageHeader
        title="Admin Dashboard"
        description="Platform overview, recent activity, and quick actions."
        breadcrumbs={[{ label: 'Dashboard' }]}
      />

      <div className="space-y-5 pb-6">
        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {metrics.map((m, i) => (
            <MetricCard key={m.key} metric={m} index={i} />
          ))}
        </div>

        {/* Quick actions */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-5 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Content & Tests</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-5">
            <QuickAction
              icon={<PlusCircle className="w-5 h-5" />}
              label="Create Questions"
              description="AI-assisted"
              onClick={() => navigate('/org/evaluation', { state: { tab: 'create' } })}
              tone="indigo"
            />
            <QuickAction
              icon={<FilePlus className="w-5 h-5" />}
              label="Generate Test"
              description="Share with users"
              onClick={() => navigate('/org/evaluation', { state: { tab: 'assessments' } })}
              tone="emerald"
            />
            <QuickAction
              icon={<Database className="w-5 h-5" />}
              label="Question Bank"
              description="Browse & manage"
              onClick={() => navigate('/org/evaluation', { state: { tab: 'bank' } })}
              tone="blue"
            />
            <QuickAction
              icon={<HistoryIcon className="w-5 h-5" />}
              label="All History"
              description="Across all users"
              onClick={() => navigate('/org/evaluation', { state: { tab: 'reports' } })}
              tone="purple"
            />
            <QuickAction
              icon={<BookOpen className="w-5 h-5" />}
              label="Courses"
              description="Create & archive"
              onClick={() => navigate('/org/courses')}
              tone="emerald"
            />
          </div>

          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Administration</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <QuickAction
              icon={<Users className="w-5 h-5" />}
              label="Users"
              description="Manage learners"
              onClick={() => navigate('/org/users')}
              tone="indigo"
            />
            <QuickAction
              icon={<Tag className="w-5 h-5" />}
              label="Promo Codes"
              description="Discount codes"
              onClick={() => navigate('/org/promos')}
              tone="amber"
            />
            <QuickAction
              icon={<Sparkles className="w-5 h-5" />}
              label="Plans"
              description="Tier features"
              onClick={() => navigate('/org/plans')}
              tone="purple"
            />
            <QuickAction
              icon={<CreditCard className="w-5 h-5" />}
              label="Payments"
              description="Revenue ledger"
              onClick={() => navigate('/org/payments')}
              tone="amber"
            />
            <QuickAction
              icon={<Shield className="w-5 h-5" />}
              label="Audit Log"
              description="Admin actions"
              onClick={() => navigate('/org/audit')}
              tone="rose"
            />
            <QuickAction
              icon={<SettingsIcon className="w-5 h-5" />}
              label="Settings"
              description="Policy & profile"
              onClick={() => navigate('/org/settings')}
              tone="blue"
            />
          </div>
        </div>

        {/* Main 2-column area */}
        <div className="grid lg:grid-cols-3 gap-4">
          {/* LEFT — Daily attempts chart + Recent attempts */}
          <div className="lg:col-span-2 space-y-4">
            {/* Daily attempts chart */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-5 animate-slideUp" style={{ animationDelay: '0.35s' }}>
              <div className="flex items-start justify-between gap-2 mb-4 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    Daily Test Attempts
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Last 7 days</p>
                </div>
                <div className="flex items-center gap-3 text-[11px] flex-shrink-0">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> <span className="text-gray-600 dark:text-gray-400">Practice</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> <span className="text-gray-600 dark:text-gray-400">Mock</span>
                  </span>
                </div>
              </div>
              <div className="h-44 flex items-stretch gap-2 sm:gap-3">
                {dailyAttempts.map((d, i) => {
                  const total = d.practice + d.mock;
                  const totalPct = (total / maxDay) * 100;
                  const practiceShare = (d.practice / total) * totalPct;
                  const mockShare = (d.mock / total) * totalPct;
                  return (
                    <div key={d.date} className="flex-1 h-full flex flex-col items-center gap-1 group">
                      {/* Value label — reserves space; visible on hover */}
                      <p className="text-[10px] font-bold text-gray-700 dark:text-gray-300 h-4 leading-4 opacity-0 group-hover:opacity-100 transition-opacity">
                        {total}
                      </p>
                      {/* Bar container — relative for absolute-positioned bars */}
                      <div className="w-full flex-1 min-h-0 rounded-lg overflow-hidden bg-gray-50 dark:bg-gray-800/50 relative">
                        {/* Practice (foundation) — at bottom */}
                        <div
                          className="absolute left-0 right-0 bottom-0 bg-emerald-500 group-hover:bg-emerald-600 transition-all duration-500"
                          style={{ height: `${practiceShare}%`, animationDelay: `${i * 0.06}s` }}
                          title={`${d.practice} practice attempts`}
                        />
                        {/* Mock — stacked on top of practice */}
                        <div
                          className="absolute left-0 right-0 bg-indigo-500 group-hover:bg-indigo-600 transition-all duration-500"
                          style={{ bottom: `${practiceShare}%`, height: `${mockShare}%`, animationDelay: `${i * 0.06}s` }}
                          title={`${d.mock} mock attempts`}
                        />
                      </div>
                      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400 h-4 leading-4">{d.label}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recent attempts */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-slideUp" style={{ animationDelay: '0.4s' }}>
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Recent Attempts
                </h2>
                <Link
                  to="/org/evaluation"
                  state={{ tab: 'reports' }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1"
                >
                  View all <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-[480px] overflow-y-auto">
                {recentAttempts.length === 0 ? (
                  <p className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-500">No recent attempts</p>
                ) : recentAttempts.map((a, i) => (
                  <div
                    key={a.attempt_id}
                    className="px-4 sm:px-5 py-3 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-colors animate-fadeIn"
                    style={{ animationDelay: `${0.4 + i * 0.04}s` }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {a.user_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{a.user_name}</p>
                          <span
                            className={cn(
                              'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                              a.mode === 'mock'
                                ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                                : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
                            )}
                          >
                            {a.mode}
                          </span>
                          {a.malpractice_events > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                              <AlertTriangle className="w-3 h-3" /> {a.malpractice_events} violations
                            </span>
                          )}
                          {a.auto_submitted && (
                            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">Auto-submitted</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                          {a.test_name} · {a.course}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{formatTime(a.started_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                        <span
                          className={cn(
                            'text-xs font-bold px-2 py-0.5 rounded',
                            a.percentage >= 70
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                              : a.percentage >= 50
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                              : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                          )}
                        >
                          {a.percentage}%
                        </span>
                        <p className="text-[10px] text-gray-400 dark:text-gray-500">
                          {a.score}/{a.total_marks}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Subscription distribution + Recent tests + Top courses */}
          <div className="space-y-4">
            {/* Subscription distribution */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-5 animate-slideInRight" style={{ animationDelay: '0.4s' }}>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Subscription Mix
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                {subscriptionDist.reduce((s, t) => s + t.count, 0).toLocaleString('en-IN')} total users
              </p>

              {/* Stacked bar */}
              <div className="h-3 rounded-full overflow-hidden flex bg-gray-100 dark:bg-gray-800 mb-4">
                {subscriptionDist.map(t => (
                  <div
                    key={t.tier}
                    className={cn(TIER_COLOR[t.tier], 'h-full transition-all duration-700')}
                    style={{ width: `${t.percentage}%` }}
                    title={`${TIER_LABEL[t.tier]}: ${t.count} (${t.percentage}%)`}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="space-y-2">
                {subscriptionDist.map(t => (
                  <div key={t.tier} className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2">
                      <span className={cn('w-2.5 h-2.5 rounded-sm', TIER_COLOR[t.tier])} />
                      <span className="text-gray-700 dark:text-gray-300">{TIER_LABEL[t.tier]}</span>
                    </span>
                    <span className="text-gray-500 dark:text-gray-400">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{t.count}</span> · {t.percentage}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent tests with shareable links */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-5 animate-slideInRight" style={{ animationDelay: '0.45s' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  Recent Tests
                </h2>
                <Link
                  to="/org/evaluation"
                  state={{ tab: 'assessments' }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  All tests
                </Link>
              </div>
              <div className="space-y-2">
                {recentTests.map(t => (
                  <div
                    key={t.test_id}
                    className="group rounded-lg border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 transition-colors p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 flex-1">{t.name}</p>
                      <span
                        className={cn(
                          'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex-shrink-0',
                          t.mode === 'mock'
                            ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                            : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
                        )}
                      >
                        {t.mode}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                      {t.course} · {t.attempts_count} attempts
                      {t.promo_code && (
                        <>
                          {' '}·{' '}
                          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-semibold">
                            <Tag className="w-2.5 h-2.5" /> {t.promo_code}
                          </span>
                        </>
                      )}
                    </p>
                    <div className="flex items-stretch gap-1">
                      <button
                        onClick={() => copyLink(t.link_token)}
                        className="flex-1 inline-flex items-center justify-between gap-2 text-[10px] font-mono bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-gray-300 px-2 py-1.5 rounded transition-colors group/btn"
                        title="Copy shareable link"
                      >
                        <span className="truncate">/{t.link_token}</span>
                        {copiedToken === t.link_token ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3 text-gray-400 group-hover/btn:text-indigo-600 dark:group-hover/btn:text-indigo-400 flex-shrink-0" />
                        )}
                      </button>
                      <button
                        onClick={() => shareEmail(t.name, t.link_token)}
                        className="inline-flex items-center justify-center bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-1.5 rounded transition-colors"
                        title="Share via email"
                      >
                        <Mail className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top courses */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 sm:p-5 animate-slideInRight" style={{ animationDelay: '0.5s' }}>
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Top Courses
              </h2>
              <div className="space-y-2.5">
                {topCourses.sort((a, b) => b.attempts - a.attempts).map((c, i) => {
                  const max = Math.max(...topCourses.map(x => x.attempts));
                  const pct = (c.attempts / max) * 100;
                  return (
                    <div key={c.course_id}>
                      <div className="flex items-baseline justify-between text-xs mb-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          <span className="text-gray-400 dark:text-gray-500 font-mono mr-1.5">#{i + 1}</span>
                          {c.name}
                        </p>
                        <div className="flex items-baseline gap-2 flex-shrink-0">
                          <span className="text-gray-700 dark:text-gray-300 font-semibold">{c.attempts}</span>
                          <span className="text-[10px] text-gray-400 dark:text-gray-500">{c.avg_score}% avg</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 progress-bar-fill"
                          style={{ width: `${pct}%`, animationDelay: `${i * 0.08}s` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 border border-indigo-100 dark:border-indigo-900 rounded-2xl p-4 sm:p-5 flex items-start justify-between gap-3 flex-wrap animate-fadeIn" style={{ animationDelay: '0.6s' }}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-gray-800 shadow-md flex items-center justify-center flex-shrink-0">
              <Download className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Export platform data</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Download full user history, attempts, and AI reports as CSV / Excel.
              </p>
            </div>
          </div>
          <button
            onClick={() => toast.info('Export — sample stub. Real backend will generate CSV/Excel.')}
            className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md shadow-indigo-200 dark:shadow-indigo-900/40 press"
          >
            Export CSV <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>
    </GenVerseShell>
  );
}

function MetricCard({ metric, index }: { metric: AdminMetric; index: number }) {
  const Icon = ICON_MAP[metric.icon];
  const tone = TONE_CLASSES[metric.tone];
  return (
    <div
      className={cn(
        'group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-3 sm:p-4 animate-slideUp hover-lift hover:shadow-lg overflow-hidden card-shine',
        tone.glow,
      )}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className={cn('absolute -right-6 -top-6 w-20 h-20 rounded-full bg-gradient-to-br pointer-events-none', tone.accent, 'via-transparent to-transparent')} />

      <div className="relative">
        <div className="flex items-start justify-between mb-3">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6', tone.iconBg)}>
            <Icon className={cn('w-4 h-4', tone.iconText)} />
          </div>
        </div>
        <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none tracking-tight">{metric.displayValue}</p>
        <p className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">{metric.label}</p>
      </div>
    </div>
  );
}

function QuickAction({
  icon,
  label,
  description,
  onClick,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  tone: 'indigo' | 'emerald' | 'blue' | 'purple' | 'amber' | 'rose';
}) {
  const tones = {
    indigo: 'from-indigo-500 to-indigo-600 shadow-indigo-200 dark:shadow-indigo-900/40 hover:shadow-indigo-300',
    emerald: 'from-emerald-500 to-emerald-600 shadow-emerald-200 dark:shadow-emerald-900/40 hover:shadow-emerald-300',
    blue: 'from-blue-500 to-blue-600 shadow-blue-200 dark:shadow-blue-900/40 hover:shadow-blue-300',
    purple: 'from-purple-500 to-purple-600 shadow-purple-200 dark:shadow-purple-900/40 hover:shadow-purple-300',
    amber: 'from-amber-500 to-orange-500 shadow-amber-200 dark:shadow-amber-900/40 hover:shadow-amber-300',
    rose: 'from-rose-500 to-pink-500 shadow-rose-200 dark:shadow-rose-900/40 hover:shadow-rose-300',
  } as const;
  return (
    <button
      onClick={onClick}
      className="group text-left bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl p-3 transition-colors hover:shadow-md"
    >
      <div className={cn('w-9 h-9 rounded-lg bg-gradient-to-br text-white flex items-center justify-center mb-2 [&>svg]:w-5 [&>svg]:h-5 [&>svg]:stroke-[2.5]', tones[tone])}>
        {icon}
      </div>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">{label}</p>
      <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-1 leading-tight">{description}</p>
    </button>
  );
}
