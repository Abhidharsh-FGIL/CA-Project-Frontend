/**
 * Question-paper PDF export.
 *
 * Renders the paper as a print-ready HTML document and hands it to the browser's
 * print dialog, where "Save as PDF" produces the file.
 *
 * Why not jsPDF (as the other exports here use)? jsPDF has no complex-script
 * text shaping — Tamil needs consonant/vowel-sign reordering and ligature
 * formation, so a Tamil paper comes out malformed even with a Tamil font
 * embedded. The browser does that shaping natively, so a printed page is the
 * only route that is correct for both the English and Tamil halves of a TNPSC
 * paper. It also gives real page breaks and prints exactly what is on screen.
 */
import { stripInlineOptions } from './question-text';

export interface PrintQuestion {
  text?: string;
  question_text?: string;
  type?: string;
  options?: any;
  correct_answer?: any;
  correctAnswer?: any;
  explanation?: string | null;
  points?: number;
  marks?: number;
  subject?: string | null;
  difficulty?: string | null;
  pairs?: Array<{ left: string; right: string }> | null;
  translations?: Record<string, { text?: string; options?: string[]; explanation?: string | null }> | null;
}

export interface PrintPaperOptions {
  title: string;
  /** Header chips — "200 Questions", "300 marks", "180 min" … */
  meta?: string[];
  questions: PrintQuestion[];
  /** Include the correct answer and explanation under each question. */
  withAnswers: boolean;
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Options arrive as string[], [{text}], or a legacy {A: "…"} map. */
function normaliseOptions(raw: any): string[] {
  if (!raw) return [];
  const toText = (v: any) => (v && typeof v === 'object' ? String(v.text ?? '') : String(v ?? ''));
  if (Array.isArray(raw)) return raw.map(toText);
  if (typeof raw === 'object') {
    if (Array.isArray(raw.options)) return raw.options.map(toText);
    return Object.keys(raw)
      .filter(k => k !== 'pairs')
      .sort()
      .map(k => toText(raw[k]));
  }
  return [];
}

/** Index of the correct option, or -1. Handles index, letter and full-text keys. */
function correctIndex(q: PrintQuestion, options: string[]): number {
  const answer = q.correct_answer ?? q.correctAnswer;
  if (answer == null || answer === '') return -1;
  if (typeof answer === 'number') return answer;
  const s = String(answer).trim();
  if (/^[A-H]$/i.test(s)) return s.toUpperCase().charCodeAt(0) - 65;
  const byText = options.findIndex(o => o.trim().toLowerCase() === s.toLowerCase());
  return byText;
}

function firstTranslation(q: PrintQuestion) {
  const entries = Object.entries(q.translations ?? {});
  return entries.length > 0 ? entries[0][1] : null;
}

function renderQuestion(q: PrintQuestion, index: number, withAnswers: boolean): string {
  const rawText = q.text ?? q.question_text ?? '';
  const options = normaliseOptions(q.options);
  const text = stripInlineOptions(rawText, options);
  const tr = firstTranslation(q);
  const trText = tr?.text ? stripInlineOptions(tr.text, tr.options) : null;
  const trOptions = Array.isArray(tr?.options) ? tr!.options! : [];
  const answerIdx = withAnswers ? correctIndex(q, options) : -1;
  const marks = q.points ?? q.marks;

  const optionRows = options
    .map((opt, i) => {
      const label = OPTION_LETTERS[i] ?? String(i + 1);
      const translated = trOptions[i] && trOptions[i].trim() !== opt.trim() ? trOptions[i] : null;
      const isAnswer = withAnswers && i === answerIdx;
      return `
        <li class="opt${isAnswer ? ' opt-correct' : ''}">
          <span class="opt-label">${label}</span>
          <span class="opt-body">
            <span>${esc(opt)}</span>
            ${translated ? `<span class="ta">${esc(translated)}</span>` : ''}
          </span>
          ${isAnswer ? '<span class="tick">&#10003;</span>' : ''}
        </li>`;
    })
    .join('');

  const pairRows = (q.pairs ?? [])
    .map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.left)}</td><td>${esc(p.right)}</td></tr>`)
    .join('');

  const explanation = withAnswers ? (q.explanation ?? '') : '';
  const trExplanation = withAnswers ? (tr?.explanation ?? '') : '';
  const answerText = answerIdx >= 0 ? `${OPTION_LETTERS[answerIdx] ?? ''}. ${options[answerIdx] ?? ''}` : null;

  return `
    <article class="q">
      <header class="q-head">
        <span class="q-num">${index + 1}</span>
        <div class="q-text">
          <p>${esc(text)}</p>
          ${trText ? `<p class="ta">${esc(trText)}</p>` : ''}
          <p class="tags">
            ${marks != null ? `<span>${marks} mark${marks === 1 ? '' : 's'}</span>` : ''}
            ${q.subject ? `<span>${esc(q.subject)}</span>` : ''}
            ${q.difficulty ? `<span>${esc(q.difficulty)}</span>` : ''}
          </p>
        </div>
      </header>
      ${options.length ? `<ol class="opts">${optionRows}</ol>` : ''}
      ${pairRows ? `<table class="pairs"><thead><tr><th>#</th><th>Term</th><th>Match</th></tr></thead><tbody>${pairRows}</tbody></table>` : ''}
      ${
        withAnswers && (answerText || explanation || trExplanation)
          ? `<div class="answer">
               ${answerText ? `<p class="ans-line"><strong>Answer:</strong> ${esc(answerText)}</p>` : ''}
               ${explanation ? `<p class="exp"><strong>Explanation:</strong> ${esc(explanation)}</p>` : ''}
               ${trExplanation ? `<p class="exp ta">${esc(trExplanation)}</p>` : ''}
             </div>`
          : ''
      }
    </article>`;
}

function buildHtml(
  { title, meta = [], questions, withAnswers }: PrintPaperOptions,
  selfPrint: boolean,
): string {
  const body = questions.map((q, i) => renderQuestion(q, i, withAnswers)).join('');
  const subtitle = withAnswers ? 'Question Paper with Answer Key &amp; Explanations' : 'Question Paper';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)}${withAnswers ? ' — with answers' : ''}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body {
    font-family: "Segoe UI", "Nirmala UI", "Latha", system-ui, -apple-system, sans-serif;
    color: #111827; margin: 0; font-size: 11pt; line-height: 1.45;
  }
  .paper-head { border-bottom: 2px solid #4f46e5; padding-bottom: 8px; margin-bottom: 14px; }
  .paper-head h1 { font-size: 16pt; margin: 0 0 2px; }
  .paper-head .sub { font-size: 9pt; color: #4f46e5; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  .paper-head .meta { font-size: 9pt; color: #6b7280; margin-top: 4px; }
  .paper-head .meta span:not(:last-child)::after { content: "   |   "; white-space: pre; }

  .q { break-inside: avoid; page-break-inside: avoid; margin: 0 0 12px; padding-bottom: 8px; border-bottom: 1px solid #f3f4f6; }
  .q-head { display: flex; gap: 8px; align-items: flex-start; }
  .q-num {
    flex: 0 0 auto; width: 20px; height: 20px; border-radius: 4px; background: #4f46e5; color: #fff;
    font-size: 9pt; font-weight: 700; text-align: center; line-height: 20px;
  }
  .q-text { flex: 1 1 auto; }
  .q-text p { margin: 0 0 3px; }
  .ta { color: #4b5563; }
  .tags { font-size: 8pt; color: #6b7280; }
  .tags span:not(:last-child)::after { content: " · "; }

  .opts { list-style: none; margin: 6px 0 0 28px; padding: 0; }
  .opt { display: flex; gap: 7px; align-items: flex-start; padding: 2px 4px; border-radius: 4px; }
  .opt-label { flex: 0 0 auto; width: 16px; font-weight: 600; color: #6b7280; }
  .opt-body { flex: 1 1 auto; }
  .opt-body .ta { display: block; font-size: 10pt; }
  .opt-correct { background: #ecfdf5; }
  .opt-correct .opt-label { color: #047857; }
  .tick { color: #047857; font-weight: 700; }

  .pairs { margin: 6px 0 0 28px; border-collapse: collapse; font-size: 10pt; }
  .pairs th, .pairs td { border: 1px solid #e5e7eb; padding: 3px 8px; text-align: left; }

  .answer { margin: 6px 0 0 28px; padding: 6px 8px; background: #f9fafb; border-left: 3px solid #10b981; }
  .answer p { margin: 0 0 2px; font-size: 10pt; }
  .exp { color: #374151; }

  @media screen {
    body { max-width: 820px; margin: 0 auto; padding: 24px; }
    .bar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px;
           background: #eef2ff; border: 1px solid #c7d2fe; color: #3730a3;
           padding: 8px 12px; border-radius: 8px; font-size: 10pt; margin-bottom: 16px; }
    .bar button { font: inherit; font-weight: 600; cursor: pointer; border: 0; border-radius: 6px;
                  background: #4f46e5; color: #fff; padding: 6px 14px; }
    .bar button:hover { background: #4338ca; }
  }
  @media print { .bar { display: none !important; } }
</style>
</head>
<body>
  <div class="bar">
    <button type="button" onclick="window.print()">Print / Save as PDF</button>
    <span>Choose <strong>Save as PDF</strong> as the destination. The dialog opens on its own — if it didn't, use this button or Ctrl+P.</span>
  </div>
  <div class="paper-head">
    <p class="sub">${subtitle}</p>
    <h1>${esc(title)}</h1>
    ${meta.length ? `<p class="meta">${meta.map(m => `<span>${esc(m)}</span>`).join('')}</p>` : ''}
  </div>
  ${body}
${
  selfPrint
    ? `<script>
  window.addEventListener('load', function () {
    setTimeout(function () { try { window.print(); } catch (e) {} }, 350);
  });
