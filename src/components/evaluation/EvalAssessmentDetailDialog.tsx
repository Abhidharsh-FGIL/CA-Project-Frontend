import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from 'lucide-react';
import { useEvalAssessmentDetail } from '@/hooks/use-eval-assessments';
import { EvalQuestionDetail } from './EvalQuestionDetail';
import { DownloadDropdown } from './DownloadDropdown';
import { exportAssessment, type ExportFormat, type MetaField, type QuestionData } from '@/lib/eval-export-utils';
import { toast } from 'sonner';

interface Props {
  assessmentId: string | null;
  onClose: () => void;
}

export function EvalAssessmentDetailDialog({ assessmentId, onClose }: Props) {
  const { data: detail, isLoading } = useEvalAssessmentDetail(assessmentId || undefined);

  const handleDownload = async (fmt: ExportFormat) => {
    if (!detail) return;
    const d = detail as any;

    const meta: MetaField[] = [
      { label: 'Mode', value: d.mode === 'exam' ? 'Mock test' : 'Practice' },
      { label: 'Difficulty', value: d.difficulty || '-' },
      { label: 'Questions', value: String(d.question_count || 0) },
      { label: 'Max Score', value: String(d.max_score || 0) },
      { label: 'Time Limit', value: d.time_limit ? `${d.time_limit} min` : 'No limit' },
      { label: 'Due Date', value: d.due_date ? new Date(d.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-' },
    ];

    const questions: QuestionData[] = (d.questions || []).map((q: any) => ({
      text: q.text || '', type: q.type || '', points: q.points || 1,
      subject: q.subject, difficulty: q.difficulty, options: q.options,
      correct_answer: q.correct_answer, explanation: q.explanation, pairs: q.pairs,
    }));

    try {
      await exportAssessment(meta, questions, d.title || 'Assessment', fmt);
      toast.success('Downloaded');
    } catch {
      toast.error('Failed to download');
    }
  };

  return (
    <Dialog open={!!assessmentId} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Assessment Details</span>
            <DownloadDropdown onDownload={handleDownload} />
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><span className="text-muted-foreground">Title:</span> <span className="font-medium">{detail.title}</span></div>
              <div><span className="text-muted-foreground">Difficulty:</span> <span className="font-medium">{detail.difficulty}</span></div>
              <div><span className="text-muted-foreground">Questions:</span> <span className="font-medium">{detail.question_count}</span></div>
              <div><span className="text-muted-foreground">Max Score:</span> <span className="font-medium">{detail.max_score}</span></div>
              {(detail as any).negative_marking && (
                <div>
                  <span className="text-muted-foreground">Negative Mark:</span>{' '}
                  <span className="font-medium text-red-600">
                    {(detail as any).negative_mark_mode === 'per_group'
                      ? `-1 / ${(detail as any).negative_mark_group_size || 3} wrong`
                      : `-${(detail as any).negative_mark_value || 0.25} / wrong`}
                  </span>
                </div>
              )}
              {(detail as any).due_date && (
                <div className="col-span-2 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Due:</span>
                  <span className="font-medium">{new Date((detail as any).due_date).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {(detail.questions || []).map((q: any, i: number) => (
                <EvalQuestionDetail key={q.id} question={q} index={i} />
              ))}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}