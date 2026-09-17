import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  FileUp,
  Info,
  Loader2,
  ScanLine,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { QuestionReviewPanel, type ReviewQuestion } from '@/components/personal-assessments/QuestionReviewPanel';
import { useSaveEvalPaper, type EvalPaperConfig } from '@/hooks/use-evaluation';
import {
  NoTextExtractedError,
  pollPaperExtraction,
  startPaperExtraction,
  type ExtractedAnswer,
  type ExtractedQuestion,
  type ExtractionStats,
  type PaperExtractStatus,
} from '@/lib/paperImportApi';
import {
  getExcelPaper,
  importExcelPaper,
  type ExcelImportResult,
  type ExcelPaperAnswer,
  type ExcelPaperQuestion,
  type ExcelPaperStats,
} from '@/lib/excelPaperApi';
import { EXAMS } from '@/constants';
import { bilingualLanguageForExamType, marksForSubject, stageForExamType } from '@/config/tnpsc';

type Phase = 'setup' | 'extracting' | 'review';

type Source = 'paper' | 'excel';

const ACCEPTED_PAPER = '.pdf,.docx,.doc,.txt';
const ACCEPTED_EXCEL = '.xlsx,.xls';
const MAX_MB = 25;

interface Props {
  onImported?: (paperId: string) => void;
}

/**
 * Build a question set from an existing exam paper.
 *
 * Nothing is invented: questions and options are transcribed verbatim. The answer
 * and explanation are the model's, so each carries a confidence and the whole set
 * goes through review before anything is saved.
 */
