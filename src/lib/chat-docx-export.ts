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
  HeadingLevel,
  BorderStyle,
  ShadingType,
  ExternalHyperlink,
} from 'docx';
import { saveAs } from 'file-saver';
import { stripLatexDelimiters } from '@/lib/latex-utils';

const FONT = 'Calibri';
const MONO = 'Courier New';
const BASE_SIZE = 20;

const CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE as const, size: 1, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE as const, size: 1, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE as const, size: 1, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE as const, size: 1, color: 'CCCCCC' },
};

/**
 * Parse inline markdown into TextRun objects.
 * Handles: **bold**, *italic*, ~~strikethrough~~, `code`, [link](url), and plain text.
 */
function parseInlineMarkdown(text: string, size = BASE_SIZE): (TextRun | ExternalHyperlink)[] {
  text = stripLatexDelimiters(text);
  const runs: (TextRun | ExternalHyperlink)[] = [];
  // Order matters: bold before italic, links, strikethrough, code
  const regex = /(\*\*(.+?)\*\*|~~(.+?)~~|\*(.+?)\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun({ text: text.slice(lastIndex, match.index), size, font: FONT }));
    }
    if (match[2]) {
      // **bold**
      runs.push(new TextRun({ text: match[2], bold: true, size, font: FONT }));
    } else if (match[3]) {
      // ~~strikethrough~~
      runs.push(new TextRun({ text: match[3], strike: true, size, font: FONT }));
    } else if (match[4]) {
      // *italic*
      runs.push(new TextRun({ text: match[4], italics: true, size, font: FONT }));
    } else if (match[5]) {
      // `inline code`
      runs.push(new TextRun({ text: match[5], size: size - 2, font: MONO, shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' } }));
    } else if (match[6] && match[7]) {
      // [link text](url)
      runs.push(
        new ExternalHyperlink({
          link: match[7],
          children: [new TextRun({ text: match[6], size, font: FONT, color: '2563EB', underline: { type: 'single' } })],
        }),
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    runs.push(new TextRun({ text: text.slice(lastIndex), size, font: FONT }));
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text, size, font: FONT }));
  }

  return runs;
}

/**
 * Detect the indent level for nested list items and strip the prefix.
 * Returns { level, content }.
 */
function parseBulletLine(line: string): { level: number; content: string } | null {
  const m = line.match(/^(\s*)([-*])\s+(.+)/);
  if (!m) return null;
  const indent = m[1].length;
  const level = Math.min(Math.floor(indent / 2), 3);
  return { level, content: m[3] };
}

function parseNumberedLine(line: string): { level: number; content: string } | null {
  const m = line.match(/^(\s*)\d+[.)]\s+(.+)/);
  if (!m) return null;
  const indent = m[1].length;
  const level = Math.min(Math.floor(indent / 2), 3);
  return { level, content: m[2] };
}

/**
 * Parse a GFM markdown table (header row, separator, data rows) into a docx Table.
 */
