import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Users, CheckCircle, Eye, TrendingUp, BarChart3, AlertCircle, ClipboardList, Timer, KeyRound, Pencil, EyeOff, type LucideIcon } from 'lucide-react';
import { useEvalAssessments, useEvalInvitationStats } from '@/hooks/use-eval-assessments';
import { DownloadDropdown } from './DownloadDropdown';
import { api } from '@/lib/api';
import { exportReport, type ExportFormat, type MetaField, type StudentRow } from '@/lib/eval-export-utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { difficultyLabel } from '@/lib/eval-difficulty';
import { cn } from '@/lib/utils';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { groupOfStage, readTnpscTag } from '@/lib/tnpscAdminApi';
import { kindOf, type AssessmentKind } from '@/lib/assessment-hierarchy';

interface Props {
  onViewReport: (assessmentId: string) => void;
}

type TabKey = AssessmentKind | 'unplaced';

const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'mock', label: 'Mock tests', icon: Timer },
  { key: 'keytopic', label: 'Key Topics', icon: KeyRound },
  { key: 'practice', label: 'Practice tests', icon: Pencil },
  { key: 'unplaced', label: 'Unplaced', icon: EyeOff },
];

/** The table's columns from `md` up; below it each report is a small card. */
const COLUMNS =
  'md:grid-cols-[minmax(0,2.6fr)_minmax(96px,0.8fr)_64px_76px_76px_minmax(120px,1fr)_minmax(150px,1.1fr)]';

/** Which tab an assessment belongs to, and which exam it is placed under. */
function placeOf(a: any): { tab: TabKey; group: string | null } {
  const tag = readTnpscTag(a);
  const group = tag.group_id ?? groupOfStage(tag.stage_id);
  const kind = tag.stage_id && tag.track ? kindOf(tag) : null;
  return { tab: kind ?? 'unplaced', group };
}

