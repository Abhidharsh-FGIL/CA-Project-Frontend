import { useState } from 'react';
import { cn } from '@/lib/utils';

/** Rating 1 (poor) to 5 (excellent): the emoji and its code in Google's Noto animated set. */
const MOODS: Record<number, { char: string; code: string }> = {
  1: { char: '😡', code: '1f621' },
  2: { char: '🙁', code: '1f641' },
  3: { char: '😐', code: '1f610' },
  4: { char: '😊', code: '1f60a' },
  5: { char: '😍', code: '1f60d' },
};

/**
 * A rating's emoji, drawn as Google's animated Noto emoji so it looks the same on every phone and moves. If the
 * picture cannot load (offline), the device's own emoji is shown instead.
 */
export function Mood({ level, className }: { level: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const m = MOODS[level];
  if (!m) return null;
  if (failed) {
    return (
      <span className={cn('inline-grid place-items-center leading-none', className)} aria-hidden>
        {m.char}
      </span>
    );
  }
  return (
    <img
      src={`https://fonts.gstatic.com/s/e/notoemoji/latest/${m.code}/512.gif`}
      alt=""
      aria-hidden
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('select-none', className)}
    />
  );
}
