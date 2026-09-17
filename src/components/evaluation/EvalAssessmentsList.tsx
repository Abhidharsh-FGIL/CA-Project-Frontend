import { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Trash2, FileText, Users, Send, CheckCircle, AlertCircle, TrendingUp, BookOpen, Shuffle, Pin, ChevronDown, ChevronUp, Tag, EyeOff } from 'lucide-react';
import { useEvalAssessments, useDeleteEvalAssessment, useEvalInvitationStats } from '@/hooks/use-eval-assessments';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { format } from 'date-fns';
import { TnpscTagDialog } from './TnpscTagDialog';
import { describeTag, isTagged, readTnpscTag } from '@/lib/tnpscAdminApi';
import { TNPSC_GROUPS } from '@/config/tnpsc';

interface Props {
  onDistribute: (assessmentId: string) => void;
  onViewReport?: (assessmentId: string) => void;
}

function getDisplayStatus(a: any): 'active' | 'expired' {
  if (a.due_date && new Date(a.due_date) < new Date()) return 'expired';
  return 'active';
}

const STATUS_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  active: { color: 'bg-green-500/10 text-green-700 dark:text-green-400', icon: CheckCircle, label: 'Active' },
  expired: { color: 'bg-gray-500/10 text-gray-500 dark:text-gray-400', icon: AlertCircle, label: 'Expired' },
};

interface AssessmentCardProps {
  a: any;
  st: { color: string; icon: any; label: string };
  StatusIcon: any;
  isExpired: boolean;
  invited: number;
  submitted: number;
  completionPct: number;
  isConstant: boolean;
  hasQuestions: boolean;
  stat: any;
  onDistribute: (assessmentId: string) => void;
  onDelete: () => void;
}

