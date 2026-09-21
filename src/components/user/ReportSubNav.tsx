/**
 * The second, report-scoped navy bar from the approved redesign — "Overview |
 * Subjects | Mistakes | Study Plan | Progress" — stacked under `UserShell`'s global
 * header rather than replacing it. Scoped to the report/study-plan/progress flow for
 * one attempt; the global header still carries Dashboard/Exams/Performance/History.
 *
 * `active` is passed explicitly by each page rather than derived from route
 * matching: a screen like AI Detailed Insights or Question Review doesn't map
 * cleanly onto one of the five words, so the page itself decides which tab stays
 * highlighted instead of a URL-pattern guess.
 */
import { Link } from 'react-router-dom';
import { LayoutGrid, BookOpen, AlertTriangle, CalendarCheck2, TrendingUp } from 'lucide-react';
import { REPORT_NAVY } from '@/components/user/UserShell';
import { cn } from '@/lib/utils';

export type ReportSubNavTab = 'overview' | 'subjects' | 'mistakes' | 'study-plan' | 'progress';

export function ReportSubNav({ attemptId, active }: { attemptId: string; active: ReportSubNavTab }) {
  const tabs: Array<{ key: ReportSubNavTab; label: string; to: string; icon: typeof LayoutGrid }> = [
    { key: 'overview', label: 'Overview', to: `/user/report/${attemptId}`, icon: LayoutGrid },
    { key: 'subjects', label: 'Subjects', to: `/user/report/${attemptId}/subjects`, icon: BookOpen },
    { key: 'mistakes', label: 'Mistakes', to: `/user/report/${attemptId}/mistakes`, icon: AlertTriangle },
    { key: 'study-plan', label: 'Study Plan', to: `/user/study-plan/${attemptId}`, icon: CalendarCheck2 },
    { key: 'progress', label: 'Progress', to: `/user/progress/${attemptId}`, icon: TrendingUp },
  ];

  return (
    <nav
      className="flex items-center gap-1 px-3 sm:px-5 py-2 overflow-x-auto scrollbar-thin border-b border-white/10"
      style={{ background: REPORT_NAVY }}
      aria-label="Report sections"
    >
      {tabs.map(t => (
        <Link
          key={t.key}
          to={t.to}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors whitespace-nowrap',
            active === t.key ? 'bg-white/15 text-white' : 'text-white/60 hover:text-white hover:bg-white/10',
          )}
        >
          <t.icon className="w-3.5 h-3.5 flex-shrink-0" />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
