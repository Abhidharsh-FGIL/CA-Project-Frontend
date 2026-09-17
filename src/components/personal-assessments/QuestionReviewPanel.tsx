import { useState, useRef, Fragment } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Trash2, GripVertical, Image, X, Calculator, Loader2,
  Save, Download, Share2, Play, ArrowLeft, FileText, ChevronDown, Lightbulb, Link2, RefreshCw, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, buildUrl } from '@/lib/api';

/** Prefix relative upload URLs with the API base so images load cross-port. */
const resolveUrl = (url: string | undefined) => {
  if (!url) return '';
  return buildUrl(url);
};
import { toast } from 'sonner';
import { MathText } from '@/components/ui/MathText';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { MathInput } from '@/components/ui/math-input';
import { MathTextarea } from '@/components/ui/math-textarea';
import { downloadAssessmentPDF } from '@/lib/assessment-pdf-export';
import { downloadPaperAsDocx } from '@/lib/eval-docx-export';
import { stripInlineOptions } from '@/lib/question-text';

export interface ReviewQuestion {
  id: string;
  type: string;
  /** MCQ subtype: 'standard' | 'case' | 'assertion_reason' | 'higher_order' */
  subtype?: string;
  text: string;
  options?: string[];
  correctAnswer?: string | number;
  points: number;
  attachmentUrl?: string;
  attachmentName?: string;
  pairs?: { left: string; right: string }[];
  explanation?: string;
  subject?: string;
  chapter?: string;
  /**
   * The level under `chapter`, from the sheet's Subtopic column.
   *
   * Carried through the review screen untouched so `POST /papers/save` stores it
   * on the question — the report groups subject -> topic -> sub-topic off these
   * three fields, and a mapper that drops this one silently flattens the bottom
   * level of every report.
   */
  subtopic?: string;
  /** Reading-comprehension / shared-context passage. Questions sharing a group_id show it once. */
  passage?: string;
  /** Groups questions that share the same passage/context. */
  group_id?: string;
  /**
   * Bilingual papers: the same question rendered in another language, keyed by
   * language code. Absent on single-language questions. Persisted verbatim by
   * POST /papers/save — never drop it when mapping.
   */
  translations?: Record<string, { text?: string; options?: string[]; passage?: string | null }>;
  /**
   * Imported papers only: how sure the model is of the answer it supplied, and the
   * number printed in the booklet so a reviewer can check against the paper.
   */
  confidence?: 'high' | 'medium' | 'low';
  sourceNumber?: number;
  /** Imported rows the importer wants a human to look at — the reason is shown. */
  needsReview?: string;
}

const mathSymbols = [
  { symbol: '√', name: 'Square root' }, { symbol: '∛', name: 'Cube root' },
  { symbol: '²', name: 'Squared' }, { symbol: '³', name: 'Cubed' },
  { symbol: 'π', name: 'Pi' }, { symbol: '∞', name: 'Infinity' },
  { symbol: '±', name: 'Plus-minus' }, { symbol: '÷', name: 'Division' },
  { symbol: '×', name: 'Multiplication' }, { symbol: '≠', name: 'Not equal' },
  { symbol: '≤', name: 'Less or equal' }, { symbol: '≥', name: 'Greater or equal' },
  { symbol: '≈', name: 'Approximately' }, { symbol: '∑', name: 'Sum' },
  { symbol: '∫', name: 'Integral' }, { symbol: 'Δ', name: 'Delta' },
  { symbol: 'θ', name: 'Theta' }, { symbol: 'α', name: 'Alpha' },
  { symbol: 'β', name: 'Beta' }, { symbol: '→', name: 'Arrow' },
  { symbol: '⇌', name: 'Equilibrium' },
  { symbol: '₀', name: 'Sub 0' }, { symbol: '₁', name: 'Sub 1' },
  { symbol: '₂', name: 'Sub 2' }, { symbol: '₃', name: 'Sub 3' },
];

interface QuestionReviewPanelProps {
  questions: ReviewQuestion[];
  answerKey: any[];
  config: { title: string; subject: string; difficulty: string; mode: string; timeLimitSeconds?: number };
  onSaveDraft: (questions: ReviewQuestion[]) => void;
  onTakeQuiz: (questions: ReviewQuestion[]) => void;
  onBack: () => void;
  onRegenerate?: () => void;
  isSaving?: boolean;
  saveLabel?: string;
  hideQuizButton?: boolean;
  mcqOnly?: boolean;
}

