import { Fragment, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Download, Users, CheckCircle, TrendingUp, Clock, RefreshCw, Send, AlertTriangle, Eye, XCircle, HelpCircle, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useEvalAssessmentDetail, useEvalAttemptDetail, useReinviteEvalAssessment } from '@/hooks/use-eval-assessments';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { DownloadDropdown } from './DownloadDropdown';
import { exportReport, type ExportFormat, type MetaField, type StudentRow } from '@/lib/eval-export-utils';
import { format } from 'date-fns';
import { MathText } from '@/components/ui/MathText';
import { AttemptReport } from '@/components/user/ReportBody';

interface Props {
  assessmentId: string;
  onBack: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  started: 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
  submitted: 'bg-green-500/10 text-green-700 dark:text-green-400',
  auto_submitted: 'bg-red-500/10 text-red-700 dark:text-red-400',
  evaluated: 'bg-purple-500/10 text-purple-700 dark:text-purple-400',
  in_progress: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  timed_out: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  in_progress: 'Incomplete',
  submitted: 'Submitted',
  auto_submitted: 'Auto-submitted',
  timed_out: 'Auto-submitted',
  pending: 'Pending',
  started: 'Started',
  evaluated: 'Evaluated',
};

// ── Attempt Detail View — renders the full student-style report ──
function AttemptDetailView({ assessmentId, attemptId, studentLabel, onBack }: {
  assessmentId: string;
  attemptId: string;
  studentLabel: string;
  onBack: () => void;
}) {
  const { data: raw, isLoading } = useEvalAttemptDetail(assessmentId, attemptId);
  // Pass the response straight through. If it has no nested `attempt`, build one from the flat fields.
  const attempt = raw?.attempt ?? {
    attempt_id: attemptId,
    test_name: raw?.assessment_title ?? raw?.test_name ?? null,
    course_id: null,
    start_time: raw?.started_at ?? null,
    end_time: raw?.submitted_at ?? null,
    score: raw?.score ?? null,
    max_score: raw?.max_score ?? null,
    percentage: raw?.percentage ?? null,
    status: raw?.status ?? 'submitted',
    auto_submitted: raw?.auto_submitted ?? false,
    malpractice_events: [],
    attempt_type: 'eval',
    analysis_text: raw?.analysis_text ?? null,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h3 className="font-semibold text-lg truncate">
            {raw?.student_name || raw?.student_email || studentLabel || 'Student'} — Report
          </h3>
          {raw?.attempt?.test_name && <p className="text-xs text-muted-foreground truncate">{raw.attempt.test_name}</p>}
        </div>
      </div>

      <AttemptReport
        detail={raw ?? null}
        attempt={attempt}
        courseName={null}
        canDownloadPDF
        loading={isLoading}
        fetchError={!isLoading && !raw}
        studentName={raw?.student_name || raw?.student_email || studentLabel || 'Student'}
      />
    </div>
  );
}

