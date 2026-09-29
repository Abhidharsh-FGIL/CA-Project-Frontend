/**
 * The answer sheet as a Word document.
 *
 * The CSV next door is for working with — sort by subject, filter to the wrong
 * answers, paste a topic into a revision sheet. This is for *reading*: a review
 * booklet grouped by subject and topic, each question with its options, the
 * option chosen, the right one marked, and the explanation underneath. It is the
 * thing a student prints and a teacher marks up.
 *
 * Both exports draw from `model.questions`, so neither can disagree with the
 * report or with each other, and both carry every question — a skipped one is
 * the largest block of lost marks on most papers.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LineRuleType,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { stripLatexDelimiters } from './latex-utils';
import { normaliseLineBreaks, parseOptionRepr } from './question-text';
import type { AttemptReportModel } from './attempt-report';
import type { QuestionReviewItem } from './userPortalApi';

/**
 * Nirmala UI rather than Calibri.
 *
 * These papers are printed in Tamil, and Calibri carries no Tamil glyphs — Word
 * would substitute per-run and the document would come out in two mismatched
 * faces. Nirmala UI covers Tamil and Latin in one face, so a stem that mixes
 * them stays visually consistent.
 */
const FONT = 'Nirmala UI';

const INK = '1E2A5A';
const MUTED = '6B7280';
const GOOD = '047857';
const BAD = 'B91C1C';
const FAINT = '9CA3AF';

const OPTION_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];
const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

function run(text: string, opts: Partial<ConstructorParameters<typeof TextRun>[0]> = {}) {
  return new TextRun({ text, font: FONT, size: 20, ...(opts as object) });
}

/** The text of one option, whatever shape it arrived in. */
function optionText(options: unknown, idx: number): string | null {
  let raw: unknown;
  if (Array.isArray(options)) raw = options[idx];
  else if (options && typeof options === 'object') {
    const map = options as Record<string, unknown>;
    raw = map[OPTION_LABELS[idx]] ?? map[OPTION_KEYS[idx]];
  }
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') {
    const o = raw as { text?: string; image_url?: string };
    return o.text ?? o.image_url ?? null;
  }
  const rich = parseOptionRepr(raw);
  if (rich) return rich.text ?? rich.image_url ?? null;
  return String(raw);
}

function optionCount(options: unknown): number {
  if (Array.isArray(options)) return Math.min(options.length, OPTION_LABELS.length);
  if (options && typeof options === 'object') {
    return OPTION_LABELS.filter((_, i) => optionText(options, i) != null).length;
  }
  return 0;
}

/** Index an answer key points at, or -1 when the key is the answer text itself. */
function keyIndex(key: string | null | undefined): number {
  const k = (key ?? '').trim().toLowerCase();
  return k ? OPTION_KEYS.indexOf(k) : -1;
}

function answerLabel(key: string | null | undefined, options: unknown): string {
  const k = (key ?? '').trim();
  if (!k) return '';
  const idx = keyIndex(k);
  if (idx < 0) return k;
  const text = optionText(options, idx);
  return text ? `${OPTION_LABELS[idx]}) ${text}` : OPTION_LABELS[idx];
}

function resultOf(q: QuestionReviewItem): 'Correct' | 'Incorrect' | 'Not answered' {
  const answered = q.user_answer != null && String(q.user_answer).trim() !== '';
  if (!answered) return 'Not answered';
  return q.is_correct ? 'Correct' : 'Incorrect';
}

function clean(text: string | null | undefined): string {
  return stripLatexDelimiters((text ?? '').trim());
}