export function QuestionReviewPanel({
  questions: initialQuestions,
  answerKey,
  config,
  onSaveDraft,
  onTakeQuiz,
  onBack,
  onRegenerate,
  isSaving,
  saveLabel,
  hideQuizButton,
  mcqOnly,
}: QuestionReviewPanelProps) {
  const [questions, setQuestions] = useState<ReviewQuestion[]>(initialQuestions);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const updateQuestion = (id: string, updates: Partial<ReviewQuestion>) => {
    setQuestions(qs => qs.map(q => (q.id === id ? { ...q, ...updates } : q)));
  };

  const removeQuestion = (id: string) => {
    setQuestions(qs => qs.filter(q => q.id !== id));
  };

  const addQuestion = (type: string) => {
    const newQ: ReviewQuestion = {
      id: crypto.randomUUID(),
      type,
      text: '',
      points: 1,
      options: type === 'mcq' ? ['', '', '', ''] : type === 'true_false' ? ['True', 'False'] : undefined,
      correctAnswer: '',
      pairs: type === 'match' ? [{ left: '', right: '' }, { left: '', right: '' }] : undefined,
    };
    setQuestions(qs => [...qs, newQ]);
  };

  const updateOption = (qId: string, idx: number, value: string) => {
    setQuestions(qs =>
      qs.map(q => {
        if (q.id === qId && q.options) {
          const oldText = q.options[idx];
          const opts = [...q.options];
          opts[idx] = value;
          // Keep correctAnswer in sync when option text changes
          const ca = q.correctAnswer === oldText ? value : q.correctAnswer;
          return { ...q, options: opts, correctAnswer: ca };
        }
        return q;
      })
    );
  };

  const addOption = (qId: string) => {
    setQuestions(qs =>
      qs.map(q => (q.id === qId && q.options ? { ...q, options: [...q.options, ''] } : q))
    );
  };

  const removeOption = (qId: string, idx: number) => {
    setQuestions(qs =>
      qs.map(q => {
        if (q.id === qId && q.options && q.options.length > 2) {
          const removedText = q.options[idx];
          const opts = q.options.filter((_, i) => i !== idx);
          // Clear correctAnswer if the removed option was selected
          const ca = q.correctAnswer === removedText ? '' : q.correctAnswer;
          return { ...q, options: opts, correctAnswer: ca };
        }
        return q;
      })
    );
  };

  const updatePair = (qId: string, idx: number, side: 'left' | 'right', value: string) => {
    setQuestions(qs =>
      qs.map(q => {
        if (q.id === qId && q.pairs) {
          const pairs = [...q.pairs];
          pairs[idx] = { ...pairs[idx], [side]: value };
          return { ...q, pairs };
        }
        return q;
      })
    );
  };

  const addPair = (qId: string) => {
    setQuestions(qs =>
      qs.map(q => (q.id === qId && q.pairs ? { ...q, pairs: [...q.pairs, { left: '', right: '' }] } : q))
    );
  };

  const removePair = (qId: string, idx: number) => {
    setQuestions(qs =>
      qs.map(q => {
        if (q.id === qId && q.pairs && q.pairs.length > 2) {
          return { ...q, pairs: q.pairs.filter((_, i) => i !== idx) };
        }
        return q;
      })
    );
  };

  const insertSymbol = (qId: string, symbol: string) => {
    const ta = textareaRefs.current[qId];
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const q = questions.find(q => q.id === qId);
      if (q) {
        const newText = q.text.substring(0, start) + symbol + q.text.substring(end);
        updateQuestion(qId, { text: newText });
        setTimeout(() => { ta.focus(); ta.setSelectionRange(start + symbol.length, start + symbol.length); }, 0);
      }
    }
  };

  const handleFileUpload = async (qId: string, file: File) => {
    setUploadingId(qId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { url } = await api.upload('/api/v1/assignments/files/upload', formData);
      updateQuestion(qId, { attachmentUrl: url, attachmentName: file.name });
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  const handleDownloadPDF = (withAnswers: boolean) => {
    try {
      const mapped = questions.map(q => ({
        ...q,
        correct_answer: q.correctAnswer,
      }));
      downloadAssessmentPDF(
        {
          title: config.title || 'Assessment',
          subject: config.subject,
          difficulty: config.difficulty,
          question_json: mapped,
        },
        withAnswers,
      );
      toast.success(`Downloaded PDF ${withAnswers ? 'with' : 'without'} answers`);
    } catch {
      toast.error('Failed to generate PDF');
    }
  };

  const handleDownloadDocx = async (withAnswers: boolean) => {
    try {
      const paper = {
        title: config.title || 'Assessment',
        difficulty: config.difficulty,
        time_limit: config.timeLimitSeconds ? Math.round(config.timeLimitSeconds / 60) : undefined,
        max_score: questions.reduce((s, q) => s + (q.points || 1), 0),
      };
      const mapped = questions.map(q => ({
        ...q,
        correct_answer: q.correctAnswer,
      }));
      await downloadPaperAsDocx(paper, mapped, withAnswers);
      toast.success(`Downloaded DOCX ${withAnswers ? 'with' : 'without'} answers`);
    } catch {
      toast.error('Failed to generate DOCX');
    }
  };

  const handleShare = () => {
    const summary = `📝 ${config.title || 'Assessment'}\n📚 ${config.subject || 'General'}\n❓ ${questions.length} questions\n⚡ ${config.difficulty}`;
    navigator.clipboard.writeText(summary);
    toast.success('Summary copied to clipboard');
  };

  /** MCQ subtype labels shown after generation — must match the MCQ style selector UI */
  const SUBTYPE_LABEL: Record<string, string> = {
    standard:         'Standard MCQ',
    case:             'Case-based MCQ',
    assertion_reason: 'Assertion & Reason',
    higher_order:     'Higher Order Thinking',
  };

  /** Tailwind color classes for each MCQ subtype badge */
  const SUBTYPE_COLOR: Record<string, string> = {
    standard:         'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    case:             'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    assertion_reason: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    higher_order:     'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  };

  const typeLabel = (t: string, subtype?: string) => {
    // If the question carries a subtype (set by the AI), prefer that label
    if (subtype && SUBTYPE_LABEL[subtype]) return SUBTYPE_LABEL[subtype];
    const map: Record<string, string> = {
      mcq:        'MCQ',
      fill:       'Fill in Blank',
      short:      'Short Answer',
      long:       'Long Answer',
      descriptive:'Descriptive',
      case:       'Case-based',
      match:      'Match the Following',
      true_false: 'True / False',
    };
    return map[t] || t;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-bold">{config.title || 'Review Questions'}</h2>
            <p className="text-sm text-muted-foreground">{questions.length} questions • {config.subject} • {config.difficulty}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          {onRegenerate && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRegenerate}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover">
              <DropdownMenuLabel>PDF</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleDownloadPDF(false)}>
                <Download className="h-4 w-4 mr-2" /> Without Answers
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadPDF(true)}>
                <CheckCircle className="h-4 w-4 mr-2" /> With Answers
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>DOCX</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleDownloadDocx(false)}>
                <Download className="h-4 w-4 mr-2" /> Without Answers
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDownloadDocx(true)}>
                <CheckCircle className="h-4 w-4 mr-2" /> With Answers
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onSaveDraft(questions)} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saveLabel || 'Save Draft'}
          </Button>
          {!hideQuizButton && (
            <Button size="sm" className="gap-1.5" onClick={() => onTakeQuiz(questions)}>
              <Play className="h-4 w-4" /> Take Quiz
            </Button>
          )}
        </div>
      </div>

      {/* Question Cards */}
      {questions.map((q, idx) => {
        // Render a shared passage once, above the first question of each group.
        const isFirstOfGroup =
          !!q.group_id && (idx === 0 || questions[idx - 1].group_id !== q.group_id);
        return (
        <Fragment key={q.id}>
          {isFirstOfGroup && q.passage && (
            <Card className="border-primary/30 bg-muted/40 mb-2">
              <CardContent className="p-4 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Passage</Badge>
                  <span className="text-xs text-muted-foreground">Shared context for the questions below</span>
                </div>
                <MarkdownText text={q.passage} />
              </CardContent>
            </Card>
          )}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <GripVertical className="h-5 w-5 text-muted-foreground mt-2 shrink-0" />
              <div className="flex-1 space-y-4">
                {/* Header row */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">Q{idx + 1}</span>
                    {q.sourceNumber != null && (
                      <span
                        className="text-[11px] text-muted-foreground"
                        title="Number printed in the source paper"
                      >
                        (paper #{q.sourceNumber})
                      </span>
                    )}
                    {q.needsReview && (
                      <span
                        className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        title={q.needsReview}
                      >
                        needs review
                      </span>
                    )}
                    {q.confidence && (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          q.confidence === 'low'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                            : q.confidence === 'medium'
                            ? 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-700'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
                        )}
                        title="Confidence in the model-supplied answer — verify low ones against the official key"
                      >
                        {q.confidence} confidence
                      </span>
                    )}
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
                        q.subtype && SUBTYPE_COLOR[q.subtype]
                          ? SUBTYPE_COLOR[q.subtype]
                          : 'bg-muted text-muted-foreground border-border',
                      )}
                    >
                      {typeLabel(q.type, q.subtype)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={q.points}
                      onChange={e => updateQuestion(q.id, { points: parseInt(e.target.value) || 1 })}
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-muted-foreground">pts</span>
                    <Button variant="ghost" size="icon" onClick={() => removeQuestion(q.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Question text with symbol insertion */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1">
                          <Calculator className="h-4 w-4" /> Symbols
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="start">
                        <p className="text-sm font-medium mb-2">Insert Symbol</p>
                        <div className="grid grid-cols-8 gap-1">
                          {mathSymbols.map(s => (
                            <Button key={s.symbol} variant="outline" size="sm" className="h-8 w-8 p-0 text-lg" title={s.name} onClick={() => insertSymbol(q.id, s.symbol)}>
                              {s.symbol}
                            </Button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <MathTextarea
                    textareaRef={el => { textareaRefs.current[q.id] = el; }}
                    placeholder="Enter your question..."
                    value={q.text}
                    onChange={v => updateQuestion(q.id, { text: v })}
                  />
                  <TranslationPreview question={q} />
                </div>

                {/* MCQ / True-False Options */}
                {(q.type === 'mcq' || q.type === 'true_false') && q.options && (
                  <div className="space-y-3">
                    <Label className="text-sm">Options (select correct answer)</Label>
                    <RadioGroup
                      value={String(q.correctAnswer ?? '')}
                      onValueChange={v => updateQuestion(q.id, { correctAnswer: v })}
                    >
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <RadioGroupItem value={opt} id={`${q.id}-opt-${oi}`} />
                          <MathInput
                            value={opt}
                            onChange={v => updateOption(q.id, oi, v)}
                            placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                            className={cn('flex-1', q.correctAnswer === opt && 'border-primary bg-primary/5')}
                            readOnly={q.type === 'true_false'}
                          />
                          {q.type === 'mcq' && q.options!.length > 2 && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeOption(q.id, oi)}>
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </RadioGroup>
                    {q.type === 'mcq' && (
                      <Button variant="ghost" size="sm" onClick={() => addOption(q.id)}>
                        <Plus className="h-4 w-4 mr-1" /> Add Option
                      </Button>
                    )}
                  </div>
                )}

                {/* Fill in blank */}
                {q.type === 'fill' && (
                  <div className="space-y-2">
                    <Label className="text-sm">Correct Answer</Label>
                    <Input
                      value={String(q.correctAnswer || '')}
                      onChange={e => updateQuestion(q.id, { correctAnswer: e.target.value })}
                      placeholder="Enter the correct answer..."
                    />
                  </div>
                )}

                {/* Match the Following */}
                {q.type === 'match' && (
                  <div className="space-y-3">
                    <Label className="text-sm flex items-center gap-2">
                      <Link2 className="h-4 w-4" /> Matching Pairs
                    </Label>
                    <div className="space-y-2">
                      <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>Term</span>
                        <span>Definition</span>
                        <span className="w-8" />
                      </div>
                      {(q.pairs || []).map((pair, pi) => (
                        <div key={pi} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                          <MathInput
                            value={pair.left}
                            onChange={v => updatePair(q.id, pi, 'left', v)}
                            placeholder={`Term ${pi + 1}`}
                          />
                          <MathInput
                            value={pair.right}
                            onChange={v => updatePair(q.id, pi, 'right', v)}
                            placeholder={`Definition ${pi + 1}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => removePair(q.id, pi)}
                            disabled={(q.pairs || []).length <= 2}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => addPair(q.id)}>
                      <Plus className="h-4 w-4 mr-1" /> Add Pair
                    </Button>
                  </div>
                )}

                {/* Short/Long/Descriptive/Case — correct answer + AI note */}
                {['short', 'long', 'descriptive', 'case'].includes(q.type) && (
                  <div className="space-y-2">
                    <Label className="text-sm">Correct Answer</Label>
                    <MathTextarea
                      value={String(q.correctAnswer || '')}
                      onChange={v => updateQuestion(q.id, { correctAnswer: v })}
                      placeholder="Enter the model answer / key points..."
                      className="min-h-[60px] text-sm"
                    />
                    <p className="text-xs text-muted-foreground">This question will be evaluated by AI based on content quality.</p>
                  </div>
                )}

                {/* Explanation (collapsible — auto-open if explanation exists) */}
                <Collapsible defaultOpen={!!q.explanation}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                      <Lightbulb className="h-4 w-4" />
                      Explanation
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <MathTextarea
                      value={q.explanation || ''}
                      onChange={v => updateQuestion(q.id, { explanation: v })}
                      placeholder="Add an explanation for the correct answer..."
                      className="min-h-[60px] text-sm"
                    />
                  </CollapsibleContent>
                </Collapsible>

                {/* Attachment */}
                <div className="border rounded-lg p-3 bg-muted/30">
                  <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Image className="h-4 w-4" /> Reference Image (Optional)
                  </Label>
                  {q.attachmentUrl ? (
                    <div className="flex items-center gap-3">
                      <img src={resolveUrl(q.attachmentUrl)} alt="Attachment" className="h-20 w-20 object-cover rounded border" />
                      <div className="flex-1">
                        <p className="text-sm font-medium truncate">{q.attachmentName}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => updateQuestion(q.id, { attachmentUrl: undefined, attachmentName: undefined })}>
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ) : uploadingId === q.id ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm text-muted-foreground">Uploading...</span>
                    </div>
                  ) : (
                    <div>
                      <input type="file" accept="image/*" className="hidden" id={`attach-${q.id}`}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(q.id, f); }} />
                      <label htmlFor={`attach-${q.id}`}>
                        <Button variant="outline" size="sm" asChild className="cursor-pointer">
                          <span><Image className="h-4 w-4 mr-2" /> Upload Image</span>
                        </Button>
                      </label>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        </Fragment>
        );
      })}

      {/* Add Question Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => addQuestion('mcq')}><Plus className="h-4 w-4 mr-1" /> MCQ</Button>
        {!mcqOnly && (
          <>
            <Button variant="outline" size="sm" onClick={() => addQuestion('true_false')}><Plus className="h-4 w-4 mr-1" /> True / False</Button>
            <Button variant="outline" size="sm" onClick={() => addQuestion('fill')}><Plus className="h-4 w-4 mr-1" /> Fill</Button>
            <Button variant="outline" size="sm" onClick={() => addQuestion('short')}><Plus className="h-4 w-4 mr-1" /> Short</Button>
            <Button variant="outline" size="sm" onClick={() => addQuestion('long')}><Plus className="h-4 w-4 mr-1" /> Long</Button>
            <Button variant="outline" size="sm" onClick={() => addQuestion('match')}><Plus className="h-4 w-4 mr-1" /> Match</Button>
          </>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between gap-2 pt-4 border-t flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onBack}>
            <X className="h-4 w-4" /> Cancel
          </Button>
          {onRegenerate && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onRegenerate}>
              <RefreshCw className="h-4 w-4" /> Regenerate
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
                <Download className="h-4 w-4" /> Download
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            <DropdownMenuLabel>PDF</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleDownloadPDF(false)}>
              <Download className="h-4 w-4 mr-2" /> Without Answers
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownloadPDF(true)}>
              <CheckCircle className="h-4 w-4 mr-2" /> With Answers
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>DOCX</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleDownloadDocx(false)}>
              <Download className="h-4 w-4 mr-2" /> Without Answers
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDownloadDocx(true)}>
              <CheckCircle className="h-4 w-4 mr-2" /> With Answers
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
            <Share2 className="h-4 w-4" /> Share
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => onSaveDraft(questions)} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} {saveLabel || 'Save Draft'}
          </Button>
          {!hideQuizButton && (
            <Button size="sm" className="gap-1.5" onClick={() => onTakeQuiz(questions)}>
              <Play className="h-4 w-4" /> Take Quiz
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bilingual preview ────────────────────────────────────────────────────────

const TRANSLATION_LABELS: Record<string, string> = { ta: 'தமிழ்', en: 'English', hi: 'हिन्दी' };

/**
 * Read-only view of the generated translation. Editing stays on the primary
 * language — the translation is regenerated with the paper, not hand-edited, so
 * showing it here is about verifying the bilingual output before saving.
 */
export function TranslationPreview({ question }: { question: ReviewQuestion }) {
  const entries = Object.entries(question.translations ?? {});
  if (entries.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      {entries.map(([lang, tr]) => (
        <div
          key={lang}
          className="rounded-lg border border-dashed border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 p-3"
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1.5">
            {TRANSLATION_LABELS[lang] ?? lang}
          </p>
          {tr.passage && (
            <p className="text-xs text-muted-foreground mb-1.5 whitespace-pre-wrap">{tr.passage}</p>
          )}
          {tr.text && <p className="text-sm leading-relaxed">{stripInlineOptions(tr.text, tr.options)}</p>}
          {Array.isArray(tr.options) && tr.options.length > 0 && (
            <ol className="mt-2 space-y-0.5">
              {tr.options.map((opt, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  <span className="font-semibold">{String.fromCharCode(65 + i)}.</span> {opt}
                </li>
              ))}
            </ol>
          )}
        </div>
      ))}
    </div>
  );
}
