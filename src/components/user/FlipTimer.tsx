import { cn } from '@/lib/utils';

/**
 * The exam countdown as a flip clock: HH : MM : SS as white tiles with dark digits on the header, each digit tipping over as it changes.
 *
 * It shows the real time left (never a made-up one). The digits warm to amber in the last five minutes and
 * go red in the last minute, so running out of time is seen without reading the numbers. Hours are left off
 * for a paper that is under an hour long. The flip animation is the `cta-flip-*` styles in `index.css`, which
 * are still for anyone who has asked their system to reduce motion.
 */
export function FlipTimer({ secondsLeft, totalSeconds }: { secondsLeft: number | null; totalSeconds: number }) {
  if (secondsLeft === null) return null;
  const s = Math.max(0, Math.floor(secondsLeft));
  const two = (n: number) => String(n).padStart(2, '0');
  const showHours = totalSeconds >= 3600 || s >= 3600;
  const parts = [...(showHours ? [two(Math.floor(s / 3600))] : []), two(Math.floor((s % 3600) / 60)), two(s % 60)];

  const urgent = s < 60;
  const warning = s < 300 && !urgent;
  const tile = urgent ? 'bg-red-500 text-white' : warning ? 'bg-amber-400 text-slate-900' : 'bg-white text-slate-900 shadow-sm';
  const colon = urgent ? 'text-red-400' : warning ? 'text-amber-300' : 'text-orange-400';

  return (
    <span
      role="timer"
      aria-label={`${showHours ? `${parts[0]} hours ` : ''}${parts[parts.length - 2]} minutes ${parts[parts.length - 1]} seconds left`}
      className="flex items-center gap-1 rounded-xl bg-white/10 px-2 py-1.5 ring-1 ring-white/15"
    >
      {parts.map((p, idx) => (
        <span key={idx} className="flex items-center gap-1">
          <span className="flex gap-[3px]">
            {p.split('').map((d, k) => (
              <span
                key={k}
                className={cn(
                  'cta-flip-slot relative flex h-6 w-[17px] items-center justify-center overflow-hidden rounded-[5px] font-mono text-[13px] font-bold sm:h-7 sm:w-5 sm:text-[15px]',
                  tile,
                )}
              >
                <span key={d} className="cta-flip-digit">{d}</span>
                <span className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-slate-900/15" />
              </span>
            ))}
          </span>
          {idx < parts.length - 1 && <span className={cn('cta-colon pb-0.5 text-sm font-bold sm:text-base', colon)}>:</span>}
        </span>
      ))}
    </span>
  );
}
