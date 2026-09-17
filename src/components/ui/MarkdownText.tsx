import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { normalizeLatex } from '@/lib/latex-utils';
import { cn } from '@/lib/utils';

interface MarkdownTextProps {
  text: string;
  className?: string;
}

/**
 * Renders Markdown (GFM tables, lists, emphasis) plus LaTeX math ($...$, \(...\))
 * via KaTeX. Use for rich blocks like reading-comprehension / Data-Interpretation
 * passages that may contain tables, multi-paragraph prose, or math — where the
 * lightweight MathText (math-only) is not enough.
 */
export function MarkdownText({ text, className }: MarkdownTextProps) {
  if (!text) return null;
  return (
    <div
      className={cn(
        'text-sm leading-relaxed text-gray-800 [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_table]:w-full [&_table]:my-2 [&_table]:border-collapse [&_table]:text-xs',
        '[&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold [&_th]:text-left',
        '[&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1',
        '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5',
        '[&_strong]:font-semibold',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {normalizeLatex(text)}
      </ReactMarkdown>
    </div>
  );
}
