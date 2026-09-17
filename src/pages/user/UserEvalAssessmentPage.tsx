import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { buildUrl } from '@/lib/api';
import { MathText } from '@/components/ui/MathText';
import {
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Award,
  RotateCcw,
  ChevronLeft,
  Brain,
  ShieldCheck,
  Sparkles,
  FileText,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import {
  isBilingualQuestion,
  langModeOptions,
  paperTranslationLang as resolvePaperTranslationLang,
  translationOf,
  type LangMode,
} from '@/lib/question-language';
import {
  hasPerSectionNegative,
  negativeForSubject,
  orderBySection,
  resolveSubjectId,
  sectionForSubject,
  stageForSubjects,
  stageForTitle,
  subjectDisplayName,
  type TnpscPatternSection,
} from '@/config/tnpsc';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  getEvalAssessmentDetail,
  startEvalAttempt,
  autosaveEvalAttempt,
  submitEvalAttempt,
  type SubmitReason,
  analyzeEvalAttempt,
  saveEvalAnalysis,
  type AssessmentDetailResponse,
  type EvalAttemptQuestion,
  type SubmitAttemptResponse,
} from '@/lib/userPortalApi';
import { toast } from 'sonner';
import { normaliseOption, parseOptionRepr, stripInlineOptions } from '@/lib/question-text';

// ─── Option helpers (support text and image options) ────────────────────────────
type DisplayOption = {
  text: string | null;
  image_url: string | null;
  label: string;
  /** Bilingual papers: the same option in the paper's second language. Display only. */
  translated?: string | null;
};
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Normalize options into a uniform {text, image_url, label} list, handling the new
 *  array `[{text, image_url}]` shape, the legacy `{A: "..."}` map, and plain strings. */
function displayOptions(rawOpts: any, translated?: string[] | null): DisplayOption[] {
  const toOpt = (v: any, i: number): DisplayOption => {
    const label = OPTION_LETTERS[i] || String(i + 1);
    // The translation rides alongside — never into `text`, because the stored
    // answer is the option's text and must stay in the paper's primary language
    // for grading to match.
    let tr = translated?.[i] ?? null;
    // Label-style options ("(a)", "B.") translate to themselves — don't print
    // the same thing twice under the option.
    const primary = v && typeof v === 'object' ? (v as any).text : v;
    if (tr != null && primary != null && String(tr).trim() === String(primary).trim()) tr = null;
    if (v && typeof v === 'object') {
      return { text: v.text ?? null, image_url: v.image_url ?? v.imageUrl ?? null, label, translated: tr };
    }
    // Image options can arrive as a Python-stringified dict rather than JSON;
    // normaliseOption recovers the URL so the picture renders instead of the repr.
    const norm = normaliseOption(v);
    return { text: norm.text, image_url: norm.image_url, label, translated: tr };
  };
  if (!rawOpts) return [];
  if (Array.isArray(rawOpts)) return rawOpts.map(toOpt);
  if (typeof rawOpts === 'object') {
    if (Array.isArray(rawOpts.options)) return rawOpts.options.map(toOpt);
    return Object.keys(rawOpts).filter(k => k !== 'pairs').sort().map((k, i) => toOpt(rawOpts[k], i));
  }
  return [];
}

/** The value stored as the student's answer for an option: its text, else its letter. */
const optionValue = (o: DisplayOption) => (o.text != null && o.text !== '' ? o.text : o.label);

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = 'loading' | 'landing' | 'active' | 'submitting' | 'analysing' | 'result';
type Responses = Record<string, any>;
type QStatus = 'not_visited' | 'not_answered' | 'answered' | 'marked_review' | 'answered_marked';

// ─── Timer hook ───────────────────────────────────────────────────────────────

function useCountdown(
  totalSeconds: number | null,
  startTimeIso: string | null,
  onExpire: () => void,
) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!totalSeconds || !startTimeIso) return;
    const startMs = new Date(startTimeIso).getTime();
    const endMs = startMs + totalSeconds * 1000;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) onExpireRef.current();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [totalSeconds, startTimeIso]);

  return timeLeft;
}

function formatTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

// ─── Circular Timer ────────────────────────────────────────────────────────────