/** One question: stem, options, what was chosen, what was right, why. */
function questionBlock(q: QuestionReviewItem): Paragraph[] {
  const stem = parseOptionRepr(q.body);
  const body = clean(stem?.text ?? q.body) || '[Image question — see the portal]';
  const result = resultOf(q);
  const mine = keyIndex(q.user_answer);
  const right = keyIndex(q.correct_answer);
  const out: Paragraph[] = [];

  // Stem, with the tags that place it in the syllabus.
  out.push(
    new Paragraph({
      spacing: { before: 220, after: 60 },
      keepNext: true,
      children: [run(`Q${q.number}.  `, { bold: true, color: INK }), run(body, { color: INK })],
    }),
  );

  const tags = [q.topic, q.subtopic, q.difficulty, q.question_type]
    .map(t => (t ?? '').trim())
    .filter(Boolean)
    .map(t => t.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  if (tags.length > 0) {
    out.push(
      new Paragraph({
        spacing: { after: 60 },
        keepNext: true,
        children: [run(tags.join('  ·  '), { size: 16, color: FAINT, italics: true })],
      }),
    );
  }

  // Options. The right one is marked; a wrong choice is marked too, so the two
  // can be compared without cross-referencing the lines below.
  const total = optionCount(q.options);
  for (let i = 0; i < total; i += 1) {
    const text = optionText(q.options, i);
    if (text == null) continue;
    const isRight = i === right;
    const isMine = i === mine;
    const marker = isRight ? '  ✓' : isMine ? '  ✗ (your answer)' : '';
    out.push(
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 20 },
        children: [
          run(`${OPTION_LABELS[i]})  `, { bold: isRight || isMine, color: isRight ? GOOD : isMine ? BAD : MUTED }),
          run(clean(text), { bold: isRight, color: isRight ? GOOD : isMine ? BAD : INK }),
          ...(marker ? [run(marker, { bold: true, size: 16, color: isRight ? GOOD : BAD })] : []),
        ],
      }),
    );
  }

  // The verdict line, spelled out even where the options above already show it —
  // a paper with no options list still needs to state both answers.
  out.push(
    new Paragraph({
      indent: { left: 360 },
      spacing: { before: 80, after: 20 },
      children: [
        run('Your answer: ', { size: 18, bold: true, color: MUTED }),
        run(answerLabel(q.user_answer, q.options) || 'Not answered', {
          size: 18,
          color: result === 'Correct' ? GOOD : result === 'Incorrect' ? BAD : FAINT,
          italics: result === 'Not answered',
        }),
        run('     Correct answer: ', { size: 18, bold: true, color: MUTED }),
        run(answerLabel(q.correct_answer, q.options) || '—', { size: 18, color: GOOD }),
        run(`     ${result}`, {
          size: 18,
          bold: true,
          color: result === 'Correct' ? GOOD : result === 'Incorrect' ? BAD : FAINT,
        }),
        ...(q.time_spent_seconds > 0
          ? [run(`     ${q.time_spent_seconds}s`, { size: 18, color: FAINT })]
          : []),
      ],
    }),
  );

  out.push(...explanationBlock(q.explanation));

  return out;
}

/** A leading bullet or dash, so a wrapped line can hang under the text. */
const BULLET_RE = /^([•·▪◦*–—-])\s+/;

/**
 * The explanation, set as prose rather than as one unbroken run.
 *
 * An explanation is written in paragraphs — the answer, the concept behind it,
 * then why each distractor is wrong — but a single `TextRun` swallows those
 * breaks, and the booklet printed the whole thing as a solid block that had to
 * be read twice to find anything. Each authored paragraph now gets its own
 * Word paragraph, with the line spacing and the space between paragraphs that
 * makes a block of Tamil legible at 9pt.
 *
 * Bulleted lines get a hanging indent, so a bullet that wraps keeps its
 * continuation aligned under its own text instead of under the marker.
 */
function explanationBlock(raw: string | null | undefined): Paragraph[] {
  const text = normaliseLineBreaks(clean(raw));
  if (!text) return [];

  const out: Paragraph[] = [
    new Paragraph({
      indent: { left: 360 },
      spacing: { before: 140, after: 60 },
      keepNext: true,
      children: [run('Explanation', { size: 18, bold: true, color: MUTED })],
    }),
  ];

  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const bulleted = BULLET_RE.test(line);
    out.push(
      new Paragraph({
        // A bullet hangs from the same left edge as the prose around it.
        indent: bulleted ? { left: 620, hanging: 260 } : { left: 360 },
        spacing: {
          // 1.2 lines. Tamil sits tall, and single spacing crowds the glyphs.
          line: 288,
          lineRule: LineRuleType.AUTO,
          after: i === lines.length - 1 ? 60 : 100,
        },
        alignment: AlignmentType.JUSTIFIED,
        children: [run(line, { size: 18, color: INK })],
      }),
    );
  });

  return out;
}