export function EvalPaperImportPanel({ onImported }: Props) {
  const { orgId } = useWorkspaceContext();
  const savePaper = useSaveEvalPaper();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [source, setSource] = useState<Source>('paper');
  const [phase, setPhase] = useState<Phase>('setup');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [needsOcr, setNeedsOcr] = useState(false);

  const [title, setTitle] = useState('');
  const [examLabel, setExamLabel] = useState<string>('TNPSC Group 1');
  const [difficulty, setDifficulty] = useState('medium');
  const [language, setLanguage] = useState<'en' | 'ta'>('en');
  const [bilingual, setBilingual] = useState(true);
  // Always sent. 200 is a full TNPSC paper; lower it for a quick first run.
  const [maxQuestions, setMaxQuestions] = useState(200);

  const [status, setStatus] = useState<PaperExtractStatus | null>(null);
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [stats, setStats] = useState<ExtractionStats>();
  /** Excel only — the parse report, kept so rejected rows stay visible during review. */
  const [excelReport, setExcelReport] = useState<ExcelImportResult | null>(null);
  const [excelStats, setExcelStats] = useState<ExcelPaperStats>();

  const secondaryLanguage = bilingualLanguageForExamType(examLabel) ?? (language === 'en' ? 'ta' : 'en');

  /**
   * The subject a saved paper is filed under.
   *
   * Neither import path asks for it: an Excel sheet states a subject per row, and a
   * question paper's extracted questions carry their own. Both are better evidence
   * than a single tag typed before the file has even been read — a 200-question paper
   * spans a dozen subjects, and one label would have been wrong for most of it.
   * Falls back to the exam name when the source says nothing or spans several.
   */
  const effectiveSubject = (() => {
    const counts = new Map<string, number>();
    if (source === 'excel') {
      for (const [name, n] of Object.entries(excelStats?.by_subject ?? {})) {
        if (name) counts.set(name, n);
      }
    } else {
      for (const q of questions) {
        const name = q.subject?.trim();
        if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return counts.size === 1 ? [...counts.keys()][0] : examLabel || 'Imported';
  })();

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      toast.error(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_MB} MB.`);
      return;
    }
    setNeedsOcr(false);
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const startExtraction = async () => {
    if (!file) return;
    setPhase('extracting');
    setNeedsOcr(false);
    setStatus({ status: 'queued', message: 'Uploading the paper…' });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const jobId = await startPaperExtraction(
        file,
        {
          language,
          secondary_language: bilingual ? secondaryLanguage : null,
          exam_label: examLabel || undefined,
          max_questions: maxQuestions,
        },
        orgId,
      );
      const final = await pollPaperExtraction(jobId, s => setStatus(s), controller.signal);
      const mapped = mapExtracted(final.question_json ?? [], final.answer_key_json ?? [], examLabel);
      if (mapped.length === 0) {
        toast.error('No questions could be read from that file.');
        setPhase('setup');
        return;
      }
      setQuestions(mapped);
      setStats(final.extraction_stats);
      setPhase('review');
      toast.success(`Extracted ${mapped.length} questions — review the answers before saving.`);
    } catch (err: any) {
      if (err instanceof NoTextExtractedError) {
        setNeedsOcr(true);
      } else if (!controller.signal.aborted) {
        toast.error(err?.message || 'Could not read that paper');
      }
      setPhase('setup');
    }
  };

  const startExcelImport = async () => {
    if (!file) return;
    if (!title.trim()) {
      toast.error('Give the paper a title — the Excel import requires one.');
      return;
    }
    setPhase('extracting');
    setStatus({ status: 'running', message: 'Reading the sheet…' });
    try {
      const report = await importExcelPaper(file, { title: title.trim(), exam: examLabel }, orgId);
      setExcelReport(report);

      const paper = await getExcelPaper(report.import_id, orgId);
      const mapped = mapExcelPaper(paper.question_json ?? [], paper.answer_key_json ?? [], examLabel);
      if (mapped.length === 0) {
        toast.error('That sheet produced no usable questions.');
        setPhase('setup');
        return;
      }
      setQuestions(mapped);
      setExcelStats(paper.stats);
      setStats(undefined);
      setPhase('review');
      if (report.rejected_count > 0) {
        toast.warning(`${mapped.length} questions read — ${report.rejected_count} rows rejected.`);
      } else {
        toast.success(`${mapped.length} questions read from the sheet.`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Could not import that sheet');
      setPhase('setup');
    }
  };

  const cancel = () => {
    abortRef.current?.abort();
    setPhase('setup');
  };

  const handleSave = async (reviewed: ReviewQuestion[]) => {
    const config: EvalPaperConfig = {
      title: title.trim() || 'Imported Question Paper',
      testType: examLabel,
      difficulty,
      language,
      secondaryLanguage: bilingual ? secondaryLanguage : null,
      mode: 'exam',
      negativeMarking: false,
      questionCount: reviewed.length,
      questionTypes: ['mcq'],
      mcqSubtypes: ['standard'],
      typeWeightage: { mcq: 100 },
      subjects: [
        {
          id: crypto.randomUUID(),
          subject: effectiveSubject,
          weightage: 100,
          sourceType: 'file',
          sourceFileName: file?.name,
          chapters: [],
        },
      ],
    };
    const saved = await savePaper.mutateAsync({
      config,
      questions: reviewed,
      answerKey: reviewed.map(q => ({
        id: q.id,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })),
    });
    onImported?.(saved?.id);
    setPhase('setup');
    setFile(null);
    setQuestions([]);
  };

  // ── Review ────────────────────────────────────────────────────────────────
  if (phase === 'review' && questions.length > 0) {
    return (
      <div className="space-y-4">
        {source === 'excel' ? (
          <ExcelSummary report={excelReport} stats={excelStats} questions={questions} />
        ) : (
          <ExtractionSummary stats={stats} questions={questions} />
        )}
        <QuestionReviewPanel
          questions={questions}
          answerKey={questions.map(q => ({ id: q.id, correctAnswer: q.correctAnswer, explanation: q.explanation }))}
          config={{
            title: title || 'Imported Question Paper',
            subject: effectiveSubject,
            difficulty,
            mode: 'exam',
          }}
          onSaveDraft={handleSave}
          onTakeQuiz={() => {}}
          onBack={() => setPhase('setup')}
          isSaving={savePaper.isPending}
          saveLabel="Save to Collections"
          hideQuizButton
          mcqOnly
        />
      </div>
    );
  }

  // ── Extracting ────────────────────────────────────────────────────────────
  if (phase === 'extracting') {
    const done = status?.progress?.done ?? 0;
    const total = status?.progress?.total ?? 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : undefined;
    return (
      <div className="max-w-xl mx-auto py-10 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mx-auto mb-4" />
        <h2 className="text-lg font-semibold">Reading the question paper</h2>
        <p className="text-sm text-muted-foreground mt-1">{status?.message || 'Transcribing questions…'}</p>
        {pct !== undefined && (
          <div className="mt-5">
            <Progress value={pct} />
            <p className="text-xs text-muted-foreground mt-2">{done} of {total}</p>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-4">
          A full 200-question paper takes several minutes. Leave this tab open.
        </p>
        <Button variant="ghost" size="sm" className="mt-4 gap-1.5" onClick={cancel}>
          <X className="h-3.5 w-3.5" /> Cancel
        </Button>
      </div>
    );
  }

  // ── Setup ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto py-2 space-y-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Import
        </p>
        <h1 className="text-2xl font-semibold mt-1">Build from an existing question paper</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {source === 'excel'
            ? 'Questions come straight from the sheet — one row per question per language. Nothing is invented; rows the importer cannot trust are rejected and listed.'
            : 'Questions and options are transcribed from the booklet exactly as printed. Only the answer and explanation come from the model — review them before saving.'}
        </p>
      </div>

      {/* Source */}
      <div className="grid grid-cols-2 gap-3">
        <SourceCard
          active={source === 'paper'}
          onClick={() => { setSource('paper'); setFile(null); }}
          icon={<FileText className="h-4 w-4" />}
          title="Question paper"
          detail="PDF or Word, with a text layer. The model reads it and supplies the answers."
        />
        <SourceCard
          active={source === 'excel'}
          onClick={() => { setSource('excel'); setFile(null); setNeedsOcr(false); }}
          icon={<FileSpreadsheet className="h-4 w-4" />}
          title="Excel sheet"
          detail="Questions and answers already written out — one row per question per language."
        />
      </div>

      {needsOcr && source === 'paper' && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3">
          <ScanLine className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-800 dark:text-red-200">
            <p className="font-semibold">That PDF has no text layer.</p>
            <p className="mt-0.5">
              It's a photo scan, so there is nothing to read. Run OCR over it with <b>both Tamil and
              English</b> enabled, then upload the searchable PDF. (Checked at upload, so you haven't
              lost a long job.)
            </p>
          </div>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]); }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
          dragging
            ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-950/30'
            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
        )}
      >
        <input ref={fileInputRef} type="file" accept={source === 'excel' ? ACCEPTED_EXCEL : ACCEPTED_PAPER} className="hidden" onChange={e => pickFile(e.target.files?.[0])} />
        {file ? (
          <div className="flex items-center justify-center gap-3">
            <FileUp className="h-5 w-5 text-indigo-500" />
            <div className="text-left">
              <p className="text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={e => { e.stopPropagation(); setFile(null); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-medium">
              {source === 'excel'
                ? 'Drop the Excel sheet here, or click to choose'
                : 'Drop the question paper here, or click to choose'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {source === 'excel'
                ? `.xlsx or .xls · up to ${MAX_MB} MB · needs a header row`
                : `PDF, Word or text · up to ${MAX_MB} MB · must have a text layer (not a photo scan)`}
            </p>
          </>
        )}
      </div>

      {/* Options */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">
              Paper title {source === 'excel' && <span className="text-red-500">*</span>}
            </Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. TNPSC Group 1 Prelims 2025" className="h-10" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Exam</Label>
            <Select value={examLabel} onValueChange={setExamLabel}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXAMS.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {source === 'paper' && (
          <div className="space-y-1.5">
            <Label className="text-xs">Printed language</Label>
            <Select value={language} onValueChange={v => setLanguage(v as 'en' | 'ta')}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ta">Tamil / தமிழ்</SelectItem>
              </SelectContent>
            </Select>
          </div>
          )}
        </div>

        {source === 'paper' && (
        <ToggleRow
          checked={bilingual}
          onChange={setBilingual}
          title={`Paper prints each question twice (adds ${secondaryLanguage === 'ta' ? 'Tamil' : 'English'})`}
          detail="Pairs the two printings into one question. Without this, a 200-question paper imports as 400."
        />
        )}

        {source === 'paper' && (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-medium">Maximum questions to extract</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              200 is a full TNPSC paper. Drop it to 20 for a first run — you find out in a minute
              whether the pairing and the Tamil came through, instead of after the whole booklet.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Input
              type="number"
              min={1}
              max={300}
              value={maxQuestions}
              onChange={e => setMaxQuestions(Math.min(300, Math.max(1, parseInt(e.target.value) || 1)))}
              className="h-9 w-24 text-center"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 text-xs"
              onClick={() => setMaxQuestions(maxQuestions === 20 ? 200 : 20)}
            >
              {maxQuestions === 20 ? 'Full paper' : 'Test run'}
            </Button>
          </div>
        </div>
        )}
      </div>

      {source === 'excel' ? (
        <div className="flex items-start gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
          <Info className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            Answers and subjects come from the sheet, not from a model. A row whose Correct Answer
            matches none of its options is rejected rather than imported — an unmatched key marks
            every aspirant wrong. Rejected rows are listed after the import.
          </p>
        </div>
      ) : (
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 dark:text-amber-200">
          The answers are the model's, not the commission's. Each one is graded high / medium / low —
          check the low ones against the official key before you publish, because aspirants are marked
          against them. Nothing is written to the database until you save.
        </p>
      </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={source === 'excel' ? startExcelImport : startExtraction}
          disabled={!file || (source === 'excel' && !title.trim())}
          className="gap-1.5"
        >
          <FileUp className="h-4 w-4" />
          {source === 'excel' ? 'Import sheet' : 'Extract questions'}
        </Button>
      </div>
    </div>
  );
}

// ─── Pieces ────────────────────────────────────────────────────────────────────

function ToggleRow({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function ExtractionSummary({
  stats,
  questions,
}: {
  stats?: ExtractionStats;
  questions: ReviewQuestion[];
}) {
  const low = stats?.low_confidence ?? questions.filter(q => q.confidence === 'low').length;
  const dropped = stats?.dropped ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {stats?.extracted ?? questions.length} questions extracted
        </span>
        {stats?.sections_read ? (
          <span className="text-muted-foreground">{stats.sections_read} sections read</span>
        ) : null}
        {dropped > 0 && (
          <span className="text-muted-foreground">{dropped} dropped</span>
        )}
      </div>

      {low > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          <span>
            <b>{low}</b> answer{low !== 1 ? 's are' : ' is'} low-confidence — each is badged below.
            Check {low !== 1 ? 'them' : 'it'} against the official key first.
          </span>
        </p>
      )}
      {dropped > 0 && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
          {dropped} question{dropped !== 1 ? 's were' : ' was'} dropped — the answer matched none of the
          printed options, or the text was clipped. They are omitted rather than guessed.
        </p>
      )}
    </div>
  );
}

/**
 * Marks a question is worth by default, from the exam's section weighting.
 *
 * A paper whose sections are weighted differently (GAT-B: 1 mark at 10+2 level, 3 at
 * graduate level) can't use a flat default — the question's own subject decides. Falls
 * back to 1 for uniform papers and for subjects the catalog doesn't recognise, which
 * is what every TNPSC import gets.
 */
function defaultPoints(examLabel: string, subject?: string | null): number {
  return marksForSubject(stageForExamType(examLabel), subject) ?? 1;
}

/** Extraction payload → the shape the shared review panel edits. */
function mapExtracted(
  items: ExtractedQuestion[],
  answers: ExtractedAnswer[],
  examLabel: string,
): ReviewQuestion[] {
  const keyById = new Map(answers.map(a => [a.id, a]));
  return items.map((q, i) => {
    const key = keyById.get(q.id);
    return {
      id: q.id || `extracted_${i + 1}`,
      type: q.type || 'mcq',
      text: q.text || '',
      options: q.options,
      correctAnswer: key?.correctAnswer,
      explanation: key?.explanation,
      points: q.points ?? defaultPoints(examLabel, q.subject),
      subject: q.subject,
      chapter: q.chapter,
      subtopic: q.subtopic,
      passage: q.passage ?? undefined,
      group_id: q.group_id ?? undefined,
      translations: q.translations,
      confidence: key?.confidence,
      sourceNumber: q.source_number,
    };
  });
}

// ─── Excel pieces ──────────────────────────────────────────────────────────────

function SourceCard({
  active,
  onClick,
  icon,
  title,
  detail,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-xl border p-3.5 text-left transition-all',
        active
          ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 ring-1 ring-indigo-300 dark:ring-indigo-700'
          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700',
      )}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </span>
      <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{detail}</span>
    </button>
  );
}

/**
 * The Excel parse report. Rejected rows are the point of this panel: the importer
 * drops a row whose answer matches none of its options, and that silent loss must
 * be visible before anyone saves the paper.
 */
function ExcelSummary({
  report,
  stats,
  questions,
}: {
  report: ExcelImportResult | null;
  stats?: ExcelPaperStats;
  questions: ReviewQuestion[];
}) {
  const issues = report?.issues ?? [];
  const rejected = report?.rejected_count ?? 0;
  const misaligned = stats?.misaligned_translations ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          {report?.question_count ?? questions.length} questions from {report?.row_count ?? '—'} rows
        </span>
        {stats?.languages?.length ? (
          <span className="text-muted-foreground">
            {stats.languages.join(' + ')}
            {stats.primary_language ? ` · primary ${stats.primary_language}` : ''}
          </span>
        ) : null}
        {rejected > 0 && (
          <span className="font-medium text-amber-700 dark:text-amber-400">{rejected} rejected</span>
        )}
      </div>

      {misaligned > 0 && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
          {misaligned} translation{misaligned !== 1 ? 's were' : ' was'} dropped for misaligned options —
          those questions kept their primary language only.
        </p>
      )}

      {issues.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Rows not imported — fix them in the sheet and re-upload if you need them
          </p>
          <ul className="mt-1.5 space-y-1">
            {issues.map(issue => (
              <li key={issue} className="text-xs text-amber-800 dark:text-amber-200">• {issue}</li>
            ))}
          </ul>
        </div>
      )}

      {stats?.by_subject && Object.keys(stats.by_subject).length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Object.entries(stats.by_subject).map(([subj, n]) => (
            <span
              key={subj}
              className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-300"
            >
              {subj} · {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Excel payload → the shape the shared review panel edits. */
function mapExcelPaper(
  items: ExcelPaperQuestion[],
  answers: ExcelPaperAnswer[],
  examLabel: string,
): ReviewQuestion[] {
  const keyById = new Map(answers.map(a => [a.id, a]));
  return items.map((q, i) => {
    const key = keyById.get(q.id);
    return {
      id: q.id || `xls_${i + 1}`,
      type: q.type || 'mcq',
      subtype: q.subtype,
      text: q.text || '',
      options: q.options,
      correctAnswer: key?.correctAnswer,
      explanation: key?.explanation,
      points: q.points ?? defaultPoints(examLabel, q.subject),
      subject: q.subject,
      chapter: q.chapter,
      subtopic: q.subtopic,
      passage: q.passage ?? undefined,
      group_id: q.group_id ?? undefined,
      translations: q.translations,
      confidence: key?.confidence,
      // Sheet numbers are strings ("1"), the badge wants a number.
      sourceNumber: q.source_number != null ? Number(q.source_number) || undefined : undefined,
      needsReview: q.needs_review ?? undefined,
    };
  });
}
