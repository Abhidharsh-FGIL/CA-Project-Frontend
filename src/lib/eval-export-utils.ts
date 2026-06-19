/**
 * Shared export utilities for Evaluation Hub downloads.
 * Supports Excel (XLSX), PDF, and DOCX formats.
 */
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, AlignmentType, HeadingLevel, BorderStyle, ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';
import { stripLatexDelimiters } from '@/lib/latex-utils';

export type ExportFormat = 'excel' | 'pdf' | 'docx';

// ── Shared helpers ──

export function csvCell(v: any): string {
  const s = v == null ? '' : String(v);
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'document';
}

const TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ', fill: 'Fill in the Blank', short: 'Short Answer',
  long: 'Long Answer', true_false: 'True / False', match: 'Match the Following',
};

/** Get ordered option entries as [label, text] pairs. Handles both dict {A: "...", B: "..."} and array formats. */
function getOptionEntries(options: any): [string, string][] {
  if (!options) return [];
  if (Array.isArray(options)) {
    return options.map((o: string, j: number) => [String.fromCharCode(65 + j), String(o)]);
  }
  return Object.entries(options).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, String(v)]);
}

/** Resolve correct_answer to display text. Handles numeric index, letter key, or text match. */
function resolveAnswer(q: QuestionData): string {
  if (q.correct_answer == null) return '';
  if (q.type !== 'mcq' || !q.options) return String(q.correct_answer);

  const entries = getOptionEntries(q.options);
  const ca = q.correct_answer;

  // Case 1: numeric index (0, 1, 2, ...)
  if (typeof ca === 'number' && ca >= 0 && ca < entries.length) {
    return `${entries[ca][0]}) ${entries[ca][1]}`;
  }
  // Case 2: string numeric index ("0", "1", ...)
  const numIdx = parseInt(String(ca), 10);
  if (!isNaN(numIdx) && numIdx >= 0 && numIdx < entries.length && String(numIdx) === String(ca)) {
    return `${entries[numIdx][0]}) ${entries[numIdx][1]}`;
  }
  // Case 3: letter key ("A", "B", ...)
  const key = String(ca);
  const match = entries.find(([k]) => k === key);
  if (match) return `${match[0]}) ${match[1]}`;
  // Case 4: raw text fallback
  return key;
}