function CircularTimer({
  secondsLeft,
  totalSeconds,
  display,
}: {
  secondsLeft: number | null;
  totalSeconds: number;
  display: string | null;
}) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const progress =
    secondsLeft !== null && totalSeconds > 0
      ? Math.max(0, Math.min(1, secondsLeft / totalSeconds))
      : 1;
  const offset = circ * (1 - progress);

  // Urgency states (mirrors the original exam-timer design)
  const s = secondsLeft ?? Infinity;
  const isCritical = s < 30;
  const isUrgent = s < 60 && !isCritical;
  const isWarning = s < 300 && !isUrgent && !isCritical;

  const ringColor = isCritical
    ? '#f87171'
    : isUrgent
      ? '#ef4444'
      : isWarning
        ? '#fbbf24'
        : '#818cf8';
  const textColor = isCritical || isUrgent
    ? 'text-red-300'
    : isWarning
      ? 'text-amber-300'
      : 'text-white';
  const trackColor = isCritical ? 'rgba(248,113,113,0.25)' : 'rgba(255,255,255,0.15)';

  // An hours-long paper shows "1:12:13" — seven glyphs where the ring was sized for
  // five ("59:59"). At text-sm that overflows the circle and collides with the
  // stroke, so step the type down as the string grows.
  // The ring's inner diameter is 56px (r=30, stroke 4, rendered 1:1 at 72px), so
  // the text has to shrink as the string grows or it collides with the stroke.
  const len = display?.length ?? 0;
  const timeClass =
    len >= 8 ? 'text-[10px]' : len >= 7 ? 'text-[11px]' : len >= 6 ? 'text-xs' : 'text-sm';

  return (
    <div
      className={`relative w-[72px] h-[72px] flex-shrink-0 ${
        isCritical ? 'animate-[shake_0.5s_ease-in-out_infinite]' : ''
      }`}
    >
      {/* Pulsing glow when time is critical */}
      {isCritical && (
        <div
          className="absolute inset-0 rounded-full bg-red-500/30 animate-ping"
          style={{ animationDuration: '1.5s' }}
        />
      )}
      <svg className="w-full h-full -rotate-90" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke={trackColor} strokeWidth="4" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={isCritical ? 5 : 4}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear' }}
        />
      </svg>
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center px-0.5 ${
          isCritical || isUrgent ? 'animate-pulse' : ''
        }`}
      >
        <span className={`${timeClass} font-bold tabular-nums leading-none ${textColor}`}>
          {display ?? '—'}
        </span>
        {(isCritical || isUrgent) && (
          <span className="text-[8px] font-bold text-red-400 mt-0.5 tracking-wide">
            HURRY!
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * A filter row: label hard left, count hard right, so rows line up in a column
 * however long the section names are. Wrapping chips could not do that — a long
 * name pushed its count onto the next line.
 */
function FilterRow({
  label,
  count,
  active,
  onClick,
  title,
}: {
  label: string;
  count: string;
  active: boolean;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors ${
        active ? 'bg-indigo-600' : 'bg-white hover:bg-gray-50'
      }`}
    >
      <span
        className={`text-[11px] font-semibold truncate ${active ? 'text-white' : 'text-gray-700'}`}
      >
        {label}
      </span>
      <span
        className={`text-[10px] font-bold tabular-nums flex-shrink-0 ${
          active ? 'text-indigo-200' : 'text-gray-400'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

/**
 * Where a Previous/Next step lands, or null when there is nowhere to go.
 *
 * With a filter applied, "next" has to mean the next question the reader can
 * actually see — stepping to `currentIdx + 1` lands on one the palette is hiding,
 * which is what made Next jump 27 → 28 instead of 27 → 80.
 *
 * When the current question is not itself in the filtered set (the filter changed
 * while it was open) the step goes to the nearest filtered question in that
 * direction, rather than refusing to move.
 */
export function stepTarget(
  visible: Array<{ idx: number }>,
  currentIdx: number,
  delta: 1 | -1,
  opts: { filtered: boolean; total: number },
): number | null {
  if (!opts.filtered || visible.length === 0) {
    const next = currentIdx + delta;
    return next >= 0 && next < opts.total ? next : null;
  }

  const pos = visible.findIndex(v => v.idx === currentIdx);
  if (pos !== -1) return visible[pos + delta]?.idx ?? null;

  const nearest =
    delta === 1
      ? visible.find(v => v.idx > currentIdx)
      : [...visible].reverse().find(v => v.idx < currentIdx);
  return nearest?.idx ?? null;
}

/** "Section B — Graduate Level" -> "Section B", for chips and toasts. */
function sectionShort(name: string): string {
  return name.split('—')[0].trim() || name;
}

/** A response that counts as answered — shared by the palette, counts and filters. */
function hasAnswer(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

// ─── Active question card (take mode) ────────────────────────────────────────

function ActiveQuestionCard({
  question,
  index,
  answer,
  onChange,
  negative_marking,
  negative_mark_value,
  langMode = 'both',
}: {
  question: EvalAttemptQuestion;
  index: number;
  answer: any;
  onChange: (value: any) => void;
  negative_marking: boolean;
  /** Already resolved for this question's section by the caller. */
  negative_mark_value: number | null;
  langMode?: LangMode;
}) {
  const type = question.type;

  const showPrimary = langMode !== 'translation';
  const showTr = langMode !== 'primary';
  const tr = translationOf(question, showTr);
  const options = displayOptions(question.options, tr?.options);
  // Defensive: papers saved before the generator fix may still carry the choices
  // inside the stem. Display-only — the stored answer still comes from `options`.
  const stemText = stripInlineOptions(question.text, question.options);
  const trText = tr?.text ? stripInlineOptions(tr.text, tr.options) : null;
  const hasText = !!(stemText && String(stemText).trim());
  // Same shapes as the options: a plain URL field, or a stringified dict.
  const questionImage =
    (question as any).attachment_url ||
    (question as any).question_image_url ||
    parseOptionRepr(question.text)?.image_url ||
    null;

  const optionSelected = (opt: DisplayOption, i: number) => {
    const val = optionValue(opt);
    return (
      answer === i ||
      answer === val ||
      answer === opt.label ||
      (opt.text != null && typeof answer === 'string' && answer.trim().toLowerCase() === opt.text.trim().toLowerCase())
    );
  };

  return (
    <div>
      {/* Number badge + question text + tags */}
      <div className="flex items-start gap-4 mb-5">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          {showPrimary && hasText && (
            <div className="text-sm sm:text-[15px] font-medium text-gray-900 leading-relaxed">
              <MathText text={stemText} />
            </div>
          )}
          {/*
            * With the primary hidden the translation *is* the question, so it takes
            * the prominent styling; alongside the primary it stays the secondary
            * line under a divider.
            */}
          {trText && (
            <div
              className={
                showPrimary && hasText
                  ? 'text-sm sm:text-[15px] text-gray-600 leading-relaxed mt-1.5 pt-1.5 border-t border-dashed border-gray-200'
                  : 'text-sm sm:text-[15px] font-medium text-gray-900 leading-relaxed'
              }
            >
              <MathText text={trText} />
            </div>
          )}
          {questionImage && (
            <img src={buildUrl(questionImage)} alt={`Question ${index + 1}`} className="max-h-64 rounded-lg border border-gray-200 object-contain mt-2" />
          )}
          {/* Tags */}
          <div className="flex flex-wrap items-center gap-1.5 mt-3">
            <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium">
              {question.marks} mark{question.marks !== 1 ? 's' : ''}
            </span>
            {negative_marking && negative_mark_value != null && (
              <span className="text-[11px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded font-medium">
                -{negative_mark_value} negative
              </span>
            )}
            {question.subject && (
              <span className="text-[11px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded font-medium">
                {question.subject}
              </span>
            )}
            {/*
              * The question bank's own difficulty is deliberately NOT shown to the
              * candidate. It is set per question and routinely disagrees with the
              * level the paper was built at — a "Simple" G4 paper showing "Medium"
              * on a question reads as a bug — and the paper's own level is already
              * in the header. It remains on the question bank and assessment
              * screens in the admin hub, where per-question difficulty is the point.
              */}
          </div>
        </div>
      </div>

      {/* MCQ options */}
      {type === 'mcq' && options.length > 0 && (
        <div className="space-y-2.5 pl-[52px]">
          {options.map((opt, i) => {
            const isSelected = optionSelected(opt, i);
            return (
              <button
                key={i}
                onClick={() => onChange(optionValue(opt))}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all duration-150 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span
                  className={`flex-shrink-0 w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {opt.label}
                </span>
                <span className={`text-sm flex-1 ${isSelected ? 'text-indigo-900 font-medium' : 'text-gray-700'}`}>
                  {/*
                    * Display only. `optionValue` still returns the primary text, so
                    * the answer stored and graded is unaffected by the language the
                    * candidate happens to be reading in.
                    */}
                  {opt.image_url ? (
                    <img src={buildUrl(opt.image_url)} alt={`Option ${opt.label}`} className="max-h-32 rounded border border-gray-200 object-contain" />
                  ) : (
                    <MathText text={(showPrimary ? opt.text : opt.translated ?? opt.text) || ''} />
                  )}
                  {showPrimary && opt.translated && (
                    <span className="block text-[11px] text-gray-500 mt-0.5">{opt.translated}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* True/False */}
      {type === 'true_false' && (
        <div className="flex gap-3 pl-[52px]">
          {['True', 'False'].map(val => {
            const isSelected =
              String(answer ?? '').toLowerCase() === val.toLowerCase();
            return (
              <button
                key={val}
                onClick={() => onChange(val)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-800'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {val}
              </button>
            );
          })}
        </div>
      )}

      {/* Fill / Short answer */}
      {(type === 'fill' || type === 'short') && (
        <input
          type="text"
          value={answer ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder="Type your answer here…"
          className="w-full ml-[52px] px-4 py-3 border-2 border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
        />
      )}

      {/* Long answer */}
      {type === 'long' && (
        <textarea
          value={answer ?? ''}
          onChange={e => onChange(e.target.value)}
          rows={5}
          placeholder="Write your answer here…"
          className="w-full ml-[52px] px-4 py-3 border-2 border-gray-200 bg-white text-gray-900 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y text-sm"
        />
      )}
    </div>
  );
}

// ─── Result question view (with correct/wrong highlighting) ───────────────────

function QuestionView({
  question,
  index,
  answer,
  onChange,
  showResult,
}: {
  question: EvalAttemptQuestion;
  index: number;
  answer: any;
  onChange: (value: any) => void;
  showResult?: boolean;
}) {
  const type = question.type;

  const rawOpts = question.options;
  const tr = translationOf(question, true);
  const options = displayOptions(rawOpts, tr?.options);
  const stemText = stripInlineOptions(question.text, rawOpts);
  const trText = tr?.text ? stripInlineOptions(tr.text, tr.options) : null;
  const hasText = !!(stemText && String(stemText).trim());
  // Same shapes as the options: a plain URL field, or a stringified dict.
  const questionImage =
    (question as any).attachment_url ||
    (question as any).question_image_url ||
    parseOptionRepr(question.text)?.image_url ||
    null;

  const pairs: Array<{ left: string; right: string }> | null =
    question.pairs ?? (rawOpts as any)?.pairs ?? null;

  const correctAnswer = question.correct_answer;
  const correctIdx =
    typeof (question as any).correct_index === 'number' ? (question as any).correct_index
    : typeof correctAnswer === 'number' ? correctAnswer
    : (typeof correctAnswer === 'string' && /^[a-z]$/i.test(correctAnswer)) ? correctAnswer.toUpperCase().charCodeAt(0) - 65
    : null;
  const isAnswerCorrect =
    showResult && answer !== undefined && answer !== null && answer !== ''
      ? String(answer).trim().toLowerCase() ===
        String(correctAnswer ?? '').trim().toLowerCase()
      : null;

  const optionCorrect = (opt: DisplayOption, i: number) => {
    if (!showResult) return false;
    return (
      correctIdx === i ||
      correctAnswer === opt.label ||
      (opt.text != null && String(correctAnswer ?? '').trim().toLowerCase() === opt.text.trim().toLowerCase())
    );
  };

  const optionSelected = (opt: DisplayOption, i: number) => {
    const val = optionValue(opt);
    return (
      answer === i ||
      answer === val ||
      answer === opt.label ||
      (opt.text != null && typeof answer === 'string' && answer.trim().toLowerCase() === opt.text.trim().toLowerCase())
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <span className="font-bold text-gray-500 shrink-0">Q{index + 1}.</span>
        <div className="flex-1 min-w-0 space-y-2">
          {hasText && (
            <p className="text-sm leading-relaxed text-gray-900 dark:text-gray-100">
              <MathText text={stemText} />
            </p>
          )}
          {trText && (
            <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              <MathText text={trText} />
            </p>
          )}
          {questionImage && (
            <img src={buildUrl(questionImage)} alt={`Question ${index + 1}`} className="max-h-64 rounded-lg border border-gray-200 dark:border-gray-700 object-contain mt-2" />
          )}
        </div>
      </div>

      {type === 'mcq' && options.length > 0 && (
        <div className="space-y-2 ml-5">
          {options.map((opt, i) => {
            const isCorrect = optionCorrect(opt, i);
            const isSelected = optionSelected(opt, i);
            return (
              <label
                key={i}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer text-sm transition-all',
                  showResult
                    ? isCorrect
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/40 text-green-800 dark:text-green-300'
                      : isSelected
                      ? 'border-red-400 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500'
                    : isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-200 ring-1 ring-indigo-500/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700',
                )}
                onClick={() => !showResult && onChange(optionValue(opt))}
              >
                <span
                  className={cn(
                    'w-6 h-6 shrink-0 rounded-full border-2 flex items-center justify-center text-xs font-bold',
                    isSelected && !showResult
                      ? 'border-indigo-500 bg-indigo-500 text-white'
                      : 'border-gray-300 dark:border-gray-600',
                  )}
                >
                  {opt.label}
                </span>
                <span className="flex-1">
                  {opt.image_url
                    ? <img src={buildUrl(opt.image_url)} alt={`Option ${opt.label}`} className="max-h-32 rounded border border-gray-200 dark:border-gray-700 object-contain" />
                    : <MathText text={opt.text || ''} />}
                  {opt.translated && (
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.translated}</span>
                  )}
                </span>
                {showResult && isCorrect && (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                )}
                {showResult && isSelected && !isCorrect && (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                )}
              </label>
            );
          })}
        </div>
      )}

      {type === 'true_false' && (
        <div className="flex gap-3 ml-5">
          {['True', 'False'].map(val => {
            const isSelected =
              String(answer ?? '').toLowerCase() === val.toLowerCase();
            const isCorrect =
              showResult &&
              String(correctAnswer ?? '').toLowerCase() === val.toLowerCase();
            return (
              <label
                key={val}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-sm font-medium transition-all',
                  showResult
                    ? isCorrect
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/40 text-green-700'
                      : isSelected
                      ? 'border-red-400 bg-red-50 dark:bg-red-950/40 text-red-700'
                      : 'border-gray-200 text-gray-400'
                    : isSelected
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 ring-1 ring-indigo-500/30'
                    : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300',
                )}
                onClick={() => !showResult && onChange(val)}
              >
                {showResult && isCorrect ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : showResult && isSelected ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : null}
                {val}
              </label>
            );
          })}
        </div>
      )}

      {(type === 'fill' || type === 'short') && (
        <div className="ml-5">
          {showResult ? (
            <div
              className={cn(
                'p-3 rounded-lg border text-sm',
                isAnswerCorrect
                  ? 'border-green-400 bg-green-50 dark:bg-green-950/40'
                  : 'border-red-400 bg-red-50 dark:bg-red-950/40',
              )}
            >
              <p className="text-muted-foreground text-xs mb-1">Your answer:</p>
              <p
                className={
                  isAnswerCorrect
                    ? 'text-green-700 dark:text-green-300'
                    : 'text-red-700 dark:text-red-300'
                }
              >
                {answer || '—'}
              </p>
              {!isAnswerCorrect && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Correct:{' '}
                  <span className="text-green-700 dark:text-green-300 font-medium">
                    {String(correctAnswer)}
                  </span>
                </p>
              )}
            </div>
          ) : (
            <input
              type="text"
              value={answer ?? ''}
              onChange={e => onChange(e.target.value)}
              placeholder="Type your answer here…"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          )}
        </div>
      )}

      {type === 'long' && (
        <div className="ml-5">
          {showResult ? (
            <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 text-sm space-y-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Your answer:</p>
                <p className="whitespace-pre-wrap">{answer || '—'}</p>
              </div>
              <div className="border-t pt-2">
                <p className="text-xs text-muted-foreground mb-1">Model answer:</p>
                <p className="text-green-700 dark:text-green-300 whitespace-pre-wrap">
                  {String(correctAnswer)}
                </p>
              </div>
            </div>
          ) : (
            <textarea
              value={answer ?? ''}
              onChange={e => onChange(e.target.value)}
              rows={4}
              placeholder="Write your answer here…"
              className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
          )}
        </div>
      )}

      {type === 'match' && pairs && (
        <div className="ml-5 border rounded-lg overflow-hidden text-sm">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left p-2 text-muted-foreground">Column A</th>
                <th className="text-left p-2 text-muted-foreground">Column B</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="p-2">
                    <MathText text={p.left} />
                  </td>
                  <td className="p-2 text-green-700 dark:text-green-400">
                    <MathText text={p.right} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showResult && question.explanation && (
        <div className="ml-5 mt-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium text-xs mb-1">Explanation</p>
          <MathText text={question.explanation} />
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function UserEvalAssessmentPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const navigate = useNavigate();
  const { user, refreshHistory } = useUserPortal();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [assessment, setAssessment] = useState<AssessmentDetailResponse | null>(null);
  const [rawQuestions, setRawQuestions] = useState<EvalAttemptQuestion[]>([]);
  /** Bilingual papers show both languages by default, as the printed paper does. */
  const [langMode, setLangMode] = useState<LangMode>('both');
  /**
   * Non-null when any question in this paper carries a translation.
   * Declared with the other hooks — this component returns early for the
   * loading/landing states, so a hook below those would run conditionally.
   */
  const paperTranslationLang = useMemo(
    // Raw list: whether the paper carries a translation does not depend on the
    // order its questions are shown in, and `questions` is derived further down.
    // Needs a question with *both* languages — a paper that is only English, or
    // only Tamil, has nothing to switch between and gets no control.
    () => resolvePaperTranslationLang(rawQuestions, q => q.text),
    [rawQuestions],
  );
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [startTimeIso, setStartTimeIso] = useState<string | null>(null);
  const [responses, setResponses] = useState<Responses>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [filterSection, setFilterSection] = useState<string>('all');
  const [filterSubject, setFilterSubject] = useState<string>('all');
  const [result, setResult] = useState<SubmitAttemptResponse | null>(null);
  const [analysisText, setAnalysisText] = useState('');
  const [analysisError, setAnalysisError] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  // Active-test state
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(new Set());

  // ── Section / subject filtering of the question palette ──────────────────
  // The paper identifies its own exam from the subjects its questions carry; the
  // assessment payload has no exam type on it.
  // Title first — "GAT-B-Easy" names its exam outright, and is not at the mercy of
  // whatever wording the paper's subjects happen to use. Subjects are the fallback.
  const examStage = useMemo(
    () => stageForTitle(assessment?.title) ?? stageForSubjects(rawQuestions.map(q => q.subject)),
    [assessment?.title, rawQuestions],
  );

  /**
   * Deduction per section, when the paper does not penalise them alike.
   * Empty for a uniform paper, which then keeps the single assessment-level figure.
   */
  const sectionNegatives = useMemo(() => {
    const pattern = examStage?.pattern;
    if (!hasPerSectionNegative(pattern)) return [];
    return (pattern?.sections ?? [])
      .map(sec => ({
        section: sectionShort(sec.name),
        value: sec.negative_mark_value ?? pattern?.negative_mark_value ?? null,
      }))
      .filter((n): n is { section: string; value: number } => n.value != null);
  }, [examStage]);

  // Section A's 60 first, then Section B's 100 — the order the paper is actually
  // sat in. Everything downstream (numbering, palette, filters, next/previous) reads
  // this list, so they all agree without further work.
  const questions = useMemo(
    () => orderBySection(examStage, rawQuestions, q => q.subject),
    [examStage, rawQuestions],
  );

  const sectionOf = useCallback(
    (q: EvalAttemptQuestion) => sectionForSubject(examStage, q.subject)?.name ?? null,
    [examStage],
  );

  /** Sections of the exam pattern that this paper actually has questions in. */
  const sectionOptions = useMemo(() => {
    const names = examStage?.pattern?.sections.map(sec => sec.name) ?? [];
    return names
      .map(name => {
        const qs = questions.filter(q => sectionOf(q) === name);
        return {
          name,
          short: sectionShort(name),
          total: qs.length,
          answered: qs.filter(q => hasAnswer(responses[q.question_id])).length,
        };
      })
      .filter(sec => sec.total > 0);
  }, [examStage, questions, sectionOf, responses]);

  /**
   * The subject a question belongs to, as the syllabus identifies it.
   *
   * Grouping on the raw tag listed every subject in whatever language the booklet
   * was printed in, and listed one subject twice where the paper worded it two
   * ways. Resolving first gives one entry per subject, named as the syllabus
   * names it.
   */
  const subjectIdOf = useCallback(
    (q: EvalAttemptQuestion) => resolveSubjectId(examStage, q.subject) ?? (q.subject ?? ''),
    [examStage],
  );

  /** Subjects available, narrowed to the chosen section. */
  const subjectOptions = useMemo(() => {
    const pool = questions.filter(q => filterSection === 'all' || sectionOf(q) === filterSection);
    const counts = new Map<string, { label: string; count: number }>();
    for (const q of pool) {
      if (!q.subject) continue;
      const key = subjectIdOf(q);
      // The backend's own canonical name first — it is the only source that can
      // name a composite unit like "Indian History & Freedom Movement", which
      // the catalog splits into two subjects and so cannot resolve.
      const canonical = (q.subject_name ?? '').trim();
      const label = canonical || subjectDisplayName(examStage, q.subject);
      const entry = counts.get(key) ?? { label, count: 0 };
      entry.count += 1;
      counts.set(key, entry);
    }
    return [...counts.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [questions, filterSection, sectionOf, subjectIdOf, examStage]);

  /** Questions passing the filter, carrying their original paper position. */
  const visibleQuestions = useMemo(
    () =>
      questions
        .map((q, idx) => ({ q, idx }))
        .filter(
          ({ q }) =>
            (filterSection === 'all' || sectionOf(q) === filterSection) &&
            (filterSubject === 'all' || subjectIdOf(q) === filterSubject),
        ),
    [questions, filterSection, filterSubject, sectionOf, subjectIdOf],
  );

  const filtersActive = filterSection !== 'all' || filterSubject !== 'all';

  // ── "Answer any N of M" sections ─────────────────────────────────────────
  // GAT-B prints 100 graduate-level questions and asks for any 60, alongside a
  // Section A of 60 that is entirely compulsory. Driven off `section.attempt` in
  // the catalog rather than a GAT-B check, so it stays inert for every paper whose
  // sections are all compulsory — both TNPSC stages included.
  const choiceSection = useMemo(
    () =>
      examStage?.pattern?.sections.find(sec => sec.attempt != null && sec.attempt < sec.questions) ??
      null,
    [examStage],
  );

  /** How many of the choice section the candidate has answered so far. */
  const choiceAnswered = useMemo(() => {
    if (!choiceSection) return 0;
    return questions.filter(
      q => sectionOf(q) === choiceSection.name && hasAnswer(responses[q.question_id]),
    ).length;
  }, [choiceSection, questions, responses, sectionOf]);

  // Fires once on crossing the quota, and re-arms if an answer is cleared back
  // below it — so clearing and re-answering tells them again rather than going
  // silent for the rest of the paper.
  const choiceQuotaNotified = useRef(false);
  useEffect(() => {
    if (!choiceSection || pageState !== 'active') return;
    const quota = choiceSection.attempt!;
    if (choiceAnswered >= quota) {
      if (!choiceQuotaNotified.current) {
        choiceQuotaNotified.current = true;
        setQuotaReached(choiceSection);
      }
    } else {
      choiceQuotaNotified.current = false;
    }
  }, [choiceAnswered, choiceSection, pageState]);

  // A subject chosen under one section rarely exists under the next — drop it
  // rather than showing an empty palette.
  useEffect(() => {
    if (filterSubject !== 'all' && !subjectOptions.some(([key]) => key === filterSubject)) {
      setFilterSubject('all');
    }
  }, [subjectOptions, filterSubject]);

  const [panelOpen, setPanelOpen] = useState(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);

  // ── Proctoring (tab-switch / focus-loss detection) ──────────────────────────
  const MAX_TAB_SWITCHES = 3;
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);
  /** The choice section whose quota has just been met — drives the centre dialog. */
  const [quotaReached, setQuotaReached] = useState<TnpscPatternSection | null>(null);
  const tabSwitchRef = useRef(0);
  const submittedRef = useRef(false);
  // When our own dialogs are open we must not count a violation
  const suppressViolationsRef = useRef(false);

  const autosaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const responsesRef = useRef<Responses>({});
  responsesRef.current = responses;
  const expiredRef = useRef(false);
  const sseControllerRef = useRef<AbortController | null>(null);
  const analysisTextRef = useRef('');

  useEffect(() => {
    return () => {
      sseControllerRef.current?.abort();
    };
  }, []);

  // ── Load assessment detail ─────────────────────────────────────────────────

  useEffect(() => {
    if (!assessmentId) return;
    getEvalAssessmentDetail(assessmentId)
      .then(data => {
        setAssessment(data);
        setPageState('landing');
      })
      .catch(() => {
        setError('Assessment not found or unavailable.');
        setPageState('landing');
      });
  }, [assessmentId]);

  // ── Autosave ───────────────────────────────────────────────────────────────

  const doAutosave = useCallback(async () => {
    if (!assessmentId || !attemptId) return;
    const flat = Object.entries(responsesRef.current).map(([qid, ans]) => ({
      question_id: qid,
      answer: ans,
    }));
    try {
      await autosaveEvalAttempt(assessmentId, attemptId, flat);
    } catch {
      /* silently ignore */
    }
  }, [assessmentId, attemptId]);

  useEffect(() => {
    if (pageState !== 'active') return;
    autosaveTimerRef.current = setInterval(doAutosave, 30_000);
    return () => {
      if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);
    };
  }, [pageState, doAutosave]);

  // ── Submit → SSE analysis ──────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (reason: SubmitReason = 'manual') => {
      const auto = reason !== 'manual';
      if (!assessmentId || !attemptId) return;
      submittedRef.current = true;
      setPageState('submitting');
      setShowConfirmSubmit(false);
      if (autosaveTimerRef.current) clearInterval(autosaveTimerRef.current);

      const flat = Object.entries(responsesRef.current).map(([qid, ans]) => ({
        question_id: qid,
        answer: ans,
      }));

      try {
        await submitEvalAttempt(assessmentId, attemptId, flat, auto, {
          // Read the ref, not the state: an auto-submit fires from inside the
          // violation handler, before the matching setState has re-rendered.
          tab_violations: tabSwitchRef.current,
          submit_reason: reason,
        });
        toast.success('Assessment submitted successfully!');

        // Open the report straight away rather than dropping the candidate back on
        // a list. UserReportPage renders from the portal's history and redirects to
        // /user/history when it cannot find the attempt, so the list has to be
        // refreshed first — the attempt was created seconds ago and is not in it yet.
        try {
          await refreshHistory();
        } catch {
          /* Non-fatal: the report falls back to the history list on its own. */
        }
        navigate(`/user/report/${attemptId}`, { replace: true });
      } catch {
        toast.error('Failed to submit. Please try again.');
        submittedRef.current = false;
        setPageState('active');
      }
    },
    [assessmentId, attemptId, assessment, navigate, refreshHistory],
  );

  // ── Timer expire ───────────────────────────────────────────────────────────

  const handleTimeExpire = useCallback(() => {
    if (expiredRef.current) return;
    expiredRef.current = true;
    toast.warning('Time is up! Submitting your test…');
    handleSubmit('time_expired');
  }, [handleSubmit]);

  const timeLeft = useCountdown(
    assessment?.time_limit_seconds ?? null,
    startTimeIso,
    handleTimeExpire,
  );

  // ── Proctoring: warn (and eventually auto-submit) on tab switch / focus loss ─
  // Suppress violation counting while any of our own dialogs is open — including
  // the section-quota one, which appears on its own rather than on a click.
  useEffect(() => {
    suppressViolationsRef.current = showConfirmSubmit || showTabWarning || !!quotaReached;
  }, [showConfirmSubmit, showTabWarning, quotaReached]);
  useEffect(() => {
    if (pageState !== 'active') return;

    // Debounce so a single tab switch (which fires visibilitychange + blur) is
    // counted only once.
    let cooldown = false;

    const recordViolation = () => {
      if (suppressViolationsRef.current || submittedRef.current) return;
      if (cooldown) return;
      cooldown = true;
      setTimeout(() => { cooldown = false; }, 500);

      tabSwitchRef.current += 1;
      const count = tabSwitchRef.current;
      setTabSwitchCount(count);

      if (count >= MAX_TAB_SWITCHES) {
        toast.error('Too many tab switches — auto-submitting your test.');
        handleSubmit('tab_violations');
      } else {
        setShowTabWarning(true);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) setTimeout(recordViolation, 300);
    };
    const handleBlur = () => {
      // Only count an alt-tab/taskbar click here; a real tab switch that hides
      // the document is handled by visibilitychange above.
      setTimeout(() => { if (!document.hidden) recordViolation(); }, 300);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, [pageState, handleSubmit]);

  // ── Start / Resume ─────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!assessmentId) return;
    try {
      setPageState('loading');
      expiredRef.current = false;
      const data = await startEvalAttempt(assessmentId);
      setRawQuestions(data.questions);
      setAttemptId(data.attempt_id);
      setStartTimeIso(data.start_time);
      const restored: Responses = {};
      (data.responses || []).forEach(r => {
        restored[r.question_id] = r.answer;
      });
      setResponses(restored);
      setCurrentIdx(0);
      setMarkedForReview(new Set());
      if (data.questions.length > 0) {
        setVisitedQuestions(new Set([data.questions[0].question_id]));
      }
      setPageState('active');
    } catch (e: any) {
      // The level gate is enforced server-side; a locked level should read as
      // guidance, not as a failure the aspirant can retry.
      if (e?.code === 'LEVEL_LOCKED') {
        toast.error(e.message || 'Clear the previous level first.', { duration: 6000 });
        navigate('/user/exams');
      } else {
        toast.error(e?.message || 'Failed to start assessment');
      }
      setPageState('landing');
    }
  };

  const setAnswer = (questionId: string, value: any) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  // ── RENDER: Loading ────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ── RENDER: Error ──────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </div>
    );
  }

  // ── RENDER: Landing ────────────────────────────────────────────────────────

  if (pageState === 'landing' && assessment) {
    const attemptsLeft = assessment.max_attempts
      ? assessment.max_attempts - assessment.attempt_count
      : null;
    const isMock = assessment.mode === 'mock';

    return (
      <UserShell>
        <button
          onClick={() => navigate(-1)}
          className="group inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-4 transition-colors animate-fadeIn"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back
        </button>

        <div className="max-w-3xl mx-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-5 animate-scaleIn">
            {/* Gradient hero band */}
            <div
              className={`relative p-5 sm:p-6 lg:p-8 overflow-hidden ${
                isMock
                  ? 'bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500'
                  : 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500'
              } text-white`}
            >
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-black/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-[0.25em] bg-white/20 backdrop-blur border border-white/30 text-white px-2.5 py-1 rounded-full whitespace-nowrap">
                      {isMock ? '★ Mock Exam' : 'Practice Mode'}
                    </span>
                    {assessment.difficulty && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider opacity-90 capitalize">
                        {assessment.difficulty}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight">
                    {assessment.title}
                  </h1>
                  <p className="text-xs sm:text-sm opacity-90 mt-2 font-serif italic">
                    {isMock
                      ? 'Full-length, time-bound simulation. Treat it like the real thing.'
                      : 'Practice freely — no rank, just learning.'}
                  </p>
                </div>

                <div className="flex-shrink-0 self-start bg-white/15 backdrop-blur border border-white/25 rounded-xl px-3 py-2 text-right">
                  <p className="text-[9px] uppercase tracking-widest opacity-80">Attempts</p>
                  <p className="text-lg font-bold leading-tight">
                    {attemptsLeft !== null ? `${attemptsLeft} left` : 'Unlimited'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6 lg:p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <AssessmentInfoTile
                  icon={<FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                  label="Questions"
                  value={String(assessment.question_count)}
                />
                <AssessmentInfoTile
                  icon={<Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
                  label="Time Limit"
                  value={assessment.time_limit_minutes ? `${assessment.time_limit_minutes} min` : 'Untimed'}
                />
                <AssessmentInfoTile
                  icon={<Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
                  label="Total Marks"
                  value={String(assessment.max_score)}
                />
                <AssessmentInfoTile
                  icon={<AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />}
                  label="Negative Marking"
                  value={
                    // A paper can penalise its sections differently — GAT-B takes
                    // 0.5 in Section A and 1 in Section B — so quoting the single
                    // assessment-level figure understates half the paper.
                    sectionNegatives.length > 1
                      ? `Yes (${sectionNegatives.map(n => `-${n.value}`).join(' / ')})`
                      : assessment.negative_marking && assessment.negative_mark_value != null
                        ? `Yes (-${assessment.negative_mark_value})`
                        : 'No'
                  }
                />
              </div>

              <div className="mt-6 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Instructions
                </p>
                <ul className="text-xs text-gray-700 dark:text-gray-300 space-y-1.5 list-disc pl-5">
                  <li>Read each question carefully before answering.</li>
                  <li>You can navigate between questions freely.</li>
                  {isMock && (
                    <li>The timer cannot be paused. The test will auto-submit when time expires.</li>
                  )}
                  <li>Your progress is auto-saved every 30 seconds.</li>
                  <li>Do not close or refresh this page during the assessment.</li>
                  {sectionNegatives.length > 1 ? (
                    <li className="text-red-700 dark:text-red-300">
                      <strong>Negative marking is enabled</strong>, and differs by section:{' '}
                      {sectionNegatives
                        .map(n => `${n.section} deducts ${n.value} mark${n.value === 1 ? '' : 's'}`)
                        .join('; ')}
                      {' '}per wrong answer.
                    </li>
                  ) : (
                    assessment.negative_marking &&
                    assessment.negative_mark_value != null && (
                      <li className="text-red-700 dark:text-red-300">
                        <strong>Negative marking is enabled.</strong> Each wrong answer deducts{' '}
                        {assessment.negative_mark_value} marks.
                      </li>
                    )
                  )}
                </ul>
              </div>

              {!assessment.can_attempt && (
                <p className="mt-5 text-sm text-red-600 dark:text-red-400 text-center font-medium bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg py-3">
                  You have used all {assessment.max_attempts} attempt
                  {assessment.max_attempts !== 1 ? 's' : ''} for this assessment.
                </p>
              )}

              {assessment.can_attempt && (
                <label className="mt-5 flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    I have read and understood the instructions. I agree to abide by the assessment rules.
                  </span>
                </label>
              )}

              <button
                onClick={handleStart}
                disabled={!assessment.can_attempt || !agreed}
                className="group w-full mt-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] hover:bg-right-bottom text-white py-3.5 rounded-xl font-semibold transition-all duration-500 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40 hover:shadow-xl hover:shadow-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              >
                <span className="inline-flex items-center justify-center gap-2">
                  {assessment.in_progress_attempt_id ? 'Resume Test' : 'Begin Test'}
                  {!assessment.in_progress_attempt_id && (
                    <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                  )}
                </span>
              </button>
            </div>
          </div>
        </div>
      </UserShell>
    );
  }

  // ── RENDER: Submitting ─────────────────────────────────────────────────────

  if (pageState === 'submitting') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-gray-950">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Submitting your answers…</p>
      </div>
    );
  }

  // ── RENDER: Analysing + Result ─────────────────────────────────────────────

  if ((pageState === 'analysing' || pageState === 'result') && result) {
    const pct = result.percentage;
    const passed = pct >= 40;

    return (
      <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-950">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          {pageState === 'analysing' && (
            <div className="flex items-center justify-center gap-2.5 py-2">
              <div className="w-5 h-5 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-gray-600 dark:text-gray-400 font-medium text-sm">
                Analysing your performance…
              </span>
            </div>
          )}

          <div
            className={cn(
              'rounded-2xl border p-8 text-center space-y-4',
              passed
                ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
            )}
          >
            <div
              className={cn(
                'inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold',
                passed
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'
                  : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
              )}
            >
              {passed ? <Award className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {passed ? 'Passed' : 'Needs Improvement'}
            </div>
            <div>
              <p className="text-5xl font-bold text-gray-900 dark:text-white">{result.score}</p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                out of {result.max_score} marks
              </p>
            </div>
            <div className="w-full max-w-xs mx-auto">
              <Progress value={pct} className="h-2" />
              <p className="text-sm font-medium mt-1 text-gray-700 dark:text-gray-300">{pct}%</p>
            </div>
            {result.auto_submitted && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Auto-submitted due to time expiry
              </p>
            )}
          </div>

          {(analysisText || pageState === 'analysing') && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-4 w-4 text-indigo-500" />
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                  AI Performance Analysis
                </h3>
              </div>
              {analysisError ? (
                <p className="text-sm text-red-600 dark:text-red-400">{analysisError}</p>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {analysisText}
                  {pageState === 'analysing' && (
                    <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-middle" />
                  )}
                </p>
              )}
            </div>
          )}

          {pageState === 'result' && (
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" className="gap-2" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4" /> Back to Course
              </Button>
              {result.can_retake && (
                <Button
                  className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => {
                    sseControllerRef.current?.abort();
                    setResult(null);
                    setAnalysisText('');
                    setAnalysisError('');
                    setResponses({});
                    setCurrentIdx(0);
                    setMarkedForReview(new Set());
                    setVisitedQuestions(new Set());
                    setPageState('landing');
                  }}
                >
                  <RotateCcw className="h-4 w-4" /> Retake Test
                </Button>
              )}
            </div>
          )}

          {pageState === 'result' && (
            <div className="space-y-4">
              <h2 className="font-bold text-gray-800 dark:text-gray-200 text-lg">Answer Review</h2>
              {result.questions.map((q, i) => {
                const userAns = q.user_answer;
                const hasAnswer =
                  userAns !== undefined && userAns !== null && userAns !== '';
                return (
                  <div
                    key={q.question_id}
                    className={cn(
                      'rounded-xl border p-5 space-y-3',
                      q.is_correct
                        ? 'border-green-200 dark:border-green-800 bg-white dark:bg-gray-900'
                        : hasAnswer
                        ? 'border-red-200 dark:border-red-800 bg-white dark:bg-gray-900'
                        : 'border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-gray-500">Q{i + 1}</span>
                      {q.is_correct ? (
                        <span className="text-xs text-green-700 dark:text-green-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Correct
                        </span>
                      ) : hasAnswer ? (
                        <span className="text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                          <XCircle className="h-3.5 w-3.5" /> Wrong
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium">Skipped</span>
                      )}
                    </div>
                    <QuestionView
                      question={q}
                      index={i}
                      answer={userAns}
                      onChange={() => {}}
                      showResult
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── RENDER: Active test ────────────────────────────────────────────────────

  if (pageState !== 'active') return null;

  const currentQ = questions[currentIdx];
  const totalQ = questions.length;

  const getQStatus = (q: EvalAttemptQuestion): QStatus => {
    const isAnswered = hasAnswer(responses[q.question_id]);
    const isMarked = markedForReview.has(q.question_id);
    const isVisited = visitedQuestions.has(q.question_id);
    if (isAnswered && isMarked) return 'answered_marked';
    if (isAnswered) return 'answered';
    if (isMarked) return 'marked_review';
    if (isVisited) return 'not_answered';
    return 'not_visited';
  };

  const answeredCount = questions.filter(q => hasAnswer(responses[q.question_id])).length;
  const remaining = totalQ - answeredCount;
  const reviewCount = markedForReview.size;

  const STATUS_STYLE: Record<QStatus, string> = {
    not_visited: 'bg-white border border-gray-300 text-gray-500',
    not_answered: 'bg-pink-200 border border-pink-300 text-pink-800',
    answered: 'bg-emerald-500 text-white border border-emerald-500',
    marked_review: 'bg-amber-400 text-white border border-amber-400',
    answered_marked: 'bg-blue-500 text-white border border-blue-500',
  };

  const goToQuestion = (idx: number) => {
    if (idx < 0 || idx >= totalQ) return;
    setCurrentIdx(idx);
    setVisitedQuestions(prev => new Set([...prev, questions[idx].question_id]));
    setPanelOpen(false);
  };

  /** Where the current question sits in the filtered set; -1 when it is filtered out. */
  const filteredPos = visibleQuestions.findIndex(v => v.idx === currentIdx);

  const nextIdx = (delta: 1 | -1) =>
    stepTarget(visibleQuestions, currentIdx, delta, { filtered: filtersActive, total: totalQ });

  const stepQuestion = (delta: 1 | -1) => {
    const target = nextIdx(delta);
    if (target !== null) goToQuestion(target);
  };

  /** Both the click and the disabled state ask the same question, so they cannot disagree. */
  const canStep = (delta: 1 | -1) => nextIdx(delta) !== null;

  const handleMarkForReview = () => {
    if (!currentQ) return;
    const qid = currentQ.question_id;
    setMarkedForReview(prev => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
    stepQuestion(1);
  };

  const hasCurrentAnswer =
    currentQ &&
    responses[currentQ.question_id] !== undefined &&
    responses[currentQ.question_id] !== null &&
    responses[currentQ.question_id] !== '';

  const SidebarContent = () => (
    <>
      {/* User info */}
      {user && (
        <div className="flex items-center gap-2.5 mb-4 p-3 bg-white rounded-xl border border-gray-200">
          <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
            {(user.name?.[0] ?? 'U').toUpperCase()}
          </div>
          <p className="text-xs text-gray-600 truncate">{user.email}</p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="text-center p-2.5 bg-white rounded-xl border border-gray-200">
          <p className="text-xl font-bold text-emerald-600">{answeredCount}</p>
          <p className="text-[10px] text-emerald-600 font-semibold">Answered</p>
        </div>
        <div className="text-center p-2.5 bg-white rounded-xl border border-gray-200">
          <p className="text-xl font-bold text-gray-900">{remaining}</p>
          <p className="text-[10px] text-gray-500 font-semibold">Remaining</p>
        </div>
        <div className="text-center p-2.5 bg-white rounded-xl border border-gray-200">
          <p className="text-xl font-bold text-amber-500">{reviewCount}</p>
          <p className="text-[10px] text-amber-500 font-semibold">Review</p>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 space-y-1.5">
        {[
          { cls: 'bg-white border border-gray-300', label: 'Not Visited' },
          { cls: 'bg-pink-200 border border-pink-300', label: 'Not Answered' },
          { cls: 'bg-emerald-500', label: 'Answered' },
          { cls: 'bg-amber-400', label: 'Marked for Review' },
          { cls: 'bg-blue-500', label: 'Answered & Marked' },
        ].map(({ cls, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-3.5 h-3.5 rounded flex-shrink-0 ${cls}`} />
            <span className="text-[11px] text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Filters — only for a paper that actually has sections or several subjects */}
      {(sectionOptions.length > 1 || subjectOptions.length > 1) && (
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Filter</p>
            {filtersActive && (
              <button
                onClick={() => {
                  setFilterSection('all');
                  setFilterSubject('all');
                }}
                className="text-[10px] font-semibold text-indigo-600 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {sectionOptions.length > 1 && (
            <div className="rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
              <FilterRow
                label="All sections"
                count={`${totalQ}`}
                active={filterSection === 'all'}
                onClick={() => setFilterSection('all')}
              />
              {sectionOptions.map(sec => (
                <FilterRow
                  key={sec.name}
                  label={sec.short}
                  title={sec.name}
                  count={`${sec.answered}/${sec.total}`}
                  active={filterSection === sec.name}
                  onClick={() => setFilterSection(sec.name)}
                />
              ))}
            </div>
          )}

          {subjectOptions.length > 1 && (
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              className="w-full text-[11px] rounded-lg border border-gray-200 px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            >
              <option value="all">All subjects</option>
              {subjectOptions.map(([key, { label, count }]) => (
                <option key={key} value={key}>
                  {label} ({count})
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Question grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            QUESTIONS
          </p>
          {filtersActive && (
            <p className="text-[10px] font-semibold text-indigo-600">
              {visibleQuestions.length} of {totalQ}
            </p>
          )}
        </div>
        {visibleQuestions.length === 0 ? (
          <p className="text-[11px] text-gray-400 py-3 text-center">
            No questions match this filter.
          </p>
        ) : (
        <div className="grid grid-cols-6 gap-1.5">
          {visibleQuestions.map(({ q, idx }) => {
            const st = getQStatus(q);
            const isCurrent = idx === currentIdx;
            return (
              <button
                key={q.question_id}
                onClick={() => goToQuestion(idx)}
                className={`w-full aspect-square rounded-lg text-[11px] font-bold flex items-center justify-center transition-all ${STATUS_STYLE[st]} ${
                  isCurrent ? 'ring-2 ring-offset-1 ring-indigo-500' : 'hover:scale-110'
                }`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
        )}
      </div>
    </>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-100 select-none overflow-hidden">
      {/* Dark header */}
      <header className="flex-shrink-0 bg-slate-900 text-white shadow-lg z-30">
        <div className="max-w-screen-xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            {assessment?.difficulty && (
              <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-[0.2em] leading-none mb-0.5">
                {assessment.difficulty}
              </p>
            )}
            <p className="text-sm sm:text-[15px] font-bold leading-snug truncate">
              {assessment?.title}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Q {currentIdx + 1} of {totalQ}
              {/* Without this, running off the end of a filtered set just looks like
                  a dead Next button. */}
              {filtersActive && filteredPos !== -1 && (
                <span className="text-indigo-300">
                  {' · '}
                  {filteredPos + 1} of {visibleQuestions.length} filtered
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
            {timeLeft !== null && (
              <CircularTimer
                secondsLeft={timeLeft}
                totalSeconds={assessment?.time_limit_seconds ?? 3600}
                display={formatTime(timeLeft)}
              />
            )}

            {/* Proctoring violation counter */}
            {tabSwitchCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/20 border border-red-400/40 text-red-200 text-[11px] font-semibold">
                <AlertTriangle className="w-3 h-3" />
                {tabSwitchCount}/{MAX_TAB_SWITCHES}
              </span>
            )}

            <button
              onClick={() => setShowConfirmSubmit(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
            >
              Submit
            </button>

            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setPanelOpen(p => !p)}
              className="lg:hidden p-2 text-gray-300 hover:text-white"
              aria-label="Toggle question panel"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden max-w-screen-xl mx-auto w-full">
        {/* Question area */}
        <main className="flex-1 min-w-0 overflow-y-auto p-4">
          {currentQ && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6">
              {/*
                * Named languages rather than "Both" / "Hide தமிழ்", which described
                * the control's two states without saying what either produced.
                * Only rendered for a paper that genuinely carries both languages.
                */}
              {paperTranslationLang && (
                <div className="flex justify-end mb-3">
                  <label className="inline-flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-500">Language</span>
                    <select
                      value={langMode}
                      onChange={e => setLangMode(e.target.value as LangMode)}
                      className="text-xs font-semibold text-gray-700 rounded-lg border border-gray-200 bg-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    >
                      {langModeOptions(paperTranslationLang).map(o => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}

              <ActiveQuestionCard
                key={currentQ.question_id}
                question={currentQ}
                index={currentIdx}
                answer={responses[currentQ.question_id]}
                onChange={val => setAnswer(currentQ.question_id, val)}
                negative_marking={assessment?.negative_marking ?? false}
                // A paper whose sections are marked differently (GAT-B: 0.5 in
                // Section A, 1 in Section B) cannot show one figure on every
                // question — the subject decides. Falls back to the paper value.
                negative_mark_value={
                  negativeForSubject(examStage, currentQ.subject) ??
                  assessment?.negative_mark_value ??
                  null
                }
                langMode={langMode}
              />

              {/* Action row */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                <button
                  onClick={handleMarkForReview}
                  className={`border text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${
                    markedForReview.has(currentQ.question_id)
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-amber-400 bg-white text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {markedForReview.has(currentQ.question_id)
                    ? 'Unmark & Next'
                    : 'Mark for Review & Next'}
                </button>
                {hasCurrentAnswer && (
                  <button
                    onClick={() =>
                      setResponses(prev => {
                        const next = { ...prev };
                        delete next[currentQ.question_id];
                        return next;
                      })
                    }
                    className="border border-red-400 bg-white text-red-600 hover:bg-red-50 text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
                  >
                    Clear response
                  </button>
                )}
              </div>

              {/* Navigation */}
              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  onClick={() => stepQuestion(-1)}
                  disabled={!canStep(-1)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-30 disabled:cursor-not-allowed px-4 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                <button
                  onClick={() => stepQuestion(1)}
                  disabled={!canStep(1)}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Save & Next
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </main>

        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 flex-shrink-0 overflow-y-auto p-4">
          {SidebarContent()}
        </aside>
      </div>

      {/* Mobile sidebar overlay */}
      {panelOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setPanelOpen(false)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 w-80 bg-slate-100 overflow-y-auto p-4 flex flex-col lg:hidden shadow-2xl">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-gray-900">Questions</p>
              <button
                onClick={() => setPanelOpen(false)}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {SidebarContent()}
          </aside>
        </>
      )}

      {/* Submit confirm modal */}
      {showConfirmSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Submit Assessment?</h3>

            {/* Stats table */}
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
              {[
                { label: 'Total Questions', value: totalQ, cls: 'text-gray-900' },
                { label: 'Answered', value: answeredCount, cls: 'text-emerald-600' },
                { label: 'Not Answered', value: totalQ - answeredCount, cls: 'text-red-600' },
                { label: 'Marked for Review', value: reviewCount, cls: 'text-amber-600' },
              ].map(({ label, value, cls }, i, arr) => (
                <div
                  key={label}
                  className={`flex items-center justify-between px-4 py-3 ${i < arr.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <span className={`text-sm font-medium ${cls}`}>{label}</span>
                  <span className={`text-sm font-bold ${cls}`}>{value}</span>
                </div>
              ))}
            </div>

            {/* Warning if unanswered */}
            {totalQ - answeredCount > 0 && (
              <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-4">
                <svg className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <p className="text-xs text-amber-800 leading-relaxed">
                  You have <strong>{totalQ - answeredCount}</strong> unanswered question(s). Are you sure you want to submit?
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmSubmit(false)}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-sm"
              >
                Go Back
              </button>
              <button
                onClick={() => handleSubmit('manual')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-semibold transition-colors text-sm"
              >
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab-switch / focus-loss warning modal */}
      {/*
        * Centre-screen rather than a corner toast: hitting the quota is a decision
        * point, not a status update, and the emerald-on-white toast was hard to
        * read against the paper. Dismissed explicitly so it cannot vanish before
        * it has been noticed.
        */}
      {quotaReached && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-indigo-50 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7 text-indigo-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1.5">
              {sectionShort(quotaReached.name)} complete
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-2">
              You have answered the <strong>{quotaReached.attempt}</strong> questions this
              section asks for.
            </p>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Only {quotaReached.attempt} of its {quotaReached.questions} questions count
              towards your score. You can review these answers or move on to the rest of
              the paper.
            </p>
            <button
              onClick={() => setQuotaReached(null)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-semibold transition-colors text-sm"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {showTabWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1.5">
              Don't leave the test
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              Switching tabs or leaving this window is not allowed during the
              assessment. This is <strong>warning {tabSwitchCount} of {MAX_TAB_SWITCHES}</strong>.
              After {MAX_TAB_SWITCHES} violations your test will be auto-submitted.
            </p>
            <button
              onClick={() => setShowTabWarning(false)}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl font-semibold transition-colors text-sm"
            >
              I understand, continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Info tile for landing page ───────────────────────────────────────────────

function AssessmentInfoTile({
  icon,
  label,
  value,
  valueClass = '',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="bg-gradient-to-br from-gray-50 to-gray-100/70 dark:from-gray-800/80 dark:to-gray-800/40 rounded-xl p-3 hover:from-indigo-50 hover:to-purple-50 dark:hover:from-indigo-950/40 dark:hover:to-purple-950/40 transition-colors duration-300">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <p className={`text-base font-bold text-gray-900 dark:text-gray-100 mt-1 ${valueClass}`}>
        {value}
      </p>
    </div>
  );
}