function AssessmentCard({
  a, st, StatusIcon, isExpired, invited, submitted, completionPct,
  isConstant, hasQuestions, stat, onDistribute, onDelete,
}: AssessmentCardProps) {
  const [showQuestions, setShowQuestions] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const tnpsc = readTnpscTag(a);
  const placed = isTagged(tnpsc);

  return (
    <Card className={`group hover:shadow-md transition-shadow ${isExpired ? 'opacity-75' : ''}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm truncate">{a.title}</h4>
            {a.course_name && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 rounded-full px-2 py-0.5 mt-1">
                <BookOpen className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate max-w-[160px]">{a.course_name}</span>
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              {a.difficulty} • {a.question_count} Q
              {a.max_score ? ` • ${a.max_score} marks` : ''}
              {a.negative_marking && ` • -${a.negative_mark_value || 0.25} negative`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0 justify-end">
            <Badge
              variant="outline"
              className={`text-[10px] gap-1 ${placed
                ? 'border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400'
                : 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400'}`}
              title={placed ? 'Visible in the aspirant portal' : 'Not tagged — invisible to aspirants'}
            >
              {placed ? <Tag className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {placed ? describeTag(tnpsc) : 'Not placed'}
            </Badge>
            {a.mode && (
              <Badge variant="outline" className={`text-[10px] ${a.mode === 'exam' ? 'border-red-300 text-red-600 dark:border-red-700 dark:text-red-400' : 'border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400'}`}>
                {a.mode === 'exam' ? 'Mock test' : 'Practice'}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] gap-1 ${isConstant
                ? 'border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400'
                : 'border-sky-300 text-sky-600 dark:border-sky-700 dark:text-sky-400'
              }`}
            >
              {isConstant ? <Pin className="h-3 w-3" /> : <Shuffle className="h-3 w-3" />}
              {isConstant ? 'Constant' : 'Shuffle'}
            </Badge>
            <Badge variant="outline" className={`text-[10px] gap-1 ${st.color}`}>
              <StatusIcon className="h-3 w-3" />
              {st.label}
            </Badge>
          </div>
        </div>

        {/* Stats grid */}
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

        {/* Constant questions list (collapsible) */}
        {hasQuestions && (
          <div className="border border-violet-100 dark:border-violet-900 rounded-lg overflow-hidden">
            <button
              onClick={() => setShowQuestions(v => !v)}
              className="w-full flex items-center justify-between px-3 py-2 bg-violet-50 dark:bg-violet-950/30 text-[11px] font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-950/50 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Pin className="h-3 w-3" />
                Fixed questions ({a.questions.length})
              </span>
              {showQuestions ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showQuestions && (
              <ul className="divide-y divide-violet-50 dark:divide-violet-900/50 max-h-48 overflow-y-auto">
                {a.questions.map((q: any, idx: number) => (
                  <li key={q.id} className="px-3 py-2 flex items-start gap-2">
                    <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5 w-5 text-right">{idx + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] leading-snug line-clamp-2">{q.question_text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {q.correct_answer != null && (
                          <span className="text-[10px] font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded px-1.5 py-0.5">
                            Ans: {q.correct_answer}
                          </span>
                        )}
                        {q.marks != null && (
                          <span className="text-[10px] text-muted-foreground">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Due date */}
        <p className={`text-[11px] ${isExpired ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
          {a.due_date
            ? `${isExpired ? 'Expired' : 'Due'}: ${format(new Date(a.due_date), 'dd MMM yyyy')}`
            : 'Due: None'}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-[10px] text-muted-foreground">
            Created {format(new Date(a.created_at), 'dd MMM yyyy')}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant={placed ? 'ghost' : 'outline'}
              size="sm"
              className={`h-7 text-xs gap-1 ${!placed ? 'border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400' : ''}`}
              onClick={() => setTagOpen(true)}
            >
              <Tag className="h-3 w-3" /> {placed ? 'Placement' : 'Place'}
            </Button>
            {!isExpired && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={() => onDistribute(a.id)}>
                <Send className="h-3 w-3" /> Invite
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Assessment?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete &quot;{a.title}&quot; and all its invitations/attempts.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>

      <TnpscTagDialog open={tagOpen} onOpenChange={setTagOpen} assessment={a} />
    </Card>
  );
}

export function EvalAssessmentsList({ onDistribute, onViewReport }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [placementFilter, setPlacementFilter] = useState('all');

  const { data: assessments, isLoading } = useEvalAssessments({ search });
  const deleteAssessment = useDeleteEvalAssessment();

  const assessmentIds = useMemo(() => (assessments || []).map((a: any) => a.id), [assessments]);
  const { data: stats = {} } = useEvalInvitationStats(assessmentIds);

  const filtered = useMemo(() => {
    if (!assessments) return [];
    let rows = assessments as any[];
    if (statusFilter !== 'all') rows = rows.filter((a: any) => getDisplayStatus(a) === statusFilter);
    if (placementFilter !== 'all') {
      rows = rows.filter((a: any) => {
        const t = readTnpscTag(a);
        if (placementFilter === 'untagged') return !isTagged(t);
        if (placementFilter === 'mock' || placementFilter === 'practice') return t.track === placementFilter;
        return t.stage_id === placementFilter;
      });
    }
    return rows;
  }, [assessments, statusFilter, placementFilter]);

  const untaggedCount = useMemo(
    () => ((assessments as any[]) || []).filter((a: any) => !isTagged(readTnpscTag(a))).length,
    [assessments],
  );

  const { visible: visibleAssessments, sentinelRef, hasMore, shown, total } = useInfiniteList<any>(filtered as any[], 24);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full" />)}
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
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select value={placementFilter} onValueChange={setPlacementFilter}>
          <SelectTrigger className="w-[210px]">
            <SelectValue placeholder="TNPSC placement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All placements</SelectItem>
            <SelectItem value="untagged">Not placed{untaggedCount > 0 ? ` (${untaggedCount})` : ''}</SelectItem>
            <SelectItem value="mock">Mock tests</SelectItem>
            <SelectItem value="practice">Practice tests</SelectItem>
            {TNPSC_GROUPS.flatMap(g =>
              g.stages
                .filter(s => s.status === 'active')
                .map(s => (
                  <SelectItem key={s.id} value={s.id}>{g.short_name} — {s.short_name}</SelectItem>
                )),
            )}
          </SelectContent>
        </Select>
      </div>

      {untaggedCount > 0 && placementFilter === 'all' && (
        <button
          onClick={() => setPlacementFilter('untagged')}
          className="w-full flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-left hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
        >
          <EyeOff className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <span className="text-xs text-amber-800 dark:text-amber-200">
            <b>{untaggedCount}</b> assessment{untaggedCount !== 1 ? 's have' : ' has'} no TNPSC placement and
            {untaggedCount !== 1 ? ' are' : ' is'} invisible to aspirants. Click to review.
          </span>
        </button>
      )}

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">
            {statusFilter !== 'all' ? `No ${statusFilter} assessments found.` : 'No assessments yet. Create one from the question bank.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleAssessments.map((a: any) => {
            const displayStatus = getDisplayStatus(a);
            const st = STATUS_CONFIG[displayStatus];
            const stat = (stats as any)[a.id];
            const StatusIcon = st.icon;
            const isExpired = displayStatus === 'expired';
            const invited = stat?.invited || 0;
            const submitted = stat?.submitted || 0;
            const completionPct = invited > 0 ? Math.round((submitted / invited) * 100) : 0;
            const isConstant = a.shuffle_questions === false;
            const hasQuestions = isConstant && Array.isArray(a.questions) && a.questions.length > 0;

            return (
              <AssessmentCard
                key={a.id}
                a={a}
                st={st}
                StatusIcon={StatusIcon}
                isExpired={isExpired}
                invited={invited}
                submitted={submitted}
                completionPct={completionPct}
                isConstant={isConstant}
                hasQuestions={hasQuestions}
                stat={stat}
                onDistribute={onDistribute}
                onDelete={() => deleteAssessment.mutate(a.id)}
              />
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <>
          <div ref={sentinelRef} className="h-1" />
          <p className="text-center text-xs text-muted-foreground py-2">
            {hasMore ? `Loading more… (${shown} of ${total})` : `All ${total} assessments loaded`}
          </p>
        </>
      )}

    </div>
  );
}