const BORDER = { style: BorderStyle.SINGLE, size: 1, color: 'CCCCCC' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

// ── Data structures ──

export interface MetaField { label: string; value: string }
export interface QuestionData {
  text: string; type: string; points: number; subject?: string;
  difficulty?: string; options?: any; correct_answer?: any;
  explanation?: string; pairs?: any[];
}
export interface StudentRow {
  email: string; name: string; status: string; score: string;
  maxScore: string; percentage: string; timeTaken: string;
  violations: string; submitType: string; startedAt: string;
  submittedAt: string; attempt: string;
}

// ══════════════════════════════════════════════════════════
//  ASSESSMENT EXPORT (metadata + questions with answers)
// ══════════════════════════════════════════════════════════

export async function exportAssessment(
  meta: MetaField[], questions: QuestionData[], title: string, format: ExportFormat,
) {
  switch (format) {
    case 'excel': return exportAssessmentExcel(meta, questions, title);
    case 'pdf': return exportAssessmentPDF(meta, questions, title);
    case 'docx': return exportAssessmentDocx(meta, questions, title);
  }
}

// ── Assessment DOCX ──

async function exportAssessmentDocx(meta: MetaField[], questions: QuestionData[], title: string) {
  const children: any[] = [];

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 36, font: 'Calibri' })],
    alignment: AlignmentType.CENTER, spacing: { after: 100 },
  }));

  // Metadata (only when present \u2014 collections pass empty array)
  const metaLine = meta.filter(m => m.value && m.value !== '-').map(m => `${m.label}: ${m.value}`).join('   |   ');
  if (metaLine) {
    children.push(new Paragraph({
      children: [new TextRun({ text: metaLine, size: 20, color: '666666', font: 'Calibri' })],
      alignment: AlignmentType.CENTER, spacing: { after: 60 },
    }));
  }

  // Subtitle: question count + common difficulty (shown once, not per question)
  const commonDiff = questions[0]?.difficulty;
  const diffPart = commonDiff
    ? `    |    Difficulty: ${commonDiff.charAt(0).toUpperCase() + commonDiff.slice(1)}`
    : '';
  children.push(new Paragraph({
    children: [new TextRun({ text: `Total Questions: ${questions.length}${diffPart}`, size: 20, color: '666666', font: 'Calibri' })],
    alignment: AlignmentType.CENTER, spacing: { after: 200 },
  }));
  children.push(new Paragraph({ children: [new TextRun({ text: '\u2500'.repeat(80), size: 16, color: 'CCCCCC' })], spacing: { after: 200 } }));

  // Questions \u2014 no per-question mark/difficulty tag
  questions.forEach((q, i) => {
    // Q number + question text
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `Q${i + 1}.  `, bold: true, size: 24, font: 'Calibri' }),
        new TextRun({ text: stripLatexDelimiters(q.text || ''), size: 24, font: 'Calibri' }),
      ],
      spacing: { before: 200, after: 100 },
    }));

    // MCQ options
    if (q.type === 'mcq' && q.options) {
      const entries = getOptionEntries(q.options);
      entries.forEach(([label, text]) => {
        children.push(new Paragraph({
          children: [
            new TextRun({ text: `${label}) `, bold: true, size: 20, font: 'Calibri' }),
            new TextRun({ text: stripLatexDelimiters(text), size: 20, font: 'Calibri' }),
          ],
          indent: { left: 720 }, spacing: { after: 40 },
        }));
      });
    }

    // True/False
    if (q.type === 'true_false') {
      children.push(new Paragraph({
        children: [
          new TextRun({ text: 'A) ', bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: 'True', size: 20, font: 'Calibri' }),
          new TextRun({ text: '          B) ', bold: true, size: 20, font: 'Calibri' }),
          new TextRun({ text: 'False', size: 20, font: 'Calibri' }),
        ],
        indent: { left: 720 }, spacing: { after: 40 },
      }));
    }

    // Match pairs
    if (q.type === 'match') {
      const pairs = q.pairs ?? (q.options && !Array.isArray(q.options) ? q.options.pairs : null);
      if (pairs && Array.isArray(pairs)) {
        pairs.forEach((pair: any, pi: number) => {
          children.push(new Paragraph({
            children: [
              new TextRun({ text: `${String.fromCharCode(65 + pi)}. ${stripLatexDelimiters(pair.left)}`, size: 20, font: 'Calibri' }),
              new TextRun({ text: `  \u2192  ${stripLatexDelimiters(pair.right)}`, size: 20, bold: true, color: '2E7D32', font: 'Calibri' }),
            ],
            indent: { left: 720 }, spacing: { after: 30 },
          }));
        });
      }
    }

    // Fill / Short answer line
    if (q.type === 'fill' || q.type === 'short') {
      children.push(new Paragraph({
        children: [new TextRun({ text: 'Ans: _______________________________________________', size: 20, color: 'AAAAAA', font: 'Calibri' })],
        indent: { left: 720 }, spacing: { after: 60 },
      }));
    }

    // Long answer lines
    if (q.type === 'long') {
      children.push(new Paragraph({
        children: [new TextRun({ text: 'Answer:', size: 20, color: 'AAAAAA', font: 'Calibri' })],
        indent: { left: 720 }, spacing: { after: 30 },
      }));
      for (let l = 0; l < 4; l++) {
        children.push(new Paragraph({
          children: [new TextRun({ text: '________________________________________________________________', size: 20, color: 'CCCCCC', font: 'Calibri' })],
          indent: { left: 720 }, spacing: { after: 30 },
        }));
      }
    }
  });

  // Answer Key
  children.push(new Paragraph({ spacing: { before: 400 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: '\u2500'.repeat(80), size: 16, color: 'CCCCCC' })] }));
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Answer Key', bold: true, size: 28, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { before: 100, after: 150 },
  }));

  questions.forEach((q, i) => {
    const ansText = resolveAnswer(q);
    const runs: TextRun[] = [
      new TextRun({ text: `Q${i + 1}. `, bold: true, size: 20, font: 'Calibri' }),
      new TextRun({ text: stripLatexDelimiters(ansText || '\u2014'), size: 20, font: 'Calibri', color: '2E7D32' }),
    ];
    if (q.explanation) {
      runs.push(new TextRun({ text: `  \u2014 ${stripLatexDelimiters(q.explanation)}`, size: 18, italics: true, color: '777777', font: 'Calibri' }));
    }
    children.push(new Paragraph({ children: runs, spacing: { after: 60 }, indent: { left: 180 } }));
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitize(title)}.docx`);
}

// ── Assessment PDF ──

async function exportAssessmentPDF(meta: MetaField[], questions: QuestionData[], title: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const m = 15;
  let y = m;

  const checkPage = (need: number) => {
    if (y + need > ph - m) { doc.addPage(); y = m; }
  };

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pw / 2, y, { align: 'center' });
  y += 10;

  // Metadata table — only rendered when meta fields exist
  const visibleMeta = meta.filter(m => m.value && m.value !== '-');
  if (visibleMeta.length > 0) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    for (const m2 of visibleMeta) {
      checkPage(5);
      doc.setFont('helvetica', 'bold');
      doc.text(`${m2.label}:`, 15, y);
      doc.setFont('helvetica', 'normal');
      doc.text(m2.value, 55, y);
      y += 5;
    }
    y += 5;
    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(m, y, pw - m, y);
    y += 8;
  } else {
    y += 4;
  }

  // Section heading — difficulty shown once here, not per question
  const commonDifficulty = questions[0]?.difficulty;
  const diffLabel = commonDifficulty
    ? commonDifficulty.charAt(0).toUpperCase() + commonDifficulty.slice(1)
    : null;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(60, 60, 60);
  doc.text(`Questions  (${questions.length})`, m, y);
  if (diffLabel) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(130, 130, 130);
    doc.text(`Difficulty: ${diffLabel}`, pw - m, y, { align: 'right' });
  }
  doc.setTextColor(0, 0, 0);
  y += 3;
  doc.setDrawColor(220, 220, 220);
  doc.line(m, y, pw - m, y);
  y += 7;

  questions.forEach((q, i) => {
    checkPage(30);

    const qText = stripLatexDelimiters(q.text || '');
    const qNum = `Q${i + 1}.`;
    const numWidth = doc.getStringUnitWidth(qNum) * 11 / doc.internal.scaleFactor + 3;
    const textMaxWidth = pw - m * 2 - numWidth; // full remaining width — no per-question tag

    // ── Q number (bold) + question text (normal) on the same baseline ──
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text(qNum, m, y);

    doc.setFont('helvetica', 'normal');
    const qLines = doc.splitTextToSize(qText, textMaxWidth);
    checkPage(qLines.length * 5.5 + 20);

    // First line of question text on same row as Q number
    doc.text(qLines[0] || '', m + numWidth, y);

    y += 5.5;

    // Remaining wrapped lines of question text
    if (qLines.length > 1) {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(20, 20, 20);
      for (let li = 1; li < qLines.length; li++) {
        checkPage(6);
        doc.text(qLines[li], m + numWidth, y);
        y += 5.5;
      }
    }
    y += 1;

    // ── MCQ options ──
    if (q.type === 'mcq' && q.options) {
      const entries = getOptionEntries(q.options);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      entries.forEach(([label, text]) => {
        checkPage(6);
        const optLine = `${label})  ${stripLatexDelimiters(text)}`;
        const optLines = doc.splitTextToSize(optLine, pw - m * 2 - numWidth - 4);
        doc.text(optLines, m + numWidth, y);
        y += optLines.length * 5;
      });
      doc.setTextColor(0, 0, 0);
    }

    // ── True / False ──
    if (q.type === 'true_false') {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      checkPage(6);
      doc.text('A)  True                    B)  False', m + numWidth, y);
      y += 5.5;
    }

    // ── Match pairs ──
    if (q.type === 'match') {
      const pairs = q.pairs ?? (q.options && !Array.isArray(q.options) ? (q.options as any).pairs : null);
      if (pairs && Array.isArray(pairs)) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        pairs.forEach((pair: any, pi: number) => {
          checkPage(6);
          doc.text(`${String.fromCharCode(65 + pi)}.  ${stripLatexDelimiters(pair.left)}  →  ${stripLatexDelimiters(pair.right)}`, m + numWidth, y);
          y += 5;
        });
      }
    }

    // ── Answer ──
    if (q.correct_answer != null) {
      checkPage(7);
      const ans = resolveAnswer(q);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 163, 74); // green-600
      doc.text(`✓  Answer: ${stripLatexDelimiters(ans)}`, m + numWidth, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      y += 5;
    }

    // ── Explanation ──
    if (q.explanation) {
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      const expLines = doc.splitTextToSize(`Explanation: ${stripLatexDelimiters(q.explanation)}`, pw - m * 2 - numWidth);
      checkPage(expLines.length * 4.5);
      doc.text(expLines, m + numWidth, y);
      doc.setTextColor(0, 0, 0);
      y += expLines.length * 4.5;
    }

    // Separator between questions
    y += 3;
    doc.setDrawColor(235, 235, 235);
    doc.line(m, y, pw - m, y);
    y += 5;
  });

  doc.save(`${sanitize(title)}.pdf`);
}

// ── Assessment Excel ──

async function exportAssessmentExcel(meta: MetaField[], questions: QuestionData[], title: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Summary sheet — only add when there is meaningful metadata
  if (meta.length > 0) {
    const summaryData: any[][] = [[title], []];
    meta.forEach(m => summaryData.push([m.label, m.value]));
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 18 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');
  }

  // Questions sheet
  const qHeaders = ['#', 'Question', 'Type', 'Points', 'Subject', 'Difficulty', 'Options', 'Correct Answer', 'Explanation'];
  const qRows: any[][] = [qHeaders];
  questions.forEach((q, i) => {
    let opts = '-';
    if (q.type === 'mcq' && q.options) {
      opts = getOptionEntries(q.options).map(([k, v]) => `${k}) ${v}`).join('\n');
    } else if (q.type === 'true_false') {
      opts = 'A) True\nB) False';
    } else if (q.type === 'match') {
      const pairs = q.pairs ?? (q.options && !Array.isArray(q.options) ? q.options.pairs : null);
      if (pairs) opts = pairs.map((p: any, j: number) => `${String.fromCharCode(65 + j)}) ${p.left} \u2192 ${p.right}`).join('\n');
    }

    const ans = q.correct_answer != null ? resolveAnswer(q) || '-' : '-';

    qRows.push([i + 1, stripLatexDelimiters(q.text || ''), TYPE_LABELS[q.type] || q.type, q.points || 1, q.subject || '-', q.difficulty || '-', stripLatexDelimiters(opts), stripLatexDelimiters(ans), stripLatexDelimiters(q.explanation || '-')]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(qRows);
  ws2['!cols'] = [{ wch: 4 }, { wch: 50 }, { wch: 16 }, { wch: 7 }, { wch: 14 }, { wch: 10 }, { wch: 40 }, { wch: 30 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Questions');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${sanitize(title)}.xlsx`);
}

