import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { ChevronDown, CheckCircle2, XCircle, Image, ZoomIn, ZoomOut, RotateCw, Maximize2, Minimize2, X } from 'lucide-react';
import { useState } from 'react';
import { MathText } from '@/components/ui/MathText';
import { buildUrl } from '@/lib/api';

const resolveUrl = (url: string | undefined) => {
  if (!url) return '';
  return buildUrl(url);
};

function AttachmentViewer({ url, name }: { url: string; name?: string }) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const resolved = resolveUrl(url);

  const zoomIn = () => setZoom(z => Math.min(z + 25, 300));
  const zoomOut = () => setZoom(z => Math.max(z - 25, 25));
  const rotate = () => setRotation(r => (r + 90) % 360);
  const reset = () => { setZoom(100); setRotation(0); };

  return (
    <div className="ml-6">
      <Dialog onOpenChange={() => reset()}>
        <DialogTrigger asChild>
          <button className="flex items-center gap-1.5 text-xs text-primary hover:underline">
            <Image className="h-3.5 w-3.5" />
            {name || 'View Attachment'}
          </button>
        </DialogTrigger>
        <DialogContent className={`p-0 gap-0 [&>button.absolute]:hidden ${expanded ? 'max-w-[95vw] max-h-[95vh]' : 'max-w-2xl'}`}>
          {/* Toolbar */}
          <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50 rounded-t-lg">
            <span className="text-sm font-medium truncate max-w-[200px]">{name || 'Attachment'}</span>
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomOut} disabled={zoom <= 25} title="Zoom out">
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={zoomIn} disabled={zoom >= 300} title="Zoom in">
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={rotate} title="Rotate">
                <RotateCw className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(e => !e)} title={expanded ? 'Minimize' : 'Maximize'}>
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" title="Close">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </DialogClose>
            </div>
          </div>
          {/* Image area */}
          <div className={`overflow-auto flex items-center justify-center bg-muted/20 ${expanded ? 'h-[85vh]' : 'max-h-[70vh]'}`}>
            <img
              src={resolved}
              alt={name || 'Attachment'}
              className="transition-transform duration-200"
              style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface EvalQuestionDetailProps {
  question: any;
  index: number;
  showAnswer?: boolean;
}

