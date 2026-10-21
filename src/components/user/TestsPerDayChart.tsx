import { useMemo } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { displayTitle } from '@/lib/display-title';
import type { ApiAttempt } from '@/lib/userPortalApi';

/**
 * How many tests were taken on each day, as a line. One point per day that had a test; hovering shows the
 * date, and the test's name when only one was taken that day.
 */
export function TestsPerDayChart({ attempts, className = 'h-44 sm:h-56' }: { attempts: ApiAttempt[]; className?: string }) {
  const days = useMemo(() => {
    const byDay = new Map<string, { time: number; label: string; names: string[] }>();
    for (const h of attempts) {
      const d = new Date(h.start_time);
      const key = d.toDateString();
      const e = byDay.get(key) ?? {
        time: +new Date(d.getFullYear(), d.getMonth(), d.getDate()),
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        names: [],
      };
      e.names.push(displayTitle(h.test_name) ?? 'Test attempt');
      byDay.set(key, e);
    }
    return [...byDay.values()]
      .sort((x, y) => x.time - y.time)
      .map(e => ({ label: e.label, count: e.names.length, names: e.names }));
  }, [attempts]);

  return (
    <div className="-ml-1">
      <div className={className}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={days} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} minTickGap={16} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} width={28} />
            <Tooltip
              cursor={{ stroke: '#cbd5e1' }}
              content={({ active, payload }: any) => {
                const p = payload?.[0]?.payload;
                if (!active || !p) return null;
                return (
                  <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg max-w-[16rem]">
                    <p className="font-bold text-gray-900">{p.label}</p>
                    <p className="mt-0.5 text-gray-600">{p.count === 1 ? p.names[0] : `${p.count} tests taken`}</p>
                  </div>
                );
              }}
            />
            <Line type="monotone" dataKey="count" stroke="#2f7fe0" strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">
        {attempts.length} test{attempts.length === 1 ? '' : 's'} taken over {days.length} day{days.length === 1 ? '' : 's'}.
      </p>
    </div>
  );
}