// ══════════════════════════════════════════════════════════
//  REPORT EXPORT (metadata + stats + student results)
// ══════════════════════════════════════════════════════════

export async function exportReport(
  meta: MetaField[], students: StudentRow[], title: string, format: ExportFormat,
) {
  switch (format) {
    case 'excel': return exportReportExcel(meta, students, title);
    case 'pdf': return exportReportPDF(meta, students, title);
    case 'docx': return exportReportDocx(meta, students, title);
  }
}

// ── Report DOCX ──

async function exportReportDocx(meta: MetaField[], students: StudentRow[], title: string) {
  const children: any[] = [];

  // Title
  children.push(new Paragraph({
    children: [new TextRun({ text: title, bold: true, size: 36, font: 'Calibri' })],
    alignment: AlignmentType.CENTER, spacing: { after: 100 },
  }));

  // Metadata
  meta.forEach(m => {
    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${m.label}: `, bold: true, size: 20, font: 'Calibri', color: '555555' }),
        new TextRun({ text: m.value, size: 20, font: 'Calibri' }),
      ],
      spacing: { after: 30 }, indent: { left: 360 },
    }));
  });

  children.push(new Paragraph({ spacing: { before: 200 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: '\u2500'.repeat(80), size: 16, color: 'CCCCCC' })] }));

  // Student Results heading
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Student Results', bold: true, size: 26, font: 'Calibri' })],
    heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 120 },
  }));

  // Table headers
  const headers = ['Email', 'Name', 'Status', 'Score', '%', 'Time', 'Violations', 'Submit', 'Submitted At', '#'];
  const headerRow = new TableRow({
    children: headers.map(h => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 16, font: 'Calibri' })], alignment: AlignmentType.CENTER })],
      borders: CELL_BORDERS,
      shading: { type: ShadingType.SOLID, color: 'E8E8E8' },
    })),
  });

  const dataRows = students.map(s => new TableRow({
    children: [
      s.email, s.name, s.status, `${s.score}/${s.maxScore}`, s.percentage,
      s.timeTaken, s.violations, s.submitType, s.submittedAt, s.attempt,
    ].map(val => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: String(val || '-'), size: 16, font: 'Calibri' })] })],
      borders: CELL_BORDERS,
    })),
  }));

  children.push(new Table({
    rows: [headerRow, ...dataRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  }));

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${sanitize(title)}.docx`);
}

// ── Report PDF ──

async function exportReportPDF(meta: MetaField[], students: StudentRow[], title: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mx = 12;
  let y = mx;

  const checkPage = (need: number) => {
    if (y + need > ph - mx) { doc.addPage(); y = mx; }
  };

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pw / 2, y, { align: 'center' });
  y += 10;

  // Metadata
  doc.setFontSize(9);
  const visibleMeta = meta.filter(m => m.value && m.value !== '-');
  for (const m of visibleMeta) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${m.label}:`, mx, y);
    doc.setFont('helvetica', 'normal');
    doc.text(m.value, mx + 40, y);
    y += 5;
  }
  y += 5;

  // Student table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Student Results', mx, y);
  y += 7;

  const cols = ['Email', 'Name', 'Status', 'Score', '%', 'Time', 'Viol.', 'Submit', 'Submitted', '#'];
  const colWidths = [55, 30, 20, 18, 14, 14, 14, 18, 40, 10];
  const tableWidth = colWidths.reduce((a, b) => a + b, 0);

  // Header row
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(232, 232, 232);
  doc.rect(mx, y - 3, tableWidth, 6, 'F');
  let x = mx;
  cols.forEach((col, ci) => {
    doc.text(col, x + 1, y);
    x += colWidths[ci];
  });
  y += 5;

  // Data rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  students.forEach((s, ri) => {
    checkPage(6);
    if (ri % 2 === 0) {
      doc.setFillColor(248, 248, 248);
      doc.rect(mx, y - 3, tableWidth, 5, 'F');
    }
    const vals = [s.email, s.name, s.status, `${s.score}/${s.maxScore}`, s.percentage, s.timeTaken, s.violations, s.submitType, s.submittedAt, s.attempt];
    x = mx;
    vals.forEach((val, ci) => {
      const txt = String(val || '-').substring(0, Math.floor(colWidths[ci] / 1.8));
      doc.text(txt, x + 1, y);
      x += colWidths[ci];
    });
    y += 5;
  });

  // Border around table
  doc.setDrawColor(200, 200, 200);
  const tableTop = mx + 10 + visibleMeta.length * 5 + 5 + 7 - 3;
  doc.rect(mx, tableTop, tableWidth, y - tableTop + 1);

  doc.save(`${sanitize(title)}.pdf`);
}

// ── Report Excel ──

async function exportReportExcel(meta: MetaField[], students: StudentRow[], title: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData: any[][] = [[title], []];
  meta.forEach(m => summaryData.push([m.label, m.value]));
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  ws1['!cols'] = [{ wch: 20 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

  // Students sheet
  const headers = ['Email', 'Name', 'Status', 'Score', 'Max Score', 'Percentage', 'Time Taken (min)', 'Tab Violations', 'Submit Type', 'Started At', 'Submitted At', 'Attempt #'];
  const sRows: any[][] = [headers];
  students.forEach(s => {
    sRows.push([s.email, s.name, s.status, s.score, s.maxScore, s.percentage, s.timeTaken, s.violations, s.submitType, s.startedAt, s.submittedAt, s.attempt]);
  });
  const ws2 = XLSX.utils.aoa_to_sheet(sRows);
  ws2['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Students');

  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${sanitize(title)}.xlsx`);
}

// ══════════════════════════════════════════════════════════
//  QUESTION BANK EXPORT (list of questions)
// ══════════════════════════════════════════════════════════

export async function exportQuestionBank(questions: QuestionData[], title: string, format: ExportFormat) {
  // Reuse assessment export with minimal metadata
  const meta: MetaField[] = [
    { label: 'Total Questions', value: String(questions.length) },
    { label: 'Total Marks', value: String(questions.reduce((s, q) => s + (q.points || 1), 0)) },
  ];
  await exportAssessment(meta, questions, title || 'Question Bank Export', format);
}
