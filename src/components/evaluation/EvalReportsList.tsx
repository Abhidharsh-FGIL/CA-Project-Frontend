import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileText, Users, CheckCircle, Eye, Download, TrendingUp, BarChart3, AlertCircle } from 'lucide-react';
import { useEvalAssessments, useEvalInvitationStats } from '@/hooks/use-eval-assessments';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { DownloadDropdown } from './DownloadDropdown';
import { api } from '@/lib/api';
import { exportReport, type ExportFormat, type MetaField, type StudentRow } from '@/lib/eval-export-utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Props {
  onViewReport: (assessmentId: string) => void;
}

export function EvalReportsList({ onViewReport }: Props) {
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
  const { data: assessments, isLoading } = useEvalAssessments({ search });

  const assessmentIds = useMemo(() => (assessments || []).map((a: any) => a.id), [assessments]);
  const { data: stats = {} } = useEvalInvitationStats(assessmentIds);

  const filtered = useMemo(() => {
    if (!assessments) return [];
    if (modeFilter === 'all') return assessments;
    return (assessments as any[]).filter((a: any) => a.mode === modeFilter);
  }, [assessments, modeFilter]);

  const { visible: visibleReports, sentinelRef, hasMore, shown, total } = useInfiniteList<any>(filtered as any[], 24);

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
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assessments..." className="pl-9" />
        </div>
        <Select value={modeFilter} onValueChange={setModeFilter}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="exam">Mock test</SelectItem>
            <SelectItem value="practice">Practice</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {modeFilter !== 'all' ? `No ${modeFilter} assessments found.` : 'No assessments to report on yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleReports.map((a: any) => {
            const stat = (stats as any)[a.id];
            const invited = stat?.invited || 0;
            const submitted = stat?.submitted || 0;
            const completionPct = invited > 0 ? Math.round((submitted / invited) * 100) : 0;
            const isExpired = a.due_date && new Date(a.due_date) < new Date();

            return (
              <Card key={a.id} className={`group hover:shadow-md transition-shadow flex flex-col ${isExpired ? 'opacity-80' : ''}`}>
                <CardContent className="p-4 space-y-3 flex flex-col flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">{a.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {a.board && `${a.board} • `}
                        {a.grade && `Grade ${a.grade} • `}
                        {a.difficulty} • {a.question_count} Q
                        {a.negative_marking && ` • -${a.negative_mark_value || 0.25} negative`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className={`text-[10px] ${a.mode === 'exam' ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400' : 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400'}`}>
                        {a.mode === 'exam' ? 'Mock test' : 'Practice'}
                      </Badge>
                      {isExpired && (
                        <Badge variant="outline" className="text-[10px] bg-gray-500/10 text-gray-500">
                          <AlertCircle className="h-3 w-3 mr-0.5" /> Expired
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <Users className="h-3 w-3" /> Invited
                      </p>
                      <p className="text-sm font-semibold">{invited}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Submitted
                      </p>
                      <p className="text-sm font-semibold">{submitted}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-center">
                      <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                        <TrendingUp className="h-3 w-3" /> Avg Score
                      </p>
                      <p className="text-sm font-semibold">{stat?.avgScore ?? '-'}</p>
                    </div>
                  </div>

                  {/* Completion bar */}
                  {invited > 0 && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>Completion</span>
                        <span>{completionPct}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${completionPct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`}
                          style={{ width: `${Math.min(completionPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Due date */}
                  {a.due_date && (
                    <p className={`text-[11px] ${isExpired ? 'text-red-500' : 'text-muted-foreground'}`}>
                      {isExpired ? 'Expired' : 'Due'}: {format(new Date(a.due_date), 'dd MMM yyyy')}
                    </p>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t mt-auto">
                    <span className="text-[10px] text-muted-foreground">
                      Created {format(new Date(a.created_at), 'dd MMM yyyy')}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Button variant="default" size="sm" className="h-7 text-xs gap-1.5" onClick={() => onViewReport(a.id)}>
                        <Eye className="h-3 w-3" /> View Report
                      </Button>
                      <DownloadDropdown
                        onDownload={(fmt) => handleDownload(a, fmt)}
                        size="icon"
                        variant="outline"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <>
          <div ref={sentinelRef} className="h-1" />
          <p className="text-center text-xs text-muted-foreground py-2">
            {hasMore ? `Loading more… (${shown} of ${total})` : `All ${total} reports loaded`}
          </p>
        </>
      )}
    </div>
  );
}
