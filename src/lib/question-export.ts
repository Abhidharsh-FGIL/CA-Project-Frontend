/**
 * The whole answer sheet, as a spreadsheet.
 *
 * One row per question — every question, including the ones left blank, because
 * a skipped question is the largest single block of lost marks on most papers
 * and an export that quietly dropped them would describe a different attempt
 * from the one on screen.
 *
 * CSV rather than PDF: this file is for working with — sorting by subject,
 * filtering to the wrong answers, pasting a topic's questions into a revision
 * sheet — and the staff who use it already live in Excel.
 */
import { parseOptionRepr } from './question-text';
import type { AttemptReportModel } from './attempt-report';
import type { QuestionReviewItem } from './userPortalApi';

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** How many option columns the sheet carries. Papers here run to five. */
const MAX_OPTIONS = 6;

/** The text of one option, whatever shape it arrived in. */
function optionText(options: unknown, idx: number): string {
  let raw: unknown;
  if (Array.isArray(options)) raw = options[idx];
  else if (options && typeof options === 'object') {
    const map = options as Record<string, unknown>;
    raw = map[OPTION_LABELS[idx]] ?? map[OPTION_KEYS[idx]];
  }
  if (raw == null || raw === '') return '';

  if (typeof raw === 'object') {
    const o = raw as { text?: string; image_url?: string; imageUrl?: string };
    return o.text ?? o.image_url ?? o.imageUrl ?? '';
  }
  // An image option serialised by Python's str() rather than as JSON.
  const rich = parseOptionRepr(raw);
  if (rich) return rich.text ?? rich.image_url ?? '';
  return String(raw);
}

/** The letter an answer key names, and the option text behind it. */
function answerParts(key: string | null, options: unknown): { label: string; text: string } {
  const k = (key ?? '').trim();
  if (!k) return { label: '', text: '' };
  const idx = OPTION_KEYS.indexOf(k.toLowerCase());
  return {
    label: idx >= 0 ? OPTION_LABELS[idx] : k.toUpperCase(),
    // A key that is not a letter is the answer itself on some papers.
    text: idx >= 0 ? optionText(options, idx) : k,
  };
}

/** Attempted, right, wrong — the same three states the report uses. */
function resultOf(q: QuestionReviewItem): 'Correct' | 'Incorrect' | 'Skipped' {
  const answered = q.user_answer != null && String(q.user_answer).trim() !== '';
  if (!answered) return 'Skipped';
  return q.is_correct ? 'Correct' : 'Incorrect';
}

/**
 * Escapes one cell for CSV.
 *
 * Also defuses a leading `=`, `+`, `-` or `@`: Excel reads those as a formula,
 * and a question stem that happens to start with a minus sign should not execute
 * in someone's spreadsheet.
 */
function cell(value: unknown): string {
  if (value == null) return '';
  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  // Newlines are kept — a multi-line stem stays readable inside its cell — which
  // is why every field is quoted rather than only the ones containing commas.
  return `"${s.replace(/"/g, '""')}"`;
}

/** Title-cases the difficulty and type tags, which arrive as slugs. */
function pretty(tag: string | null | undefined): string {
  const t = (tag ?? '').trim();
  if (!t) return '';
  return t
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Builds the sheet.
 *
 * Reads `model.questions`, which is the normalised list — the same one the
 * on-screen table renders — so the export cannot disagree with the report. The
 * active filters are deliberately ignored: this is the whole paper.
 */
export function buildQuestionCsv(model: AttemptReportModel): string {
  /**
   * The canonical subject name per question.
   *
   * Taken from the model's own grouping rather than from the question's raw
   * `subject` tag, so the sheet carries "General Tamil" where the booklet said
   * "தமிழ் தகுதித் தேர்வு" — the same label the report shows. Topic and
   * sub-topic come straight off the question, which is where they live.
   */
  const subjectName = new Map<string, string>();
  for (const s of model.subjects) {
    for (const id of s.questionIds) subjectName.set(id, s.name);
  }

  const header = [
    'Q.No',
    'Subject',
    'Topic',
    'Sub-topic',
    'Difficulty',
    'Question Type',
    'Question',
    ...OPTION_LABELS.slice(0, MAX_OPTIONS).map(l => `Option ${l}`),
    'Your Answer',
    'Your Answer (text)',
    'Correct Answer',
    'Correct Answer (text)',
    'Result',
    'Time Taken (sec)',
    'Max Marks',
    'Marks Awarded',
    'Explanation',
  ];

  const rows = model.questions.map(q => {
    const mine = answerParts(q.user_answer, q.options);
    const right = answerParts(q.correct_answer, q.options);
    const stem = parseOptionRepr(q.body);
    const body = (stem?.text ?? q.body ?? '').trim() || stem?.image_url || '';

    return [
      q.number,
      // The subject/topic names the report resolved, not the raw tags, so the
      // sheet and the screen name the same thing.
      subjectName.get(q.question_id) ?? q.subject ?? '',
      q.topic ?? '',
      q.subtopic ?? '',
      pretty(q.difficulty),
      pretty(q.question_type),
      body,
      ...Array.from({ length: MAX_OPTIONS }, (_, i) => optionText(q.options, i)),
      mine.label,
      mine.text,
      right.label,
      right.text,
      resultOf(q),
      // Zero and "not recorded" are different facts; only a real figure is written.
      q.time_spent_seconds > 0 ? q.time_spent_seconds : '',
      (q as any).max_marks ?? '',
      (q as any).marks_awarded ?? '',
      q.explanation ?? '',
    ];
  });

  return [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
}

/** A filename that says which paper and which attempt, so downloads don't collide. */
export function questionCsvFilename(model: AttemptReportModel): string {
  const name = (model.meta.testName ?? 'attempt')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const day = model.meta.date ? new Date(model.meta.date).toISOString().slice(0, 10) : 'report';
  return `${name || 'attempt'}-${day}-questions.csv`;
}

/**
 * Hands the sheet to the browser.
 *
 * The BOM is not optional. Excel on Windows reads a BOM-less CSV in the system
 * codepage, which turns every Tamil stem into mojibake — and on these papers
 * that is most of the file.
 */
export function downloadQuestionCsv(model: AttemptReportModel): void {
  const blob = new Blob(['﻿' + buildQuestionCsv(model)], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = questionCsvFilename(model);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Freed on the next tick — revoking synchronously races the click in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
