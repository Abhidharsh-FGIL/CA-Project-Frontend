import { useMemo, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { normalizeLatex } from '@/lib/latex-utils';

/**
 * Superscript / subscript notation that never went through LaTeX.
 *
 * Question papers routinely carry "3 × 10^8 m/s" or "CO_2" as plain text with no $…$
 * around them, so KaTeX never sees them and they render literally as "10^8". This
 * converts the unambiguous cases inside plain-text runs.
 *
 * Deliberately narrow, because this runs over every question, option and explanation
 * in the app: a caret or underscore followed by a number, a parenthesised group, or a
 * single letter *not* followed by another letter. That last guard is what keeps
 * ordinary prose like "21^st" from turning into "21ˢt".
 */
const SCRIPT_RE =
  /([\^_])(?:\(([^()]{1,16})\)|([+\-−]?\d+(?:\.\d+)?)|([A-Za-z](?![A-Za-z])))/g;

function renderScripts(text: string): ReactNode {
  SCRIPT_RE.lastIndex = 0;
  if (!SCRIPT_RE.test(text)) return text;

  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  SCRIPT_RE.lastIndex = 0;

  while ((m = SCRIPT_RE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    // A hyphen in an exponent is a minus sign; render it as one.
    const body = (m[2] ?? m[3] ?? m[4] ?? '').replace(/^-/, '−');
    out.push(
      m[1] === '^'
        ? <sup key={m.index}>{body}</sup>
        : <sub key={m.index}>{body}</sub>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface MathTextProps {
  text: string;
  className?: string;
  as?: 'span' | 'p' | 'div';
}

/**
 * Lightweight component that renders LaTeX math ($...$, $$...$$) via KaTeX
 * while leaving non-math text as-is. Designed for short snippets like
 * question text, options, answers, and explanations.
 */
export function MathText({ text, className, as: Tag = 'span' }: MathTextProps) {
  const fragments = useMemo(() => {
    if (!text) return [];
    const normalized = normalizeLatex(text);

    // Split on display math ($$...$$) and inline math ($...$)
    // We use a single regex that captures both forms.
    // Group 1 = display math content, Group 2 = inline math content
    const parts: Array<{ type: 'text' | 'math'; content: string; display: boolean }> = [];
    // Match $$...$$ for display math, and $...$ for inline math.
    // Skip $<digit> patterns (currency like $15, $60) by requiring the
    // content after the opening $ to NOT start with a digit followed by
    // a non-math character (digit+space, digit+comma, digit+period+space).
    const regex = /\$\$([\s\S]+?)\$\$|(?<!\$)\$(?!\$)(?!\d+(?:[,.\s)]|$))([^\n$]+?)\$(?!\$)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(normalized)) !== null) {
      // Push preceding plain text
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: normalized.slice(lastIndex, match.index), display: false });
      }
      if (match[1] != null) {
        // Display math ($$...$$)
        parts.push({ type: 'math', content: match[1].trim(), display: true });
      } else if (match[2] != null) {
        // Inline math ($...$)
        parts.push({ type: 'math', content: match[2].trim(), display: false });
      }
      lastIndex = match.index + match[0].length;
    }

    // Push remaining plain text
    if (lastIndex < normalized.length) {
      parts.push({ type: 'text', content: normalized.slice(lastIndex), display: false });
    }

    return parts;
  }, [text]);

  // If no math found, render as plain text (zero overhead)
  if (fragments.length === 0) return <Tag className={className}>{renderScripts(text)}</Tag>;
  if (fragments.length === 1 && fragments[0].type === 'text') {
    return <Tag className={className}>{renderScripts(fragments[0].content)}</Tag>;
  }

  return (
    <Tag className={className}>
      {fragments.map((frag, i) => {
        if (frag.type === 'text') {
          return <span key={i}>{renderScripts(frag.content)}</span>;
        }
        try {
          const html = katex.renderToString(frag.content, {
            throwOnError: false,
            displayMode: frag.display,
          });
          return (
            <span
              key={i}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          // Fallback: show raw math expression
          return <code key={i} className="text-xs bg-muted px-1 rounded">{frag.content}</code>;
        }
      })}
    </Tag>
  );
}