</script>`
    : ''
}
</body>
</html>`;
}

/**
 * Print the paper via an off-screen iframe.
 *
 * No pop-up is involved, which matters: the questions are fetched first, and any
 * `window.open` after that await is outside the user-gesture stack, so every
 * browser's pop-up blocker kills it silently. The iframe also fires `load` once
 * its document is laid out, so `print()` can never run against an empty page
 * (which is what produced 0-page PDFs).
 */
export function printQuestionPaper(options: PrintPaperOptions): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.setAttribute('title', 'Question paper');
  // Off-screen rather than display:none — a hidden iframe doesn't always lay out.
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '1px',
    height: '1px',
    opacity: '0',
    border: '0',
    pointerEvents: 'none',
  } as CSSStyleDeclaration);

  const remove = () => {
    window.setTimeout(() => iframe.remove(), 1000);
  };

  iframe.onload = () => {
    const win = iframe.contentWindow;
    if (!win) return remove();
    try {
      win.focus();
      // Chrome fires this once the dialog closes (either outcome); Firefox may not,
      // so a timer backstop also cleans up.
      win.onafterprint = remove;
      win.print();
    } catch {
      /* printing refused — nothing to recover, just clean up */
    }
    window.setTimeout(remove, 60_000);
  };

  document.body.appendChild(iframe);
  iframe.srcdoc = buildHtml(options, false);
}

/**
 * Open the paper in a new tab instead of printing it — for reviewing before
 * printing, or saving the HTML. Must be called directly from a click handler,
 * before any `await`, or the pop-up blocker will stop it.
 */
export function openQuestionPaperTab(options: PrintPaperOptions): boolean {
  const url = URL.createObjectURL(
    new Blob([buildHtml(options, true)], { type: 'text/html;charset=utf-8' }),
  );
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    return false;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