// Legacy detailed breakdown — replaced by the student-style report above; no longer rendered.
function AttemptDetailViewLegacy({ assessmentId, attemptId, onBack }: {
  assessmentId: string;
  attemptId: string;
  studentLabel: string;
  onBack: () => void;
}) {
  const { data: detail, isLoading } = useEvalAttemptDetail(assessmentId, attemptId);
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'unanswered'>('all');

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!detail) return <p className="text-muted-foreground">Failed to load attempt details.</p>;

  // Normalize backend question fields → what this view reads.
  // Backend sends: question_id/text/type/user_answer; correct_answer is the option TEXT.
  const questions = (detail.questions || []).map((q: any) => ({
    ...q,
    id: q.id ?? q.question_id,
    question_type: q.question_type ?? q.type,
    question_text: q.question_text ?? q.text,
    student_answer: q.student_answer ?? q.user_answer ?? null,
  }));
  const filtered = filter === 'all' ? questions
    : filter === 'correct' ? questions.filter((q: any) => q.is_correct)
    : filter === 'wrong' ? questions.filter((q: any) => q.student_answer && !q.is_correct)
    : questions.filter((q: any) => !q.student_answer);

  const timeTaken = detail.started_at && detail.submitted_at
    ? Math.round((new Date(detail.submitted_at).getTime() - new Date(detail.started_at).getTime()) / 60000)
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h3 className="font-semibold text-lg">
            {detail.student_name || detail.student_email || 'Student'} — Detailed Report
          </h3>
          <p className="text-xs text-muted-foreground">
            {detail.assessment_title}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className={`grid gap-3 ${detail.negative_marking ? 'sm:grid-cols-6' : 'sm:grid-cols-5'}`}>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{detail.score ?? 0}/{detail.max_score ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold">{detail.percentage != null ? `${Math.round(detail.percentage)}%` : '-'}</p>
            <p className="text-[11px] text-muted-foreground">Percentage</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{detail.correct_count}</p>
            <p className="text-[11px] text-muted-foreground">Correct</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{detail.wrong_count}</p>
            <p className="text-[11px] text-muted-foreground">Wrong</p>
          </CardContent>
        </Card>
        {detail.negative_marking && (
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">
                -{((detail.wrong_count || 0) * (detail.negative_mark_value || 0.25)).toFixed(2)}
              </p>
              <p className="text-[11px] text-muted-foreground">Penalty ({detail.negative_mark_value || 0.25}/wrong)</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-gray-400">{detail.unanswered_count}</p>
            <p className="text-[11px] text-muted-foreground">Unanswered</p>
          </CardContent>
        </Card>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {detail.submitted_at && (
          <span>Submitted: {format(new Date(detail.submitted_at), 'dd MMM yyyy, hh:mm a')}</span>
        )}
        {timeTaken != null && <span>Time taken: {timeTaken} min</span>}
        {detail.negative_marking && (
          <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]">
            Negative Marking: -{detail.negative_mark_value || 0.25} per wrong answer
          </Badge>
        )}
        {detail.attempt_metadata?.tab_violations > 0 && (
          <span className="text-red-600 font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> {detail.attempt_metadata.tab_violations} tab violation(s)
          </span>
        )}
        {detail.attempt_metadata?.auto_submitted && (
          <Badge variant="destructive" className="text-[10px]">
            Auto-submitted: {detail.attempt_metadata.submit_reason === 'tab_violations' ? 'Tab violations' : 'Time expired'}
          </Badge>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: `All (${questions.length})` },
          { key: 'correct', label: `Correct (${detail.correct_count})` },
          { key: 'wrong', label: `Wrong (${detail.wrong_count})` },
          { key: 'unanswered', label: `Unanswered (${detail.unanswered_count})` },
        ].map(tab => (
          <Button
            key={tab.key}
            variant={filter === tab.key ? 'default' : 'outline'}
            size="sm"
            className="text-xs"
            onClick={() => setFilter(tab.key as any)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Question-by-question breakdown */}
      <div className="space-y-4">
        {filtered.map((q: any, idx: number) => {
          const qNum = questions.indexOf(q) + 1;
          return (
            <Card key={q.id} className={`border-l-4 ${
              q.is_correct ? 'border-l-green-500' : q.student_answer ? 'border-l-red-500' : 'border-l-gray-300'
            }`}>
              <CardContent className="p-4 space-y-3">
                {/* Question header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      q.is_correct ? 'bg-green-100 text-green-700' : q.student_answer ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {qNum}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium whitespace-pre-wrap"><MathText text={q.question_text} /></p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px]">{(q.question_type || '').toUpperCase()}</Badge>
                        <span className="text-[10px] text-muted-foreground">{q.marks} mark{q.marks !== 1 ? 's' : ''}</span>
                        {q.subject && <span className="text-[10px] text-muted-foreground">{q.subject}</span>}
                        {q.chapter && <span className="text-[10px] text-muted-foreground">• {q.chapter}</span>}
                        {q.difficulty && <Badge variant="outline" className="text-[10px]">{q.difficulty}</Badge>}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Options for MCQ / true_false */}
                {(q.question_type === 'mcq' || q.question_type === 'true_false') && q.options && (
                  <div className="space-y-1.5 ml-11">
                    {Object.entries(q.options).map(([key, val]) => {
                      // correct_answer may be the letter key OR the option text; student_answer is the letter.
                      const isCorrectOption = key === q.correct_answer || String(val) === q.correct_answer;
                      const isStudentChoice = key === q.student_answer || String(val) === q.student_answer;
                      let bg = 'bg-white border-gray-200';
                      let icon = null;

                      if (isCorrectOption && isStudentChoice) {
                        bg = 'bg-green-50 border-green-400';
                        icon = <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />;
                      } else if (isCorrectOption) {
                        bg = 'bg-green-50 border-green-300';
                        icon = <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />;
                      } else if (isStudentChoice) {
                        bg = 'bg-red-50 border-red-400';
                        icon = <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />;
                      }

                      return (
                        <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${bg}`}>
                          <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-semibold bg-gray-100 text-gray-600 flex-shrink-0">
                            {key}
                          </span>
                          <span className="text-sm flex-1"><MathText text={String(val)} /></span>
                          {icon}
                          {isStudentChoice && !isCorrectOption && (
                            <span className="text-[10px] text-red-500 font-medium">Student's answer</span>
                          )}
                          {isCorrectOption && !isStudentChoice && (
                            <span className="text-[10px] text-green-600 font-medium">Correct answer</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Fill / Short / Long answer display */}
                {(q.question_type === 'fill' || q.question_type === 'short' || q.question_type === 'long') && (
                  <div className="ml-11 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-28 flex-shrink-0 pt-1">Student's answer:</span>
                      <div className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                        q.student_answer
                          ? q.is_correct ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                          : 'bg-gray-50 border-gray-200 text-muted-foreground italic'
                      }`}>
                        <MathText text={q.student_answer || 'Not answered'} />
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-28 flex-shrink-0 pt-1">Correct answer:</span>
                      <div className="flex-1 px-3 py-2 rounded-lg border bg-green-50 border-green-300 text-sm">
                        <MathText text={q.correct_answer || '-'} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Match type display */}
                {q.question_type === 'match' && (
                  <div className="ml-11 space-y-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-28 flex-shrink-0 pt-1">Student's answer:</span>
                      <div className={`flex-1 px-3 py-2 rounded-lg border text-sm ${
                        q.is_correct ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                      }`}>
                        {q.student_answer ? <MathText text={q.student_answer} /> : <span className="text-muted-foreground italic">Not answered</span>}
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-xs font-medium text-muted-foreground w-28 flex-shrink-0 pt-1">Correct answer:</span>
                      <div className="flex-1 px-3 py-2 rounded-lg border bg-green-50 border-green-300 text-sm">
                        <MathText text={q.correct_answer || '-'} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Explanation */}
                {q.explanation && (
                  <div className="ml-11 mt-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1 flex items-center gap-1">
                      <HelpCircle className="h-3 w-3" /> Explanation
                    </p>
                    <p className="text-xs text-blue-800 dark:text-blue-300 whitespace-pre-wrap"><MathText text={q.explanation} /></p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No questions match this filter.</p>
      )}
    </div>
  );
}

// The backend may return attempts in two shapes:
//   1) a top-level `detail.attempts[]` linked by `invitation_id`, OR
//   2) the latest attempt summary embedded directly on each invitation
//      (attempt_id, attempt_status, score, max_score, percentage, submitted_at).
// Normalize to an attempts array for a given invitation so the report works with either.
function invitationAttempts(detail: any, inv: any): any[] {
  const linked = ((detail?.attempts as any[]) || []).filter((a: any) => a.invitation_id === inv.id);
  if (linked.length > 0) return linked;
  if (inv.attempt_id) {
    return [{
      id: inv.attempt_id,
      invitation_id: inv.id,
      status: inv.attempt_status || inv.status,
      score: inv.score,
      max_score: inv.max_score,
      percentage: inv.percentage,
      started_at: inv.started_at ?? null,
      submitted_at: inv.submitted_at ?? null,
      attempt_metadata: inv.attempt_metadata ?? null,
    }];
  }
  return [];
}

// ── Main Report Component ──
export function EvalAssessmentReport({ assessmentId, onBack }: Props) {
  const { data: detail, isLoading } = useEvalAssessmentDetail(assessmentId);
  const reinvite = useReinviteEvalAssessment();
  const isExpired = !!(detail?.due_date && new Date(detail.due_date) < new Date()) || !!(detail?.ends_at && new Date(detail.ends_at) < new Date());
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [viewingAttempt, setViewingAttempt] = useState<{ attemptId: string; label: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedInvitations, setExpandedInvitations] = useState<Set<string>>(new Set());

  const filteredInvitations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const invs = (detail?.invitations as any[]) || [];
    return q
      ? invs.filter((inv: any) =>
          (inv.name || '').toLowerCase().includes(q) || (inv.email || '').toLowerCase().includes(q),
        )
      : invs;
  }, [detail?.invitations, searchQuery]);

  const {
    visible: visibleInvitations,
    sentinelRef: invitationsSentinelRef,
    hasMore: invitationsHasMore,
    shown: invitationsShown,
    total: invitationsTotal,
  } = useInfiniteList<any>(filteredInvitations, 25);

  const stats = useMemo(() => {
    if (!detail) return null;
    const invitations = detail.invitations || [];
    const attempts = detail.attempts || [];
    const directAttempts: any[] = (detail as any).direct_attempts || [];

    // Invitation-based: pick latest submitted attempt per invitation
    // (attempts may be linked in detail.attempts OR embedded on the invitation).
    const latestByInvitation = new Map<string, any>();
    for (const inv of invitations) {
      const submitted = invitationAttempts(detail, inv)
        .filter((a: any) => a.status === 'submitted' || a.status === 'evaluated')
        .sort((a: any, b: any) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime());
      if (submitted.length > 0) latestByInvitation.set(inv.id, submitted[0]);
    }

    // Direct attempts (portal users): latest completed attempt per user
    const directScores: number[] = [];
    let directSubmitted = 0;
    for (const u of directAttempts) {
      const completed = (u.attempts as any[]).filter(
        (a: any) => a.status === 'submitted' || a.status === 'auto_submitted',
      );
      if (completed.length > 0) {
        directSubmitted++;
        const latest = completed.sort(
          (a: any, b: any) => new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime(),
        )[0];
        if (latest.score != null) directScores.push(latest.score);
      }
    }

    const uniqueSubmitted = latestByInvitation.size + directSubmitted;
    const invScores = Array.from(latestByInvitation.values()).map((a: any) => a.score || 0);
    const allScores = [...invScores, ...directScores];

    return {
      totalInvited: invitations.length,
      totalSubmitted: uniqueSubmitted,
      completionRate: invitations.length > 0
        ? Math.round((uniqueSubmitted / invitations.length) * 100)
        : 0,
      avgScore: allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null,
      highestScore: allScores.length > 0 ? Math.max(...allScores) : null,
      lowestScore: allScores.length > 0 ? Math.min(...allScores) : null,
    };
  }, [detail]);

  const buildStudentRows = (): StudentRow[] => {
    if (!detail) return [];
    const invitations = detail.invitations || [];
    const attempts = detail.attempts || [];
    const directAttempts: any[] = (detail as any).direct_attempts || [];
    const rows: StudentRow[] = [];

    // Invitation-based rows
    invitations.forEach((inv: any) => {
      const invAttempts = invitationAttempts(detail, inv)
        .sort((a: any, b: any) => new Date(a.started_at || 0).getTime() - new Date(b.started_at || 0).getTime());
      if (invAttempts.length === 0) {
        rows.push({ email: inv.email, name: inv.name || inv.full_name || '-', status: inv.status, score: '-', maxScore: '-', percentage: '-', timeTaken: '-', violations: '-', submitType: '-', startedAt: '-', submittedAt: '-', attempt: '0' });
      }
      invAttempts.forEach((att: any, idx: number) => {
        rows.push({
          email: inv.email, name: inv.name || inv.full_name || '-', status: att.status,
          score: att.score?.toString() || '-',
          maxScore: att.max_score?.toString() || detail.max_score?.toString() || '-',
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

    // Direct (portal) attempt rows
    directAttempts.forEach((u: any) => {
      const sorted = [...(u.attempts as any[])].sort(
        (a, b) => new Date(a.started_at || 0).getTime() - new Date(b.started_at || 0).getTime(),
      );
      sorted.forEach((att: any, idx: number) => {
        rows.push({
          email: u.email, name: u.name || '-', status: att.status,
          score: att.score?.toString() || '-',
          maxScore: att.max_score?.toString() || detail.max_score?.toString() || '-',
          percentage: att.percentage != null ? `${Math.round(att.percentage)}%` : '-',
          timeTaken: att.started_at && att.submitted_at ? Math.round((new Date(att.submitted_at).getTime() - new Date(att.started_at).getTime()) / 60000).toString() : '-',
          violations: '0',
          submitType: att.attempt_metadata?.submit_reason || 'manual',
          startedAt: att.started_at ? format(new Date(att.started_at), 'yyyy-MM-dd HH:mm') : '-',
          submittedAt: att.submitted_at ? format(new Date(att.submitted_at), 'yyyy-MM-dd HH:mm') : '-',
          attempt: (idx + 1).toString(),
        });
      });
    });

    return rows;
  };

  const handleExport = async (fmt: ExportFormat) => {
    if (!detail || !stats) return;
    const d = detail as any;
    const meta: MetaField[] = [
      { label: 'Mode', value: detail.mode === 'exam' ? 'Mock test' : 'Practice' },
      { label: 'Difficulty', value: detail.difficulty || '-' },
      { label: 'Questions', value: String(detail.question_count || 0) },
      { label: 'Max Score', value: String(detail.max_score || 0) },
      { label: 'Time Limit', value: d.time_limit ? `${d.time_limit} min` : 'No limit' },
      { label: 'Due Date', value: d.due_date ? format(new Date(d.due_date), 'dd MMM yyyy, hh:mm a') : '-' },
      { label: 'Total Invited', value: String(stats.totalInvited) },
      { label: 'Total Submitted', value: String(stats.totalSubmitted) },
      { label: 'Completion Rate', value: `${stats.completionRate}%` },
      { label: 'Average Score', value: stats.avgScore != null ? String(stats.avgScore) : '-' },
      { label: 'Highest Score', value: stats.highestScore != null ? String(stats.highestScore) : '-' },
      { label: 'Lowest Score', value: stats.lowestScore != null ? String(stats.lowestScore) : '-' },
    ];
    await exportReport(meta, buildStudentRows(), `Report: ${detail.title}`, fmt);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!detail) return null;

  // If viewing a specific attempt's detail
  if (viewingAttempt) {
    return (
      <AttemptDetailView
        assessmentId={assessmentId}
        attemptId={viewingAttempt.attemptId}
        studentLabel={viewingAttempt.label}
        onBack={() => setViewingAttempt(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h3 className="font-semibold text-lg">{detail.title}</h3>
            <p className="text-xs text-muted-foreground">
              {detail.difficulty} • {detail.mode} • {detail.question_count} questions
              {detail.negative_marking && ` • -${detail.negative_mark_value || 0.25} negative`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Hide re-invite buttons if assessment is expired */}
          {!isExpired && (
            <>
              {selectedEmails.size > 0 && (
                <Button variant="outline" size="sm" className="gap-1"
                  disabled={reinvite.isPending}
                  onClick={() => {
                    reinvite.mutate({ assessmentId, emails: Array.from(selectedEmails) }, {
                      onSuccess: () => setSelectedEmails(new Set()),
                    });
                  }}>
                  <Send className="h-3 w-3" /> Re-invite ({selectedEmails.size})
                </Button>
              )}
              <Button variant="outline" size="sm" className="gap-1"
                disabled={reinvite.isPending}
                onClick={() => reinvite.mutate({ assessmentId })}>
                <RefreshCw className={`h-3 w-3 ${reinvite.isPending ? 'animate-spin' : ''}`} /> Re-invite All
              </Button>
            </>
          )}
          <DownloadDropdown onDownload={handleExport} label="Export" />
        </div>
      </div>

      {/* Summary Stats */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalInvited}</p>
                <p className="text-xs text-muted-foreground">Invited</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSubmitted}</p>
                <p className="text-xs text-muted-foreground">Submitted ({stats.completionRate}%)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgScore ?? '-'}</p>
                <p className="text-xs text-muted-foreground">Avg Score</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.highestScore != null ? `${stats.highestScore}/${stats.lowestScore}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">High / Low</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Student Breakdown */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm">Student Results</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          {(detail.invitations || []).length === 0 && ((detail as any).direct_attempts || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No users have taken this test yet.
            </p>
          ) : filteredInvitations.length === 0 && ((detail as any).direct_attempts || []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No results matching "{searchQuery}"
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {!isExpired && (
                      <TableHead className="w-8">
                        <Checkbox
                          checked={selectedEmails.size === filteredInvitations.length && selectedEmails.size > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedEmails(new Set(filteredInvitations.map((i: any) => i.email)));
                            } else {
                              setSelectedEmails(new Set());
                            }
                          }}
                        />
                      </TableHead>
                    )}
                    <TableHead>Name / Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Violations</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-10">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleInvitations.map((inv: any) => {
                    const invAttempts = invitationAttempts(detail, inv)
                      .sort((a: any, b: any) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime());
                    const latestAttempt = invAttempts[0];
                    const status = latestAttempt?.status || inv.status;
                    const hasOlderAttempts = invAttempts.length > 1;
                    const isExpanded = expandedInvitations.has(inv.id);

                    return (
                      <Fragment key={inv.id}>
                        <TableRow>
                          {!isExpired && (
                            <TableCell>
                              <Checkbox
                                checked={selectedEmails.has(inv.email)}
                                onCheckedChange={(checked) => {
                                  const next = new Set(selectedEmails);
                                  if (checked) next.add(inv.email);
                                  else next.delete(inv.email);
                                  setSelectedEmails(next);
                                }}
                              />
                            </TableCell>
                          )}
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1.5">
                              <div>
                                <div className="font-medium">{inv.name || inv.full_name || inv.email}</div>
                                {(inv.name || inv.full_name) && <div className="text-xs text-muted-foreground">{inv.email}</div>}
                              </div>
                              {hasOlderAttempts && (
                                <button
                                  onClick={() => {
                                    const next = new Set(expandedInvitations);
                                    if (isExpanded) next.delete(inv.id);
                                    else next.add(inv.id);
                                    setExpandedInvitations(next);
                                  }}
                                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted transition-colors"
                                  title={isExpanded ? 'Hide previous attempts' : 'Show previous attempts'}
                                >
                                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  {invAttempts.length} attempts
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {latestAttempt?.attempt_metadata?.auto_submitted ? (
                              <Badge variant="outline" className="text-[10px] w-fit bg-red-500/10 text-red-700 dark:text-red-400">
                                {latestAttempt.attempt_metadata.submit_reason === 'tab_violations'
                                  ? 'Auto: Tab violations'
                                  : latestAttempt.attempt_metadata.submit_reason === 'time_expired'
                                    ? 'Auto: Time up'
                                    : latestAttempt.attempt_metadata.submit_reason === 'browser_close'
                                      ? 'Auto: Browser closed'
                                      : 'Auto-submitted'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className={`text-[10px] w-fit ${STATUS_COLORS[status] || ''}`}>
                                {STATUS_LABELS[status] || status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {latestAttempt?.score != null
                              ? `${latestAttempt.score}/${latestAttempt.max_score || detail.max_score}`
                              : '-'}
                            {latestAttempt?.percentage != null && (
                              <div className="text-[10px] text-muted-foreground">{Math.round(latestAttempt.percentage)}%</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {latestAttempt?.started_at && latestAttempt?.submitted_at
                              ? `${Math.round((new Date(latestAttempt.submitted_at).getTime() - new Date(latestAttempt.started_at).getTime()) / 60000)} min`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {latestAttempt?.attempt_metadata?.tab_violations > 0 ? (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3 text-red-500" />
                                <span className="text-xs font-medium text-red-600">
                                  {latestAttempt.attempt_metadata.tab_violations}
                                </span>
                              </div>
                            ) : latestAttempt?.status === 'submitted' ? (
                              <span className="text-xs text-green-600">0</span>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {latestAttempt?.submitted_at
                              ? format(new Date(latestAttempt.submitted_at), 'dd MMM yyyy HH:mm')
                              : '-'}
                          </TableCell>
                          <TableCell>
                            {latestAttempt && (
                              latestAttempt.status === 'submitted' ||
                              latestAttempt.status === 'auto_submitted' ||
                              latestAttempt.attempt_metadata?.auto_submitted ||
                              latestAttempt.submitted_at
                            ) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="View detailed answers"
                                onClick={() => setViewingAttempt({
                                  attemptId: latestAttempt.id,
                                  label: inv.name || inv.email,
                                })}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {/* Historical attempts — collapsible */}
                        {hasOlderAttempts && isExpanded && invAttempts.slice(1).map((att: any, idx: number) => (
                          <TableRow key={att.id} className="bg-muted/30">
                            <TableCell />
                            <TableCell className="text-xs text-muted-foreground pl-8 italic">
                              Attempt #{invAttempts.length - idx - 1}
                            </TableCell>
                            <TableCell>
                              {att.attempt_metadata?.auto_submitted ? (
                                <Badge variant="outline" className="text-[10px] w-fit bg-red-500/10 text-red-700 dark:text-red-400">
                                  {att.attempt_metadata.submit_reason === 'tab_violations'
                                    ? 'Auto: Tab violations'
                                    : att.attempt_metadata.submit_reason === 'time_expired'
                                      ? 'Auto: Time up'
                                      : att.attempt_metadata.submit_reason === 'browser_close'
                                        ? 'Auto: Browser closed'
                                        : 'Auto-submitted'}
                                </Badge>
                              ) : (
                                <Badge variant="outline" className={`text-[10px] w-fit ${STATUS_COLORS[att.status] || ''}`}>
                                  {STATUS_LABELS[att.status] || att.status}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {att.score != null ? `${att.score}/${att.max_score || detail.max_score}` : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {att.started_at && att.submitted_at
                                ? `${Math.round((new Date(att.submitted_at).getTime() - new Date(att.started_at).getTime()) / 60000)} min`
                                : '-'}
                            </TableCell>
                            <TableCell>
                              {att.attempt_metadata?.tab_violations > 0 ? (
                                <div className="flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                  <span className="text-xs text-red-600">{att.attempt_metadata.tab_violations}</span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {att.submitted_at ? format(new Date(att.submitted_at), 'dd MMM yyyy HH:mm') : '-'}
                            </TableCell>
                            <TableCell>
                              {att.status === 'submitted' && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="View detailed answers"
                                  onClick={() => setViewingAttempt({
                                    attemptId: att.id,
                                    label: inv.name || inv.email,
                                  })}
                                >
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
              <div ref={invitationsSentinelRef} className="h-1" />
              <p className="text-center text-xs text-muted-foreground py-2">
                {invitationsHasMore
                  ? `Loading more… (${invitationsShown} of ${invitationsTotal})`
                  : `All ${invitationsTotal} students loaded`}
              </p>
            </div>
          )}

          {/* Direct (portal) attempts — users who took via user portal without invitation */}
          {((detail as any).direct_attempts || []).length > 0 && (
            <div className={`overflow-x-auto ${(detail.invitations || []).length > 0 ? 'mt-6 pt-5 border-t' : ''}`}>
              {(detail.invitations || []).length > 0 && (
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  Portal Attempts (taken directly via course page)
                </p>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name / Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-10">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((detail as any).direct_attempts as any[]).map((u: any) => {
                    const sorted = [...(u.attempts as any[])].sort(
                      (a, b) => new Date(b.started_at || 0).getTime() - new Date(a.started_at || 0).getTime(),
                    );
                    const latest = sorted[0];
                    const hasMultiple = sorted.length > 1;
                    const isExpandedDirect = expandedInvitations.has(u.user_id);
                    return (
                      <Fragment key={u.user_id}>
                        <TableRow>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1.5">
                              <div>
                                <div className="font-medium">{u.name || u.email}</div>
                                {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
                              </div>
                              {hasMultiple && (
                                <button
                                  onClick={() => {
                                    const next = new Set(expandedInvitations);
                                    if (isExpandedDirect) next.delete(u.user_id);
                                    else next.add(u.user_id);
                                    setExpandedInvitations(next);
                                  }}
                                  className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted/50 hover:bg-muted transition-colors"
                                >
                                  {isExpandedDirect ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                                  {sorted.length} attempts
                                </button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {latest?.auto_submitted ? (
                              <Badge variant="outline" className="text-[10px] w-fit bg-red-500/10 text-red-700 dark:text-red-400">
                                Auto-submitted
                              </Badge>
                            ) : (
                              <Badge variant="outline" className={`text-[10px] w-fit ${STATUS_COLORS[latest?.status] || ''}`}>
                                {STATUS_LABELS[latest?.status] || latest?.status || '-'}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-sm font-medium">
                            {latest?.score != null ? `${latest.score}/${latest.max_score ?? detail.max_score}` : '-'}
                            {latest?.percentage != null && (
                              <div className="text-[10px] text-muted-foreground">{Math.round(latest.percentage)}%</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {latest?.started_at && latest?.submitted_at
                              ? `${Math.round((new Date(latest.submitted_at).getTime() - new Date(latest.started_at).getTime()) / 60000)} min`
                              : '-'}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {latest?.submitted_at ? format(new Date(latest.submitted_at), 'dd MMM yyyy HH:mm') : '-'}
                          </TableCell>
                          <TableCell>
                            {(latest?.status === 'submitted' || latest?.status === 'auto_submitted') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="View detailed answers"
                                onClick={() => setViewingAttempt({ attemptId: latest.id, label: u.name || u.email })}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                        {hasMultiple && isExpandedDirect && sorted.slice(1).map((att: any, idx: number) => (
                          <TableRow key={att.id} className="bg-muted/30">
                            <TableCell className="text-xs text-muted-foreground pl-8 italic">
                              Attempt #{sorted.length - idx - 1}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] w-fit ${att.auto_submitted ? 'bg-red-500/10 text-red-700 dark:text-red-400' : STATUS_COLORS[att.status] || ''}`}>
                                {att.auto_submitted ? 'Auto-submitted' : (STATUS_LABELS[att.status] || att.status)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {att.score != null ? `${att.score}/${att.max_score ?? detail.max_score}` : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {att.started_at && att.submitted_at
                                ? `${Math.round((new Date(att.submitted_at).getTime() - new Date(att.started_at).getTime()) / 60000)} min`
                                : '-'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {att.submitted_at ? format(new Date(att.submitted_at), 'dd MMM yyyy HH:mm') : '-'}
                            </TableCell>
                            <TableCell>
                              {(att.status === 'submitted' || att.status === 'auto_submitted') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => setViewingAttempt({ attemptId: att.id, label: u.name || u.email })}
                                >
                                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
