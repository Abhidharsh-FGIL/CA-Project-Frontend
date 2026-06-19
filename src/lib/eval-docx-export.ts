import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import { stripLatexDelimiters } from '@/lib/latex-utils';

const TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ',
  fill: 'Fill in the Blank',
  short: 'Short Answer',
  long: 'Long Answer',
  true_false: 'True / False',
  match: 'Match the Following',
};

const BORDER_STYLE = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: 'CCCCCC',
};

const CELL_BORDERS = {
  top: BORDER_STYLE,
  bottom: BORDER_STYLE,
  left: BORDER_STYLE,
  right: BORDER_STYLE,
};

/** Generate and download a DOCX for a question paper with all its questions.
 *  Matches the same content structure as the PDF export (inline answers, branding, etc.)
 */
export async function downloadPaperAsDocx(
  paper: {
    title: string;
    subject?: string | null;
    grade?: number | null;
    board?: string | null;
    difficulty?: string | null;
    question_count?: number | null;
    max_score?: number | null;
    time_limit?: number | null;
    status?: string | null;
    created_at?: string | null;
  },
  questions: any[],
  withAnswers: boolean = true,
) {
  const children: any[] = [];

  // ── Brand header bar ──
  children.push(
    new Paragraph({
      children: [
        new TextRun({ text: 'Assessment Platform', bold: true, size: 28, font: 'Calibri', color: '4F46E5' }),
      ],
      shading: { type: ShadingType.SOLID, color: 'EEF2FF' },
      spacing: { after: 80 },
    }),
  );

  // ── Title + subtitle ──
  children.push(
    new Paragraph({
      children: [new TextRun({ text: paper.title || 'Assessment', bold: true, size: 36, font: 'Calibri' })],
      spacing: { after: 40 },
    }),
  );
  // ── Metadata line — collections are pure question sets, no assessment metadata ──
  const metaParts: string[] = [];
  metaParts.push(`Questions: ${questions.length}`);
  // Difficulty shown once here, not repeated per question
  const collectionDiff = (questions[0] as any)?.difficulty as string | undefined;
  if (collectionDiff) {
    metaParts.push(`Difficulty: ${collectionDiff.charAt(0).toUpperCase() + collectionDiff.slice(1)}`);
  }

  children.push(
    new Paragraph({
      children: [new TextRun({ text: metaParts.join('   |   '), size: 18, color: '6B7280', font: 'Calibri' })],
      spacing: { after: 60 },
    }),
  );

  // Divider
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '─'.repeat(80), size: 16, color: 'E5E7EB' })],
      spacing: { after: 120 },
    }),
  );

  // ── Questions — no per-question mark/difficulty tag ──
  let qNum = 1;
  for (const q of questions) {
    const ca = q.correct_answer ?? q.correctAnswer;

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `Q${qNum}.  `, bold: true, size: 24, font: 'Calibri' }),
          new TextRun({ text: stripLatexDelimiters(q.text || ''), size: 24, font: 'Calibri' }),
        ],
        spacing: { before: 200, after: 100 },
      }),
    );

    // ── MCQ / True-False options (inline answer highlighting) ──
    if ((q.type === 'mcq' || q.type === 'true_false') && Array.isArray(q.options) && q.options.length > 0) {
      q.options.forEach((opt: string, i: number) => {
        const label = String.fromCharCode(65 + i);
        const isCorrect = withAnswers && ca != null && (
          ca === i || ca === label ||
          String(ca).toLowerCase() === String(opt).toLowerCase() ||
          String(ca) === String(i)
        );

        if (isCorrect) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${label})  ${stripLatexDelimiters(opt)}`, bold: true, size: 20, font: 'Calibri', color: '10B981' }),
                new TextRun({ text: '  ✓', bold: true, size: 20, font: 'Calibri', color: '10B981' }),
              ],
              indent: { left: 720 },
              spacing: { after: 40 },
              shading: { type: ShadingType.SOLID, color: 'ECFDF5' },
            }),
          );
        } else {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${label})  `, bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: stripLatexDelimiters(opt), size: 20, font: 'Calibri' }),
              ],
              indent: { left: 720 },
              spacing: { after: 40 },
            }),
          );
        }
      });
    }

    // True/False without explicit options
    if (q.type === 'true_false' && (!q.options || q.options.length === 0)) {
      ['True', 'False'].forEach((opt, i) => {
        const label = String.fromCharCode(65 + i);
        const isCorrect = withAnswers && ca != null && String(ca).toLowerCase() === opt.toLowerCase();

        if (isCorrect) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${label})  ${opt}`, bold: true, size: 20, font: 'Calibri', color: '10B981' }),
                new TextRun({ text: '  ✓', bold: true, size: 20, font: 'Calibri', color: '10B981' }),
              ],
              indent: { left: 720 },
              spacing: { after: 40 },
              shading: { type: ShadingType.SOLID, color: 'ECFDF5' },
            }),
          );
        } else {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${label})  `, bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: opt, size: 20, font: 'Calibri' }),
              ],
              indent: { left: 720 },
              spacing: { after: 40 },
            }),
          );
        }
      });
    }

    // ── Short / Fill / Long answer ──
    if (q.type === 'short' || q.type === 'long' || q.type === 'fill') {
      if (withAnswers && ca) {
        const ansLabel = q.type === 'long' ? 'Model Answer: ' : 'Answer: ';
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: ansLabel, bold: true, size: 20, color: '10B981', font: 'Calibri' }),
              new TextRun({ text: stripLatexDelimiters(String(ca)), size: 20, color: '10B981', font: 'Calibri' }),
            ],
            indent: { left: 360 },
            spacing: { after: 60 },
          }),
        );
      } else {
        // Blank lines for writing
        const lineCount = q.type === 'long' ? 4 : 2;
        for (let l = 0; l < lineCount; l++) {
          children.push(
            new Paragraph({
              children: [new TextRun({ text: '________________________________________________________________', size: 20, color: 'C8C8C8', font: 'Calibri' })],
              indent: { left: 360 },
              spacing: { after: 30 },
            }),
          );
        }
      }
    }

    // ── Match the Following — table ──
    if (q.type === 'match') {
      const rawOpts = q.options;
      const matchPairs: Array<{ left: string; right: string }> | null =
        q.pairs ?? (rawOpts && !Array.isArray(rawOpts) ? rawOpts.pairs : null);

      if (matchPairs && matchPairs.length > 0) {
        const headerRow = new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: '#', bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
              width: { size: 8, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS,
              shading: { type: ShadingType.SOLID, color: '4F46E5' },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: 'Term', bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
              width: { size: 46, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS,
              shading: { type: ShadingType.SOLID, color: '4F46E5' },
            }),
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: withAnswers ? 'Definition' : 'Match', bold: true, size: 20, font: 'Calibri', color: 'FFFFFF' })], alignment: AlignmentType.CENTER })],
              width: { size: 46, type: WidthType.PERCENTAGE },
              borders: CELL_BORDERS,
              shading: { type: ShadingType.SOLID, color: '4F46E5' },
            }),
          ],
        });

        const dataRows = matchPairs.map(
          (pair: any, pi: number) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: String(pi + 1), bold: true, size: 20, font: 'Calibri' })] })],
                  borders: CELL_BORDERS,
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: stripLatexDelimiters(pair.term || pair.left || ''), size: 20, font: 'Calibri' })] })],
                  borders: CELL_BORDERS,
                }),
                new TableCell({
                  children: [new Paragraph({ children: [new TextRun({ text: withAnswers ? stripLatexDelimiters(pair.definition || pair.right || '') : '', size: 20, font: 'Calibri' })] })],
                  borders: CELL_BORDERS,
                }),
              ],
            }),
        );

        children.push(
          new Table({
            rows: [headerRow, ...dataRows],
            width: { size: 85, type: WidthType.PERCENTAGE },
          }),
        );
        children.push(new Paragraph({ spacing: { after: 80 } }));
      }
    }

    // ── Explanation (with answers only) ──
    if (withAnswers && q.explanation) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: 'Explanation: ', bold: true, size: 18, italics: true, color: '6B7280', font: 'Calibri' }),
            new TextRun({ text: stripLatexDelimiters(q.explanation), size: 18, italics: true, color: '6B7280', font: 'Calibri' }),
          ],
          indent: { left: 360 },
          spacing: { after: 60 },
        }),
      );
    }

    qNum++;
  }

  // ── Footer ──
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '─'.repeat(80), size: 16, color: 'E5E7EB' })],
      spacing: { before: 200 },
    }),
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Generated by Assessment Platform', size: 16, color: '6B7280', font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 40 },
    }),
  );

  const doc = new Document({
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFilename(paper.title || 'paper')}${withAnswers ? '-with-answers' : ''}.docx`);
}

/** Generate and download a DOCX for a question bank export. */
export async function downloadQuestionsAsDocx(items: any[], filename?: string) {
  const children: any[] = [];

  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'Question Bank Export', bold: true, size: 32, font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
    }),
  );
  children.push(
    new Paragraph({
      children: [new TextRun({ text: `${items.length} questions`, size: 20, color: '666666', font: 'Calibri' })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  );

  items.forEach((q: any, i: number) => {
    const typeText = TYPE_LABELS[q.type] || q.type || '';
    const diffText = q.difficulty ? capitalize(q.difficulty) : '';
    const subjectText = q.subject || '';
    const meta = [subjectText, typeText, diffText, `${q.points || 1} pt`].filter(Boolean).join(' | ');

    // Question number + meta
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 22, font: 'Calibri' }),
          new TextRun({ text: `(${meta})`, size: 18, color: '888888', italics: true, font: 'Calibri' }),
        ],
        spacing: { before: 160, after: 40 },
      }),
    );

    // Question text
    children.push(
      new Paragraph({
        children: [new TextRun({ text: stripLatexDelimiters(q.text || ''), size: 22, font: 'Calibri' })],
        indent: { left: 360 },
        spacing: { after: 60 },
      }),
    );

    // MCQ options
    if (q.type === 'mcq' && Array.isArray(q.options)) {
      q.options.forEach((opt: string, j: number) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: `${String.fromCharCode(65 + j)}) `, bold: true, size: 20, font: 'Calibri' }),
              new TextRun({ text: stripLatexDelimiters(opt), size: 20, font: 'Calibri' }),
            ],
            indent: { left: 720 },
            spacing: { after: 30 },
          }),
        );
      });
    }

    // Match the following — pairs table
    if (q.type === 'match') {
      const rawOpts = q.options;
      const matchPairs: Array<{ left: string; right: string }> | null =
        q.pairs ?? (rawOpts && !Array.isArray(rawOpts) ? rawOpts.pairs : null);
      const matchOptions: string[] | null = Array.isArray(rawOpts) ? rawOpts : rawOpts?.options ?? null;

      if (matchPairs && matchPairs.length > 0) {
        matchPairs.forEach((pair: any, pi: number) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${String.fromCharCode(65 + pi)}. ${stripLatexDelimiters(pair.left)}`, size: 20, font: 'Calibri' }),
                new TextRun({ text: `  →  ${stripLatexDelimiters(pair.right)}`, size: 20, bold: true, color: '2E7D32', font: 'Calibri' }),
              ],
              indent: { left: 720 },
              spacing: { after: 30 },
            }),
          );
        });
      } else if (matchOptions && matchOptions.length > 0) {
        matchOptions.forEach((opt: string, oi: number) => {
          children.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${oi + 1}) `, bold: true, size: 20, font: 'Calibri' }),
                new TextRun({ text: stripLatexDelimiters(opt), size: 20, font: 'Calibri' }),
              ],
              indent: { left: 720 },
              spacing: { after: 30 },
            }),
          );
        });
      }
    }

    // Answer
    if (withAnswers && q.correct_answer != null) {
      let ansDisplay = String(q.correct_answer);
      if (q.type === 'mcq' && Array.isArray(q.options)) {
        const idx = typeof q.correct_answer === 'number' ? q.correct_answer : q.options.indexOf(q.correct_answer);
        if (idx >= 0 && idx < q.options.length) {
          ansDisplay = `${String.fromCharCode(65 + idx)}) ${q.options[idx]}`;
        }
      }
      // For long answers, label it as "Model Answer"
      const ansLabel = q.type === 'long' ? 'Model Answer: ' : 'Answer: ';
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: ansLabel, bold: true, size: 20, color: '2E7D32', font: 'Calibri' }),
            new TextRun({ text: stripLatexDelimiters(ansDisplay), size: 20, color: '2E7D32', font: 'Calibri' }),
          ],
          indent: { left: 360 },
          spacing: { after: 80 },
        }),
      );
    }
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitizeFilename(filename || `questions-${Date.now()}`)}.docx`);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'document';
}
