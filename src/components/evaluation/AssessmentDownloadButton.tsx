import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Download, FileText, FileType, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { printQuestionPaper, type PrintQuestion } from '@/lib/question-paper-print';
import { exportAssessment, type MetaField, type QuestionData } from '@/lib/eval-export-utils';

interface Props {
  assessment: any;
}

/**
 * The question bank and the paper endpoint use `question_text` / `question_type` /
 * `marks`; the assessment detail uses `text` / `type` / `points`. Level them.
 */
function normaliseQuestion(q: any): PrintQuestion {
  return {
    ...q,
    text: q.text ?? q.question_text ?? '',
    type: q.type ?? q.question_type ?? 'mcq',
    points: q.points ?? q.marks ?? 1,
    correct_answer: q.correct_answer ?? q.correctAnswer,
    explanation: q.explanation ?? null,
    translations: q.translations ?? null,
  };
}

/**
 * Per-assessment download: the full question paper, with the answer key and
 * explanations, as a PDF.
 *
 * Questions are fetched on demand — the list endpoint doesn't carry them, and
 * pre-loading every card's paper would be hundreds of questions per row.
 */
export function AssessmentDownloadButton({ assessment }: Props) {
  const [busy, setBusy] = useState(false);

  /**
   * Assemble the paper.
   *
   * The assessment detail only inlines `questions` for fixed (non-shuffled)
   * assessments — a shuffled one returns `questions: null` plus `question_ids`
   * and the source `paper_id`(s), so the questions have to be pulled from the
   * paper(s) and then ordered/filtered by `question_ids`.
   */
  const loadQuestions = async (): Promise<{ detail: any; questions: PrintQuestion[] }> => {
    const detail = await api.get<any>(`/api/v1/evaluation/assessments/${assessment.id}`);

    const inlined: any[] = detail?.questions ?? assessment.questions ?? [];
    if (inlined.length > 0) return { detail, questions: inlined.map(normaliseQuestion) };

    const paperIds: string[] = detail?.paper_ids?.length
      ? detail.paper_ids
      : detail?.paper_id
      ? [detail.paper_id]
      : [];

    let pool: any[] = [];
    for (const pid of paperIds) {
      try {
        const qs = await api.get<any[]>(`/api/v1/evaluation/papers/${pid}/questions`);
        pool.push(...(qs || []));
      } catch {
        /* a missing paper shouldn't sink the whole export */
      }
    }

    // Fall back to the question bank when the assessment draws straight from it.
    if (pool.length === 0 && detail?.question_ids?.length) {
      try {
        pool = (await api.get<any[]>(`/api/v1/evaluation/questions?ids=${detail.question_ids.join(',')}`)) || [];
      } catch {
        /* endpoint may not accept an ids filter */
      }
    }

    const ids: string[] = detail?.question_ids ?? [];
    const byId = new Map(pool.map((q: any) => [q.id ?? q.question_id, q]));
    // Keep the assessment's own order; fall back to whatever the paper returned.
    const ordered = ids.length > 0 ? ids.map(id => byId.get(id)).filter(Boolean) : pool;

    if (ordered.length === 0) {
      throw new Error(
        paperIds.length === 0
          ? 'This assessment has no linked paper to export from.'
          : 'Could not load the questions for this assessment.',
      );
    }
    return { detail, questions: ordered.map(normaliseQuestion) };
  };

  const metaLines = (d: any): string[] =>
    [
      d?.mode === 'exam' || d?.mode === 'mock' ? 'Mock test' : 'Practice test',
      d?.difficulty ? `Difficulty: ${d.difficulty}` : '',
      d?.question_count ? `${d.question_count} questions` : '',
      d?.max_score ? `${d.max_score} marks` : '',
      d?.time_limit_seconds ? `${Math.round(d.time_limit_seconds / 60)} min` : '',
    ].filter(Boolean);

  const downloadPdf = async (withAnswers: boolean) => {
    setBusy(true);
    try {
      const { detail, questions } = await loadQuestions();
      printQuestionPaper({
        title: detail?.title || assessment.title || 'Question Paper',
        meta: metaLines(detail ?? assessment),
        questions,
        withAnswers,
      });
      toast.success(`${questions.length} questions ready — choose "Save as PDF" in the print dialog.`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not prepare the question paper');
    } finally {
      setBusy(false);
    }
  };

  const downloadFile = async (format: 'docx' | 'excel') => {
    setBusy(true);
    try {
      const { detail, questions } = await loadQuestions();
      const d = detail ?? assessment;
      const meta: MetaField[] = [
        { label: 'Mode', value: d.mode === 'exam' ? 'Mock test' : 'Practice' },
        { label: 'Difficulty', value: d.difficulty || '-' },
        { label: 'Questions', value: String(d.question_count || questions.length) },
        { label: 'Max Score', value: String(d.max_score || 0) },
      ];
      const rows: QuestionData[] = questions.map((q: any) => ({
        text: q.text || '',
        type: q.type || 'mcq',
        points: q.points ?? 1,
        subject: q.subject,
        difficulty: q.difficulty,
        options: q.options,
        correct_answer: q.correct_answer,
        explanation: q.explanation,
        pairs: q.pairs,
      }));
      await exportAssessment(meta, rows, d.title || 'Assessment', format);
      toast.success('Downloaded');
    } catch (err: any) {
      toast.error(err?.message || 'Could not export this assessment');
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={busy}>
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          Paper
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Question paper</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => downloadPdf(true)} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-red-600" />
          <span>
            PDF — with answers &amp; explanations
            <span className="block text-[10px] text-muted-foreground">Opens the print dialog · Save as PDF</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadPdf(false)} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4 text-slate-500" />
          <span>
            PDF — questions only
            <span className="block text-[10px] text-muted-foreground">For handing out to aspirants</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => downloadFile('docx')} className="gap-2 cursor-pointer">
          <FileType className="h-4 w-4 text-blue-600" />
          Word (.docx) — with answers
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => downloadFile('excel')} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
