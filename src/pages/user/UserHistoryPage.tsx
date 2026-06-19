import { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { Search, Download, FileText, CheckCircle2, XCircle, Clock, AlertTriangle, Trophy, Target, BarChart3, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ReportBody } from '@/components/user/ReportBody';

export default function UserHistoryPage() {
  const { history, courses, canDownloadPDF, refreshHistory } = useUserPortal();

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);
  const [query, setQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'practice' | 'mock'>('all');
  const [reportAttemptId, setReportAttemptId] = useState<string | null>(null);
  const reportAttempt = useMemo(
    () => (reportAttemptId ? history.find(h => h.attempt_id === reportAttemptId) : null),
    [reportAttemptId, history],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter(h => {
      if (q && !(h.test_name ?? '').toLowerCase().includes(q)) return false;
      if (courseFilter !== 'all' && h.course_id !== courseFilter) return false;
      if (modeFilter !== 'all' && h.test_mode !== modeFilter) return false;
      return true;
    });
  }, [history, query, courseFilter, modeFilter]);

  const stats = useMemo(() => {
    const completed = history.filter(h => h.status !== 'in_progress' && h.percentage !== null);
    const bestScore = completed.length ? Math.max(...completed.map(h => h.percentage ?? 0)) : 0;
    const avgScore = completed.length
      ? Math.round(completed.reduce((s, h) => s + (h.percentage ?? 0), 0) / completed.length)
      : 0;
    const totalAttempts = completed.length;
    const thisMonth = completed.filter(h => {
      const d = new Date(h.start_time);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return { bestScore, avgScore, totalAttempts, thisMonth };
  }, [history]);

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
                Your Progress
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                Test <span className="gradient-text-animated">History</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5">
                All your past attempts and AI reports in one place.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-6">
        <HistoryStat
          icon={<Trophy className="w-4 h-4" />}
          label="Best Score"
          value={`${stats.bestScore}%`}
          tone="amber"
          index={0}
        />
        <HistoryStat
          icon={<Target className="w-4 h-4" />}
          label="Average"
          value={`${stats.avgScore}%`}
          tone="emerald"
          index={1}
        />
        <HistoryStat
          icon={<BarChart3 className="w-4 h-4" />}
          label="Total Attempts"
          value={String(stats.totalAttempts)}
          tone="indigo"
          index={2}
        />
        <HistoryStat
          icon={<CalendarDays className="w-4 h-4" />}
          label="This Month"
          value={String(stats.thisMonth)}
          tone="rose"
          index={3}
        />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-3 sm:p-4 mb-5 flex flex-wrap gap-2 sm:gap-3">
        <div className="relative flex-1 min-w-full sm:min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by test name..."
            className="w-full pl-9 pr-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/40"
          />
        </div>
        <select
          value={courseFilter}
          onChange={e => setCourseFilter(e.target.value)}
          className="flex-1 sm:flex-initial px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/40"
        >
          <option value="all">All courses</option>
          {courses.map(c => (
            <option key={c.course_id} value={c.course_id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={modeFilter}
          onChange={e => setModeFilter(e.target.value as any)}
          className="flex-1 sm:flex-initial px-3 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900/40"
        >
          <option value="all">All modes</option>
          <option value="practice">Practice</option>
          <option value="mock">Mock</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm animate-fadeIn">
        {filtered.length === 0 ? (
          <div className="p-12 text-center animate-fadeIn">
            <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3 animate-bounce-soft" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No attempts match your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filtered.map((a, i) => (
              <div
                key={a.attempt_id}
                className="p-3 sm:p-4 hover:bg-indigo-50/40 dark:hover:bg-indigo-950/30 transition-colors animate-slideInLeft"
                style={{ animationDelay: `${i * 0.04}s` }}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div className="min-w-0 flex-1 w-full sm:w-auto">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {a.test_mode && (
                        <span
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
                            a.test_mode === 'mock'
                              ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300'
                              : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
                          )}
                        >
                          {a.test_mode}
                        </span>
                      )}
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
                        {a.test_name ?? 'Test Attempt'}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {a.course_id ? (courses.find(c => c.course_id === a.course_id)?.name ?? '—') : '—'} ·{' '}
                      {new Date(a.start_time).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px]">
                      {a.percentage !== null ? (
                        <span
                          className={cn(
                            'font-bold px-2 py-0.5 rounded',
                            (a.percentage ?? 0) >= 70
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                              : (a.percentage ?? 0) >= 50
                              ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                              : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
                          )}
                        >
                          {a.score !== null ? `${a.score} pts · ` : ''}{Math.round(a.percentage ?? 0)}%
                        </span>
                      ) : (
                        <span className="font-bold px-2 py-0.5 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400">
                          Incomplete
                        </span>
                      )}
                      {a.auto_submitted && (
                        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                          <AlertTriangle className="w-3 h-3" /> Auto-submitted
                        </span>
                      )}
                      {Array.isArray(a.malpractice_events) && a.malpractice_events.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
                          <XCircle className="w-3 h-3" /> {a.malpractice_events.length} flag{a.malpractice_events.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {a.end_time && a.start_time && (() => {
                        const ms = new Date(a.end_time).getTime() - new Date(a.start_time).getTime();
                        const label = ms <= 0 ? null : ms < 60000 ? '< 1 min' : `${Math.round(ms / 60000)} min`;
                        return label ? (
                          <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <Clock className="w-3 h-3" /> {label}
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
                    {a.status !== 'in_progress' && (
                    <button
                      onClick={() => setReportAttemptId(a.attempt_id)}
                      className="group text-xs font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-3 py-1.5 rounded-lg transition-all hover:shadow-sm press inline-flex items-center gap-1"
                    >
                      View Report
                      <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">→</span>
                    </button>
                    )}
                    {canDownloadPDF && (
                      <button
                        onClick={() => alert('PDF download — sample stub. Real backend will generate the file.')}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 px-2 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                        PDF
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!canDownloadPDF && (
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">
          PDF download is available on Standard tier and above.{' '}
          <Link to="/user/subscription" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
            Upgrade
          </Link>
        </p>
      )}

      <Sheet open={!!reportAttemptId} onOpenChange={open => { if (!open) setReportAttemptId(null); }}>
        <SheetContent
          side="right"
          className="overflow-y-auto p-4 sm:p-6"
          style={{ maxWidth: 'min(100vw, 900px)', width: 'min(100vw, 900px)' }}
        >
          {reportAttempt && <ReportBody attempt={reportAttempt} canDownloadPDF={canDownloadPDF} />}
        </SheetContent>
      </Sheet>
    </UserShell>
  );
}

function HistoryStat({
  icon,
  label,
  value,
  tone,
  index = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose';
  index?: number;
}) {
  const toneText: Record<typeof tone, string> = {
    indigo: 'text-indigo-600 dark:text-indigo-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  } as any;
  const toneAccent: Record<typeof tone, string> = {
    indigo: 'from-indigo-500/10',
    emerald: 'from-emerald-500/10',
    amber: 'from-amber-500/10',
    rose: 'from-rose-500/10',
  } as any;
  const toneGlow: Record<typeof tone, string> = {
    indigo: 'hover:shadow-indigo-100/50 dark:hover:shadow-indigo-950/40',
    emerald: 'hover:shadow-emerald-100/50 dark:hover:shadow-emerald-950/40',
    amber: 'hover:shadow-amber-100/50 dark:hover:shadow-amber-950/40',
    rose: 'hover:shadow-rose-100/50 dark:hover:shadow-rose-950/40',
  } as any;
  const toneBorder: Record<typeof tone, string> = {
    indigo: 'border-l-indigo-500',
    emerald: 'border-l-emerald-500',
    amber: 'border-l-amber-500',
    rose: 'border-l-rose-500',
  } as any;
  return (
    <div
      className={`group relative bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 border-l-2 ${toneBorder[tone]} p-3 sm:p-4 animate-slideUp hover-lift hover:shadow-lg ${toneGlow[tone]} card-shine overflow-hidden`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br ${toneAccent[tone]} via-transparent to-transparent pointer-events-none`} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <span className={`${toneText[tone]} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
            {icon}
          </span>
          <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500 dark:text-gray-400 font-medium">
            {label}
          </p>
        </div>
        <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 leading-none tabular-nums tracking-tight">
          {value}
        </p>
      </div>
    </div>
  );
}