/** Builds the document. */
function buildDoc(model: AttemptReportModel, studentName: string): Document {
  const s = model.summary;
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      spacing: { after: 40 },
      children: [run('BrightLearn Academy', { bold: true, size: 18, color: '7C3AED' })],
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 40 },
      children: [run('Answer Review', { bold: true, size: 36, color: INK })],
    }),
    new Paragraph({
      spacing: { after: 30 },
      children: [run(model.meta.testName ?? 'Attempt', { bold: true, size: 24, color: INK })],
    }),
  );

  const meta = [
    studentName,
    model.meta.examName ?? null,
    model.meta.date
      ? new Date(model.meta.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : null,
    model.meta.mode ? model.meta.mode.toUpperCase() : null,
  ].filter(Boolean) as string[];
  children.push(
    new Paragraph({ spacing: { after: 30 }, children: [run(meta.join('   ·   '), { size: 18, color: MUTED })] }),
  );

  // The headline figures, so the document stands on its own away from the portal.
  const figures = [
    s.score != null && s.maxMarks != null ? `Score ${s.score} / ${s.maxMarks}` : null,
    `${s.attempted} of ${s.totalQuestions} attempted`,
    `${s.correct} correct`,
    `${s.incorrect} incorrect`,
    `${s.unattempted} unanswered`,
    s.accuracy != null ? `${s.accuracy}% accuracy` : null,
  ].filter(Boolean) as string[];
  children.push(
    new Paragraph({
      spacing: { after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'E5E7EB', space: 8 } },
      children: [run(figures.join('   ·   '), { size: 18, bold: true, color: INK })],
    }),
  );

  /**
   * Grouped by subject, in the report's own order, then by topic within it.
   *
   * A flat run of 200 questions is unusable for revision; grouped, a student can
   * turn to the subject they were weakest in. Questions the report could not
   * place under a subject still appear, at the end, rather than being dropped.
   */
  const placed = new Set<string>();
  const byId = new Map(model.questions.map(q => [q.question_id, q]));

  for (const subject of model.subjects) {
    const items = subject.questionIds.map(id => byId.get(id)).filter(Boolean) as QuestionReviewItem[];
    if (items.length === 0) continue;
    items.forEach(q => placed.add(q.question_id));

    const m = subject.metrics;
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 20 },
        pageBreakBefore: true,
        children: [run(subject.name, { bold: true, size: 28, color: INK })],
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          run(
            `${m.questions} questions  ·  ${m.attempted} attempted  ·  ${m.correct} correct  ·  ${m.incorrect} incorrect  ·  ${m.skipped} unanswered` +
              (m.accuracy != null ? `  ·  ${m.accuracy}% accuracy` : ''),
            { size: 18, color: MUTED },
          ),
        ],
      }),
    );

    // Topic headings only where the paper is tagged; an untagged subject reads as
    // one run of questions rather than one heading saying nothing.
    const topics = [...new Set(items.map(q => (q.topic ?? '').trim()))].filter(Boolean);
    if (topics.length > 0) {
      for (const topic of topics) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 20 },
            keepNext: true,
            children: [run(topic, { bold: true, size: 22, color: '4338CA' })],
          }),
        );
        for (const q of items.filter(x => (x.topic ?? '').trim() === topic)) {
          children.push(...questionBlock(q));
        }
      }
      const untagged = items.filter(x => !(x.topic ?? '').trim());
      if (untagged.length > 0) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 20 },
            keepNext: true,
            children: [run('Untagged', { bold: true, size: 22, color: FAINT, italics: true })],
          }),
        );
        for (const q of untagged) children.push(...questionBlock(q));
      }
    } else {
      for (const q of items) children.push(...questionBlock(q));
    }
  }

  const orphans = model.questions.filter(q => !placed.has(q.question_id));
  if (orphans.length > 0) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 360, after: 120 },
        pageBreakBefore: true,
        children: [run('Other questions', { bold: true, size: 28, color: INK })],
      }),
    );
    for (const q of orphans) children.push(...questionBlock(q));
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        run(`${model.questions.length} questions  ·  Generated from your attempt`, { size: 16, color: FAINT }),
      ],
    }),
  );

  return new Document({
    creator: 'BrightLearn Academy',
    title: `Answer Review — ${model.meta.testName ?? 'Attempt'}`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ children }],
  });
}

export function questionDocxFilename(model: AttemptReportModel): string {
  const name = (model.meta.testName ?? 'attempt')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  const day = model.meta.date ? new Date(model.meta.date).toISOString().slice(0, 10) : 'report';
  return `${name || 'attempt'}-${day}-answer-review.docx`;
}

/** Builds and hands over the document. Async — packing 200 questions takes a moment. */
export async function downloadQuestionDocx(model: AttemptReportModel, studentName = 'Student'): Promise<void> {
  const blob = await Packer.toBlob(buildDoc(model, studentName));
  saveAs(blob, questionDocxFilename(model));
}