export function EvalQuestionDetail({ question: q, index, showAnswer = true }: EvalQuestionDetailProps) {
  const [showExplanation, setShowExplanation] = useState(false);

  // Options may be: array, dict {A:"...",B:"..."}, or { options: [...], pairs: [...] }
  const rawOptions = q.options;
  let options: any[] | null = null;
  if (Array.isArray(rawOptions)) {
    options = rawOptions;
  } else if (rawOptions && typeof rawOptions === 'object') {
    // Check for match-type nested options
    if (Array.isArray(rawOptions.options)) {
      options = rawOptions.options;
    } else if (rawOptions.pairs) {
      options = null; // pairs handled separately
    } else {
      // Dict format {A: "...", B: "...", C: "...", D: "..."}
      const keys = Object.keys(rawOptions).sort();
      if (keys.length > 0) {
        options = keys.map(k => rawOptions[k]);
      }
    }
  }
  const pairs: Array<{ left: string; right: string }> | null =
    q.pairs ?? rawOptions?.pairs ?? null;

  // Parse correct_answer - could be JSON string or direct value
  let correctAnswer: any = q.correct_answer;
  if (typeof correctAnswer === 'string') {
    try { correctAnswer = JSON.parse(correctAnswer); } catch { /* keep as string */ }
  }
  // Resolve the correct option INDEX (supports correct_index, a numeric index, or a letter like "D").
  const correctIdx =
    typeof q.correct_index === 'number' ? q.correct_index
    : typeof correctAnswer === 'number' ? correctAnswer
    : (typeof correctAnswer === 'string' && /^[a-z]$/i.test(correctAnswer)) ? correctAnswer.toUpperCase().charCodeAt(0) - 65
    : null;

  /** MCQ subtype labels — kept in sync with QuestionReviewPanel */
  const SUBTYPE_LABEL: Record<string, string> = {
    standard:         'Standard MCQ',
    case:             'Case-based MCQ',
    assertion_reason: 'Assertion & Reason',
    higher_order:     'Higher Order Thinking',
  };
  const SUBTYPE_COLOR: Record<string, string> = {
    standard:         'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    case:             'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
    assertion_reason: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
    higher_order:     'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  };

  const hasText = !!(q.text && String(q.text).trim());
  const questionImage = q.attachment_url || q.question_image_url;

  return (
    <div className="border rounded-lg p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-start gap-2">
        <p className="text-sm font-medium flex-1 min-w-0">
          <span className="text-muted-foreground mr-2">Q{index + 1}.</span>
          {hasText ? <MathText text={q.text} /> : !questionImage && <span className="text-muted-foreground italic">Untitled question</span>}
        </p>
        {q.subtype && SUBTYPE_LABEL[q.subtype] && (
          <span
            className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${SUBTYPE_COLOR[q.subtype] || 'bg-muted text-muted-foreground border-border'}`}
          >
            {SUBTYPE_LABEL[q.subtype]}
          </span>
        )}
      </div>

      {/* Image question: when there's no text, the attachment IS the question — show it inline */}
      {!hasText && questionImage && (
        <div className="ml-6">
          <img
            src={buildUrl(questionImage)}
            alt={q.attachment_name || `Question ${index + 1}`}
            className="max-h-72 rounded-lg border border-border object-contain"
          />
        </div>
      )}

      {/* Subject / Chapter badges */}
      {(q.subject || q.chapter) && (
        <div className="flex items-center gap-1.5">
          {q.subject && <Badge variant="outline" className="text-[10px]">{q.subject}</Badge>}
          {q.chapter && <Badge variant="outline" className="text-[10px] bg-muted/50">{q.chapter}</Badge>}
        </div>
      )}

      {/* MCQ Options */}
      {q.type === 'mcq' && options && options.length > 0 && (
        <div className="grid gap-1.5 ml-6">
          {options.map((optRaw: any, i: number) => {
            const opt = optRaw && typeof optRaw === 'object' ? optRaw : { text: optRaw, image_url: null };
            const isCorrect = showAnswer && (
              correctIdx === i ||
              (opt.text != null && correctAnswer === opt.text) ||
              correctAnswer === String.fromCharCode(65 + i)
            );
            return (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md border ${
                  isCorrect
                    ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'border-border'
                }`}
              >
                <span className="font-medium text-muted-foreground w-5">{String.fromCharCode(65 + i)}.</span>
                <span className="flex-1">
                  {opt.image_url ? (
                    <img src={buildUrl(opt.image_url)} alt={`Option ${String.fromCharCode(65 + i)}`} className="max-h-24 rounded border border-border object-contain" />
                  ) : (
                    <MathText text={opt.text || ''} />
                  )}
                </span>
                {isCorrect && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />}
              </div>
            );
          })}
        </div>
      )}

      {/* True/False */}
      {q.type === 'true_false' && showAnswer && correctAnswer != null && (
        <div className="ml-6 flex items-center gap-3">
          {['True', 'False'].map(val => {
            const isCorrect = String(correctAnswer).toLowerCase() === val.toLowerCase();
            return (
              <div
                key={val}
                className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border ${
                  isCorrect
                    ? 'border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'border-border text-muted-foreground'
                }`}
              >
                {isCorrect ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {val}
              </div>
            );
          })}
        </div>
      )}

      {/* Fill / Short answer */}
      {(q.type === 'fill' || q.type === 'short') && showAnswer && correctAnswer != null && (
        <div className="ml-6 text-sm">
          <span className="text-muted-foreground">Answer: </span>
          <span className="font-medium text-green-700 dark:text-green-400"><MathText text={String(correctAnswer)} /></span>
        </div>
      )}

      {/* Match the following */}
      {q.type === 'match' && showAnswer && (() => {
        // New format: pairs available with left/right columns
        if (pairs && pairs.length > 0) {
          return (
            <div className="ml-6 border rounded-md overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 font-medium text-muted-foreground w-8">#</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Column A</th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Correct Match</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((pair: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 text-muted-foreground font-medium">{String.fromCharCode(65 + i)}.</td>
                      <td className="p-2"><MathText text={pair.left} /></td>
                      <td className="p-2 text-green-700 dark:text-green-400 font-medium"><MathText text={pair.right} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        // Old format: options is a plain array (right-column items) + correct_answer has "A-1, B-2" notation
        if (options && options.length > 0) {
          return (
            <div className="ml-6 space-y-2">
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 font-medium text-muted-foreground w-8">#</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Options</th>
                    </tr>
                  </thead>
                  <tbody>
                    {options.map((opt: string, i: number) => (
                      <tr key={i} className="border-t">
                        <td className="p-2 text-muted-foreground font-medium">{i + 1}.</td>
                        <td className="p-2"><MathText text={opt} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {correctAnswer && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Correct Matching: </span>
                  <span className="font-medium text-green-700 dark:text-green-400"><MathText text={String(correctAnswer)} /></span>
                </div>
              )}
            </div>
          );
        }
        return null;
      })()}

      {/* Long answer / model answer */}
      {q.type === 'long' && showAnswer && correctAnswer != null && (
        <div className="ml-6 text-sm space-y-1">
          <span className="text-muted-foreground font-medium">Model Answer:</span>
          <div className="bg-green-500/5 border border-green-500/20 rounded-md p-3 text-green-700 dark:text-green-400 whitespace-pre-wrap">
            <MathText text={String(correctAnswer)} />
          </div>
        </div>
      )}

      {/* Attachment — only as a supplementary reference when the question already has text
          (image-only questions are shown inline above). */}
      {q.attachment_url && hasText && (
        <AttachmentViewer url={q.attachment_url} name={q.attachment_name} />
      )}

      {/* Explanation */}
      {showAnswer && q.explanation && (
        <Collapsible open={showExplanation} onOpenChange={setShowExplanation} className="ml-6">
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className={`h-3 w-3 transition-transform ${showExplanation ? 'rotate-180' : ''}`} />
            Explanation
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-1.5 text-sm text-muted-foreground bg-muted/30 rounded-md p-3">
            <MathText text={q.explanation} />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
