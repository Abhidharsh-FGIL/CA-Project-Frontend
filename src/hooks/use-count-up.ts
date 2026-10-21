import { useEffect, useState } from 'react';

/**
 * A number that climbs from 0 to `target` when it first appears — what a score or a percentage does on
 * a report, so the result lands instead of just being there. Eases out, and is skipped (the final value
 * at once) for anyone who has asked their system to reduce motion.
 */
export function useCountUp(target: number | null | undefined, durationMs = 1200): number {
  const goal = typeof target === 'number' && Number.isFinite(target) ? target : 0;
  const [value, setValue] = useState(0);

  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || goal === 0) {
      setValue(goal);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(goal * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    setValue(0);
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [goal, durationMs]);

  return value;
}