export function EvalReportsList({ onViewReport }: Props) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [tab, setTab] = useState<TabKey | null>(null);
  const { data: assessments, isLoading } = useEvalAssessments({ search });

  const assessmentIds = useMemo(() => (assessments || []).map((a: any) => a.id), [assessments]);
  const { data: stats = {} } = useEvalInvitationStats(assessmentIds);

  const placed = useMemo(
    () => ((assessments ?? []) as any[]).map(a => ({ a, ...placeOf(a) })),
    [assessments],
  );

  /** The exams that have a report to show, for the filter. */
  const groupOptions = useMemo(() => {
    const ids = new Set(placed.map(p => p.group).filter(Boolean) as string[]);
    return TNPSC_GROUPS.filter(g => ids.has(g.id)).map(g => ({ id: g.id, label: g.short_name }));
  }, [placed]);

  const inGroup = useMemo(
    () => placed.filter(p => groupFilter === 'all' || p.group === groupFilter),
    [placed, groupFilter],
  );

  const tabs = useMemo(
    () => TABS.map(t => ({ ...t, rows: inGroup.filter(p => p.tab === t.key).map(p => p.a) })).filter(t => t.rows.length > 0),
    [inGroup],
  );
  // Until a tab is picked it opens on the first that has reports; one a filter has emptied falls back the same way.
  const active = tabs.find(t => t.key === tab) ?? tabs[0] ?? null;

  const totals = useMemo(() => {
    let invited = 0;
    let submitted = 0;
    for (const { a } of inGroup) {
      const s = (stats as any)[a.id];
      invited += s?.invited || 0;
      submitted += s?.submitted || 0;
    }
    return { invited, submitted, completion: invited > 0 ? Math.round((submitted / invited) * 100) : null };
  }, [inGroup, stats]);
  const handleDownload = async (a: any, fmt: ExportFormat) => {
    try {
      toast.info('Preparing report...');
      const detail = await api.get<any>(`/api/v1/evaluation/assessments/${a.id}`);
      const invitations = detail?.invitations || [];
      const attempts = detail?.attempts || [];

      // Compute stats
      const latestByInv = new Map<string, any>();
      for (const att of attempts) {
        if (att.score == null) continue;
        const key = att.invitation_id || att.id;
        const ex = latestByInv.get(key);
        if (!ex || new Date(att.submitted_at) > new Date(ex.submitted_at)) latestByInv.set(key, att);
      }
      const submitted = latestByInv.size;
      const scores = Array.from(latestByInv.values()).map((at: any) => at.score || 0);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((s: number, b: number) => s + b, 0) / scores.length) : null;
      const highScore = scores.length > 0 ? Math.max(...scores) : null;
      const lowScore = scores.length > 0 ? Math.min(...scores) : null;

      const meta: MetaField[] = [
        { label: 'Mode', value: a.mode === 'exam' ? 'Mock test' : 'Practice' },
        { label: 'Difficulty', value: a.difficulty || '-' },
        { label: 'Questions', value: String(a.question_count || 0) },
        { label: 'Max Score', value: String(a.max_score || 0) },
        { label: 'Time Limit', value: a.time_limit ? `${a.time_limit} min` : 'No limit' },
        { label: 'Due Date', value: a.due_date ? format(new Date(a.due_date), 'dd MMM yyyy, hh:mm a') : '-' },
        { label: 'Total Invited', value: String(invitations.length) },
        { label: 'Total Submitted', value: String(submitted) },
        { label: 'Completion', value: invitations.length > 0 ? `${Math.round((submitted / invitations.length) * 100)}%` : '-' },
        { label: 'Average Score', value: avgScore != null ? String(avgScore) : '-' },
        { label: 'Highest Score', value: highScore != null ? String(highScore) : '-' },
        { label: 'Lowest Score', value: lowScore != null ? String(lowScore) : '-' },
      ];

      const studentRows: StudentRow[] = [];
      invitations.forEach((inv: any) => {
        const invAttempts = attempts
          .filter((at: any) => at.invitation_id === inv.id)
          .sort((x: any, y: any) => new Date(x.started_at || 0).getTime() - new Date(y.started_at || 0).getTime());
        if (invAttempts.length === 0) {
          studentRows.push({ email: inv.email, name: inv.name || '-', status: inv.status, score: '-', maxScore: '-', percentage: '-', timeTaken: '-', violations: '-', submitType: '-', startedAt: '-', submittedAt: '-', attempt: '0' });
        }
        invAttempts.forEach((att: any, idx: number) => {
          studentRows.push({
            email: inv.email, name: inv.name || '-', status: att.status,
            score: att.score?.toString() || '-',
            maxScore: att.max_score?.toString() || a.max_score?.toString() || '-',
            percentage: att.percentage != null ? `${Math.round(att.percentage)}%` : '-',
            timeTaken: att.started_at && att.submitted_at ? Math.round((new Date(att.submitted_at).getTime() - new Date(att.started_at).getTime()) / 60000).toString() : '-',
            violations: att.attempt_metadata?.tab_violations?.toString() || '0',
            submitType: att.attempt_metadata?.submit_reason || 'manual',
            startedAt: att.started_at ? format(new Date(att.started_at), 'yyyy-MM-dd HH:mm') : '-',
            submittedAt: att.submitted_at ? format(new Date(att.submitted_at), 'yyyy-MM-dd HH:mm') : '-',
            attempt: (idx + 1).toString(),
          });
        });
      });

      await exportReport(meta, studentRows, `Report: ${a.title}`, fmt);
      toast.success('Report downloaded');
    } catch {
      toast.error('Failed to download report');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and the exam filter, on one line. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assessments..." className="pl-9" />
        </div>
        {groupOptions.length > 1 && (
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="All exams" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All exams</SelectItem>
              {groupOptions.map(g => (
                <SelectItem key={g.id} value={g.id}>
                  {g.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* The figures for what the filters leave. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={ClipboardList} label="Assessments" value={String(inGroup.length)} tone="bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300" />
        <Tile icon={Users} label="Invited" value={String(totals.invited)} tone="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300" />
        <Tile icon={CheckCircle} label="Submitted" value={String(totals.submitted)} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300" />
        <Tile icon={TrendingUp} label="Completion" value={totals.completion != null ? `${totals.completion}%` : '—'} tone="bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300" />
      </div>

      {!active ? (
        <div className="py-12 text-center text-muted-foreground">
          <BarChart3 className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-sm">No assessments to report on yet.</p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold">
              All Reports <span className="font-semibold text-muted-foreground">({inGroup.length})</span>
            </h3>
            {tabs.length > 1 && (
              <div role="tablist" aria-label="Kind of assessment" className="inline-flex rounded-xl bg-muted p-1">
                {tabs.map(t => {
                  const on = t.key === active.key;
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setTab(t.key)}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-all',
                        on ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {t.label}
                      <span className={cn('rounded-full px-1.5 text-[11px] font-bold tabular-nums', on ? 'bg-muted' : 'bg-background/60')}>
                        {t.rows.length}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <section role="tabpanel" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div
              className={cn(
                'hidden items-center gap-3 bg-muted/40 px-4 py-2 md:grid',
                'text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground',
                COLUMNS,
              )}
            >
              <span>Assessment</span>
              <span>Created</span>
              <span className="text-right">Invited</span>
              <span className="text-right">Submitted</span>
              <span className="text-right">Avg score</span>
              <span>Completion</span>
              <span className="text-right">Report</span>
            </div>
            <div className="divide-y">
              {active.rows.map(a => (
                <ReportRow
                  key={a.id}
                  a={a}
                  stat={(stats as any)[a.id]}
                  onView={() => onViewReport(a.id)}
                  onDownload={fmt => handleDownload(a, fmt)}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Tile({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold leading-tight tabular-nums">{value}</p>
      </div>
    </div>
  );
}

/** One assessment's report: a row of the table from `md` up, a small card below it. */
function ReportRow({
  a,
  stat,
  onView,
  onDownload,
}: {
  a: any;
  stat: any;
  onView: () => void;
  onDownload: (fmt: ExportFormat) => void;
}) {
  const invited = stat?.invited || 0;
  const submitted = stat?.submitted || 0;
  const completion = invited > 0 ? Math.round((submitted / invited) * 100) : 0;
  const expired = !!a.due_date && new Date(a.due_date) < new Date();
  const created = a.created_at ? format(new Date(a.created_at), 'dd MMM yyyy') : '—';

  return (
    <div
      className={cn(
        'grid grid-cols-2 items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors hover:bg-muted/40 md:items-center',
        COLUMNS,
        expired && 'opacity-80',
      )}
    >
      <div className="col-span-2 min-w-0 md:col-span-1">
        <p className="line-clamp-2 text-sm font-bold leading-snug">{a.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <span>
            {difficultyLabel(a.difficulty)} · {a.question_count} Q
            {a.negative_marking && ` · -${a.negative_mark_value || 0.25} negative`}
          </span>
          {expired && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
              <AlertCircle className="h-3 w-3" /> Expired
            </span>
          )}
        </p>
      </div>

      <Cell label="Created">
        <span className="text-sm">{created}</span>
        {a.due_date && (
          <span className={cn('block text-[11px]', expired ? 'text-red-500' : 'text-muted-foreground')}>
            {expired ? 'Expired' : 'Due'} {format(new Date(a.due_date), 'dd MMM')}
          </span>
        )}
      </Cell>
      <Cell label="Invited" align="right">
        <span className="text-sm font-semibold tabular-nums">{invited}</span>
      </Cell>
      <Cell label="Submitted" align="right">
        <span className="text-sm font-semibold tabular-nums">{submitted}</span>
      </Cell>
      <Cell label="Avg score" align="right">
        <span className="text-sm font-semibold tabular-nums">{stat?.avgScore ?? '—'}</span>
      </Cell>
      <Cell label="Completion">
        {invited > 0 ? (
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
              <span
                className={cn('block h-full rounded-full', completion === 100 ? 'bg-green-500' : 'bg-brand-500')}
                style={{ width: `${Math.min(completion, 100)}%` }}
              />
            </span>
            <span className="text-xs font-semibold tabular-nums">{completion}%</span>
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">No invitations</span>
        )}
      </Cell>

      <div className="col-span-2 flex items-center justify-end gap-1.5 md:col-span-1">
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={onView}>
          <Eye className="h-3.5 w-3.5" /> View Report
        </Button>
        <DownloadDropdown onDownload={onDownload} size="icon" variant="outline" />
      </div>
    </div>
  );
}

/** A table cell that, on a phone, names itself above its value. */
function Cell({ label, align, children }: { label: string; align?: 'right'; children: React.ReactNode }) {
  return (
    <div className={cn('min-w-0', align === 'right' && 'md:text-right')}>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground md:hidden">{label}</p>
      {children}
    </div>
  );
}