function parseTable(lines: string[]): Table {
  const parseRow = (line: string) =>
    line.split('|').map(c => c.trim()).filter(c => c !== '');

  const headerCells = parseRow(lines[0]);
  // lines[1] is the separator row (---|---), skip it
  const dataRows = lines.slice(2).map(parseRow);

  const colCount = headerCells.length;

  const headerRow = new TableRow({
    children: headerCells.map(
      cell =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: cell, bold: true, size: 18, font: FONT })],
              spacing: { before: 40, after: 40 },
            }),
          ],
          borders: CELL_BORDERS,
          shading: { type: ShadingType.CLEAR, fill: 'F3F4F6' },
          width: { size: Math.floor(100 / colCount), type: WidthType.PERCENTAGE },
        }),
    ),
  });

  const bodyRows = dataRows.map(
    cells =>
      new TableRow({
        children: Array.from({ length: colCount }, (_, i) => {
          const cellText = cells[i] || '';
          return new TableCell({
            children: [
              new Paragraph({
                children: parseInlineMarkdown(cellText, 18) as any[],
                spacing: { before: 30, after: 30 },
              }),
            ],
            borders: CELL_BORDERS,
            width: { size: Math.floor(100 / colCount), type: WidthType.PERCENTAGE },
          });
        }),
      }),
  );

  return new Table({
    rows: [headerRow, ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

/**
 * Check if a set of consecutive lines form a GFM table.
 * Returns the number of lines consumed, or 0 if not a table.
 */
function detectTable(lines: string[], startIndex: number): number {
  if (startIndex + 2 > lines.length) return 0;
  const line0 = lines[startIndex].trim();
  const line1 = lines[startIndex + 1]?.trim() || '';
  // Header row must have |, separator must be like |---|---|
  if (!line0.includes('|') || !/^\|?[\s:]*-{2,}[\s:]*(\|[\s:]*-{2,}[\s:]*)+\|?$/.test(line1)) return 0;
  let count = 2;
  while (startIndex + count < lines.length && lines[startIndex + count].trim().includes('|')) {
    count++;
  }
  return count;
}

/**
 * Convert markdown content into an array of docx elements (Paragraph | Table).
 */
function markdownToElements(content: string): (Paragraph | Table)[] {
  content = stripLatexDelimiters(content);
  const elements: (Paragraph | Table)[] = [];
  const lines = content.split('\n');
  let i = 0;
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = '';

  while (i < lines.length) {
    const line = lines[i];

    // ── Code block fences ──
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        // End code block
        if (codeLang) {
          elements.push(
            new Paragraph({
              children: [new TextRun({ text: codeLang, size: 16, color: '888888', font: MONO, italics: true })],
              spacing: { before: 80 },
              indent: { left: 360 },
            }),
          );
        }
        elements.push(
          new Paragraph({
            children: [new TextRun({ text: codeLines.join('\n'), size: 18, font: MONO })],
            shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
            spacing: { before: codeLang ? 20 : 80, after: 80 },
            indent: { left: 360 },
          }),
        );
        codeLines = [];
        codeLang = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.trimStart().slice(3).trim();
      }
      i++;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      i++;
      continue;
    }

    const trimmed = line.trim();

    // ── Empty line ──
    if (!trimmed) {
      elements.push(new Paragraph({ spacing: { after: 60 } }));
      i++;
      continue;
    }

    // ── Table detection ──
    const tableLen = detectTable(lines, i);
    if (tableLen > 0) {
      elements.push(parseTable(lines.slice(i, i + tableLen).map(l => l.trim())));
      elements.push(new Paragraph({ spacing: { after: 80 } }));
      i += tableLen;
      continue;
    }

    // ── Horizontal rule ──
    if (/^[-*_]{3,}$/.test(trimmed)) {
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: '─'.repeat(60), size: 14, color: 'CCCCCC' })],
          spacing: { before: 80, after: 80 },
        }),
      );
      i++;
      continue;
    }

    // ── Headings ──
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingLevel =
        level === 1 ? HeadingLevel.HEADING_1
          : level === 2 ? HeadingLevel.HEADING_2
            : level === 3 ? HeadingLevel.HEADING_3
              : HeadingLevel.HEADING_4;
      const sizes = [28, 24, 22, 20];
      elements.push(
        new Paragraph({
          children: [new TextRun({ text: headingMatch[2], bold: true, size: sizes[level - 1], font: FONT })],
          heading: headingLevel,
          spacing: { before: 140, after: 60 },
        }),
      );
      i++;
      continue;
    }

    // ── Blockquote ──
    if (trimmed.startsWith('>')) {
      const quoteContent = trimmed.replace(/^>\s*/, '');
      elements.push(
        new Paragraph({
          children: parseInlineMarkdown(quoteContent, BASE_SIZE) as any[],
          indent: { left: 480 },
          spacing: { before: 40, after: 40 },
          border: {
            left: { style: BorderStyle.SINGLE, size: 6, color: '94A3B8' },
          },
        }),
      );
      i++;
      continue;
    }

    // ── Bullet list ──
    const bullet = parseBulletLine(line);
    if (bullet) {
      elements.push(
        new Paragraph({
          children: parseInlineMarkdown(bullet.content, BASE_SIZE) as any[],
          bullet: { level: bullet.level },
          spacing: { after: 40 },
        }),
      );
      i++;
      continue;
    }

    // ── Numbered list ──
    const numbered = parseNumberedLine(line);
    if (numbered) {
      elements.push(
        new Paragraph({
          children: parseInlineMarkdown(numbered.content, BASE_SIZE) as any[],
          bullet: { level: numbered.level },
          spacing: { after: 40 },
        }),
      );
      i++;
      continue;
    }

    // ── Regular paragraph ──
    elements.push(
      new Paragraph({
        children: parseInlineMarkdown(trimmed, BASE_SIZE) as any[],
        spacing: { after: 60 },
      }),
    );
    i++;
  }

  // Flush remaining code block
  if (codeLines.length > 0) {
    elements.push(
      new Paragraph({
        children: [new TextRun({ text: codeLines.join('\n'), size: 18, font: MONO })],
        shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
        spacing: { before: 80, after: 80 },
        indent: { left: 360 },
      }),
    );
  }

  return elements;
}

/**
 * Convert a user message (plain text with preserved whitespace) into paragraphs.
 * Matches the `whitespace-pre-wrap` display on the page.
 */
function userMessageToParagraphs(content: string): Paragraph[] {
  return content.split('\n').map(
    line =>
      new Paragraph({
        children: [new TextRun({ text: line, size: BASE_SIZE, font: FONT })],
        spacing: { after: 40 },
        indent: { left: 180 },
      }),
  );
}

/** Generate and download a DOCX for a chat conversation. */
export async function downloadChatAsDocx(
  title: string,
  messages: { role: string; content: string; created_at?: string }[],
) {
  const children: (Paragraph | Table)[] = [];

  // Title
  children.push(
    new Paragraph({
      children: [new TextRun({ text: title, bold: true, size: 32, font: FONT })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
  );

  // Divider
  children.push(
    new Paragraph({
      children: [new TextRun({ text: '─'.repeat(80), size: 14, color: 'CCCCCC' })],
      spacing: { after: 160 },
    }),
  );

  for (const msg of messages) {
    const isUser = msg.role === 'user';
    const label = isUser ? 'You' : 'AI Assistant';
    const labelColor = isUser ? '2563EB' : '16A34A';

    // Role label with bottom border
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: label, bold: true, size: 22, color: labelColor, font: FONT }),
        ],
        spacing: { before: 240, after: 60 },
        border: {
          bottom: { style: BorderStyle.SINGLE, size: 1, color: 'E5E7EB' },
        },
      }),
    );

    // Message content
    if (isUser) {
      // User messages: preserve line breaks like whitespace-pre-wrap on the page
      children.push(...userMessageToParagraphs(msg.content || ''));
    } else {
      // AI messages: full markdown parsing matching MarkdownMessage rendering
      children.push(...markdownToElements(msg.content || ''));
    }
  }

  const doc = new Document({
    sections: [{ children }],
  });

  const buffer = await Packer.toBlob(doc);
  const safeName = title.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_') || 'chat';
  saveAs(buffer, `${safeName}.docx`);
}
