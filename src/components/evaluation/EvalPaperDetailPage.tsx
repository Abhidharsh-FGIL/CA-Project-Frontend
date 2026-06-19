import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Download, FileText, Hash, Clock } from 'lucide-react';
import { useEvalPapers, useEvalPaperQuestions } from '@/hooks/use-evaluation';
import { EvalQuestionDetail } from './EvalQuestionDetail';
import { DownloadDropdown } from './DownloadDropdown';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { downloadPaperAsDocx } from '@/lib/eval-docx-export';
import { exportAssessment, type ExportFormat, type QuestionData } from '@/lib/eval-export-utils';
import { GenVerseShell } from '@/components/layout/GenVerseShell';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  published: 'bg-green-500/10 text-green-700 dark:text-green-400',
};

const DIFF_COLORS: Record<string, string> = {
  easy: 'bg-green-500/10 text-green-700 dark:text-green-400',
  medium: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  hard: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

export function EvalPaperDetailPage() {
  const { paperId } = useParams<{ paperId: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // Go back to the referring page with the correct tab restored
  const goBack = () => {
    const state = location.state as any;
    const tab = state?.tab || 'papers';
    navigate('/org/evaluation', { state: { tab } });
  };
  const { data: papers } = useEvalPapers();
  const { data: questions = [], isLoading: questionsLoading } = useEvalPaperQuestions(paperId);

  const paper = (papers || []).find((p: any) => p.id === paperId);

  const handleDownload = async (fmt: ExportFormat) => {
    if (!paper) return;
    try {
      if (fmt === 'docx') {
        await downloadPaperAsDocx(paper, questions);
      } else {
        const qs: QuestionData[] = (questions || []).map((q: any) => ({
          text: q.question_text || q.text || '', type: q.question_type || q.type || '',
          points: q.marks || q.points || 1, subject: q.subject, difficulty: q.difficulty,
          options: q.options, correct_answer: q.correct_answer, explanation: q.explanation,
          pairs: q.pairs,
        }));
        // Collections are pure question sets — no assessment metadata (status, time limit, max score, etc.)
        await exportAssessment([], qs, paper.title || 'Paper', fmt);
      }
      toast.success('Paper downloaded');
    } catch {
      toast.error('Failed to generate download');
    }
  };

  if (!paper && !questionsLoading) {
    return (
      <GenVerseShell>
        <div className="space-y-4">
          <Button variant="ghost" className="gap-2" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">Paper not found.</p>
          </div>
        </div>
      </GenVerseShell>
    );
  }

  return (
    <GenVerseShell>
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" className="gap-2 -ml-2" onClick={goBack}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* Paper header */}
      {paper && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold truncate">{paper.title}</h1>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {paper.difficulty && (
                  <Badge className={`text-xs ${DIFF_COLORS[paper.difficulty] || ''}`}>
                    {paper.difficulty}
                  </Badge>
                )}
                <Badge className={`text-xs ${STATUS_COLORS[paper.status] || STATUS_COLORS.draft}`}>
                  {paper.status}
                </Badge>
              </div>
            </div>
            <DownloadDropdown onDownload={handleDownload} />
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Hash className="h-3.5 w-3.5" /> {questions.length} Questions
            </span>
            {paper.time_limit && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> {paper.time_limit} min
              </span>
            )}
            <span>Created {format(new Date(paper.created_at), 'dd MMM yyyy')}</span>
          </div>
        </div>
      )}

      {/* Questions list */}
      <div className="space-y-3">
        {questionsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))
        ) : questions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">No questions found for this paper.</p>
          </div>
        ) : (
          questions.map((q: any, i: number) => (
            <EvalQuestionDetail key={q.id} question={q} index={i} />
          ))
        )}
      </div>
    </div>
    </GenVerseShell>
  );
}
