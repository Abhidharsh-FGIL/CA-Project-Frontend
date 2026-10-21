import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Keeps what is inside from being copied out: text can't be selected, dragged or copied, and the context menu
 * is off. A report is the portal's own analysis of a paper, so it is for reading on the page — the PDF download
 * is the supported way to take it away.
 */
export function NoCopy({ children, className }: { children: ReactNode; className?: string }) {
  const block = (e: { preventDefault: () => void }) => e.preventDefault();
  return (
    <div
      className={cn('select-none [-webkit-touch-callout:none]', className)}
      onCopy={block}
      onCut={block}
      onContextMenu={block}
      onDragStart={block}
    >
      {children}
    </div>
  );
}
