import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Award, PartyPopper, Trophy } from 'lucide-react';
import { PERFORMANCE_LABEL, type Performance } from '@/config/pass-marks';

const COLORS = ['#f97316', '#10b981', '#3b82f6', '#a855f7', '#f43f5e', '#eab308', '#06b6d4'];

/**
 * Confetti and a "Congratulations" card, shown for a few seconds when a report opens straight after a pass.
 * Nothing in it can be clicked except the card, which dismisses it; the confetti never blocks the page.
 */
export function PassCelebration({ performance, percent, onDone }: { performance: Performance; percent: number; onDone: () => void }) {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const out = setTimeout(() => setLeaving(true), 4200);
    const done = setTimeout(onDone, 4800);
    return () => {
      clearTimeout(out);
      clearTimeout(done);
    };
  }, [onDone]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        key: i,
        left: Math.random() * 100,
        w: 6 + Math.random() * 6,
        h: 10 + Math.random() * 10,
        color: COLORS[i % COLORS.length],
        dx: (Math.random() - 0.5) * 220,
        rot: (Math.random() - 0.5) * 1440,
        dur: 2.6 + Math.random() * 2,
        delay: Math.random() * 0.9,
      })),
    [],
  );

  const Icon = performance === 'excellent' ? Trophy : performance === 'strong' ? Award : PartyPopper;
  const headline = performance === 'excellent' ? 'Outstanding!' : performance === 'strong' ? 'Great work!' : 'Congratulations!';

  return (
    <>
      {pieces.map(p => (
        <span
          key={p.key}
          className="confetti-piece"
          style={
            {
              left: `${p.left}vw`,
              width: p.w,
              height: p.h,
              background: p.color,
              '--dx': `${p.dx}px`,
              '--rot': `${p.rot}deg`,
              '--dur': `${p.dur}s`,
              '--delay': `${p.delay}s`,
            } as CSSProperties
          }
          aria-hidden
        />
      ))}
      <div
        role="status"
        onClick={onDone}
        className={`congrats-card fixed left-1/2 top-1/2 z-[71] w-[min(22rem,88vw)] cursor-pointer rounded-3xl bg-white p-6 text-center shadow-2xl ring-1 ring-orange-100 dark:bg-gray-900 dark:ring-gray-800 ${leaving ? 'is-leaving' : ''}`}
      >
        <span className="congrats-trophy mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-orange-500 text-white shadow-lg">
          <Icon className="h-8 w-8" />
        </span>
        <p className="mt-3 text-2xl font-extrabold text-gray-900 dark:text-gray-100">{headline}</p>
        <p className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          {PERFORMANCE_LABEL[performance]} · {Math.round(percent * 10) / 10}%
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">You cleared the benchmark. Keep it going!</p>
      </div>
    </>
  );
}
