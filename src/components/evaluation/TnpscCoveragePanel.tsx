import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, CheckCircle2, Layers, Target, TriangleAlert } from 'lucide-react';
import { useEvalAssessments } from '@/hooks/use-eval-assessments';
import { computeCoverage, readTnpscTag } from '@/lib/tnpscAdminApi';
import { LEVEL_META, TNPSC_GROUPS, TNPSC_LEVELS, findStage, type TnpscLevel } from '@/config/tnpsc';
import { cn } from '@/lib/utils';

/** Target number of published mocks per level before a stage is considered ready. */
const MOCK_TARGET: Record<TnpscLevel, number> = { simple: 3, medium: 3, complex: 2 };

const ACTIVE_STAGES = TNPSC_GROUPS.flatMap(g =>
  g.stages.filter(s => s.status === 'active').map(s => ({ group: g, stage: s })),
);

/**
 * Content-readiness view: how many mocks exist per level and which syllabus
 * subjects still have no practice sets. Counts are derived from the assessments
 * list until GET /api/v1/admin/tnpsc/coverage ships.
 */
export function TnpscCoveragePanel() {
  const [stageId, setStageId] = useState(ACTIVE_STAGES[0]?.stage.id ?? '');
  const { data: assessments, isLoading } = useEvalAssessments();

  const rows = (assessments as any[]) || [];
  const coverage = useMemo(() => computeCoverage(stageId, rows), [stageId, rows]);
  const untagged = useMemo(() => rows.filter(r => !readTnpscTag(r).stage_id).length, [rows]);

  const stage = findStage(undefined, stageId, TNPSC_GROUPS)?.stage
    ?? ACTIVE_STAGES.find(x => x.stage.id === stageId)?.stage;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </div>
    );
  }

  const practiceSubjects = coverage.practice.subjects;
  const subjectsReady = practiceSubjects.filter(s => s.sets > 0).length;
  const topicsCovered = practiceSubjects.reduce((n, s) => n + s.topics_with_sets, 0);
  const topicsTotal = practiceSubjects.reduce((n, s) => n + s.topics_total, 0);

  return (
    <div className="space-y-5">
      {/* Stage picker */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={stageId} onValueChange={setStageId}>
          <SelectTrigger className="w-[280px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACTIVE_STAGES.map(({ group, stage: s }) => (
              <SelectItem key={s.id} value={s.id}>{group.name} — {s.short_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {stage?.pattern && (
          <span className="text-xs text-muted-foreground">
            Pattern: {stage.pattern.total_questions} questions · {stage.pattern.total_marks} marks ·{' '}
            {stage.pattern.duration_minutes / 60} hours
          </span>
        )}
        {!coverage.server_computed && (
          <Badge variant="outline" className="text-[10px]">counted in browser</Badge>
        )}
      </div>

      {untagged > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
          <TriangleAlert className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <b>{untagged}</b> assessment{untagged !== 1 ? 's are' : ' is'} not tagged to any TNPSC stage —
            invisible to aspirants. Tag them from the Assessments tab.
          </p>
        </div>
      )}

      {/* Mock levels */}
      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-2">
          <Target className="h-4 w-4 text-indigo-500" /> Mock tests by level
        </h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {TNPSC_LEVELS.map(lv => {
            const count = coverage.mock[lv] ?? 0;
            const target = MOCK_TARGET[lv];
            const ready = count >= target;
            return (
              <Card key={lv} className={cn(ready ? 'border-emerald-200 dark:border-emerald-900' : 'border-amber-200 dark:border-amber-900')}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{LEVEL_META[lv].label}</span>
                    {ready
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  </div>
                  <p className="mt-1 text-2xl font-bold tabular-nums">
                    {count}<span className="text-sm font-normal text-muted-foreground"> / {target}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {count === 0
                      ? 'None published — this level is empty for aspirants.'
                      : ready ? 'Target met.' : `Add ${target - count} more.`}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {coverage.mock.simple === 0 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            With no Simple mocks published, all three levels stay unlocked for aspirants (nothing to
            clear). The gate switches on as soon as the first Simple mock goes live.
          </p>
        )}
      </section>

      {/* Practice coverage */}
      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-semibold mb-2">
          <Layers className="h-4 w-4 text-emerald-500" /> Practice sets by subject
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {subjectsReady}/{practiceSubjects.length} subjects · {topicsCovered}/{topicsTotal} topics covered
          </span>
        </h3>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
          {practiceSubjects.map(s => {
            const pct = s.topics_total > 0 ? Math.round((s.topics_with_sets / s.topics_total) * 100) : 0;
            return (
              <div key={s.subject_id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{s.subject_name ?? s.subject_id}</p>
                  <div className="mt-1 h-1.5 w-full max-w-xs rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-indigo-500' : 'bg-transparent')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
                  {s.topics_with_sets}/{s.topics_total} topics
                </span>
                <Badge variant="outline" className={cn('text-[10px] shrink-0', s.sets === 0 && 'text-muted-foreground')}>
                  {s.sets} set{s.sets !== 1 ? 's' : ''}
                </Badge>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
