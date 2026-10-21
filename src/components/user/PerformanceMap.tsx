import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LEVEL_LABEL, UNTAGGED_UNIT, allUnits, toneOf, weakest, type TreeNode } from '@/lib/performance-tree';

const TONE_BAR = {
  weak: 'bg-rose-500',
  mid: 'bg-amber-500',
  strong: 'bg-emerald-500',
  none: 'bg-gray-300 dark:bg-gray-600',
} as const;
const TONE_TEXT = {
  weak: 'text-rose-600 dark:text-rose-400',
  mid: 'text-amber-600 dark:text-amber-400',
  strong: 'text-emerald-600 dark:text-emerald-400',
  none: 'text-gray-400 dark:text-gray-500',
} as const;

const fmt = (v: number | null) => (v == null ? '—' : `${Number.isInteger(v) ? v : v.toFixed(1)}%`);

function Trend({ delta }: { delta: number | null }) {
  if (delta == null) return null;
  if (Math.abs(delta) < 3) {
    return (
      <span className="hidden sm:inline-flex items-center gap-0.5 text-[11px] font-semibold text-gray-400" title="Holding steady">
        <Minus className="w-3 h-3" /> steady
      </span>
    );
  }
  const up = delta > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'hidden sm:inline-flex items-center gap-0.5 text-[11px] font-semibold',
        up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
      )}
      title="Latest attempts against earlier ones"
    >
      <Icon className="w-3 h-3" />
      {up ? '+' : ''}
      {Math.round(delta)} pts
    </span>
  );
}

/** What the next level down is called, for "3 units inside". */
const CHILD_NOUN = {
  subject: ['unit', 'units'],
  unit: ['category', 'categories'],
  category: ['sub-category', 'sub-categories'],
  subcategory: ['', ''],
} as const;

/**
 * One row of the tree and, when open, the rows beneath it — each level indented under its parent, so the
 * paper → unit → category → sub-category chain reads straight down the page.
 */
function TreeRow({ node, depth, defaultOpen }: { node: TreeNode; depth: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const tone = toneOf(node.accuracy);
  const canOpen = node.children.length > 0;
  const noun = CHILD_NOUN[node.level][node.children.length === 1 ? 0 : 1];
  const untagged = node.name === UNTAGGED_UNIT;

  return (
    <li>
      <button
        type="button"
        onClick={() => canOpen && setOpen(o => !o)}
        aria-expanded={canOpen ? open : undefined}
        disabled={!canOpen}
        className={cn(
          'w-full text-left rounded-xl py-2.5 pr-3 transition-colors',
          canOpen ? 'hover:bg-gray-50 dark:hover:bg-gray-800/60' : 'cursor-default',
        )}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <div className="flex items-center gap-2">
          <ChevronRight
            className={cn(
              'w-4 h-4 shrink-0 text-gray-400 transition-transform',
              open && 'rotate-90',
              !canOpen && 'opacity-0',
            )}
          />
          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              depth === 0
                ? 'text-sm font-bold text-gray-900 dark:text-gray-100'
                : 'text-[13px] font-semibold text-gray-800 dark:text-gray-200',
              untagged && 'italic font-medium text-gray-500 dark:text-gray-400',
            )}
          >
            {node.name}
          </span>
          <span className="hidden md:inline text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            {LEVEL_LABEL[node.level]}
          </span>
          <Trend delta={node.trend} />
          <span className={cn('w-12 text-right text-[13px] font-bold tabular-nums', TONE_TEXT[tone])}>
            {fmt(node.accuracy)}
          </span>
        </div>
        <div className="mt-1.5 ml-6 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
          <div className={cn('h-full rounded-full', TONE_BAR[tone])} style={{ width: `${node.accuracy ?? 0}%` }} />
        </div>
        <p className="mt-1 ml-6 text-[11px] text-gray-500 dark:text-gray-400">
          {node.attempted === 0 ? 'Not attempted yet' : `${node.attempted} of ${node.total} answered`}
          {canOpen && ` · ${node.children.length} ${noun}`}
        </p>
      </button>
      {open && canOpen && (
        <ul className="border-l border-gray-100 dark:border-gray-800" style={{ marginLeft: `${20 + depth * 20}px` }}>
          {node.children.map(c => (
            <TreeRow key={c.id} node={c} depth={0} />
          ))}
        </ul>
      )}
    </li>
  );
}

/**
 * Paper → Unit → Category → Sub-category as one tree. Open a paper to see its units, a unit to see its categories,
 * a category to see its sub-categories. Colour is accuracy.
 */
export function PerformanceMap({
  tree,
  isLoading,
  attemptCount,
  truncated,
  className,
}: {
  tree: TreeNode[];
  isLoading: boolean;
  attemptCount: number;
  truncated: boolean;
  className?: string;
}) {
  const totals = useMemo(() => {
    const total = tree.reduce((n, x) => n + x.total, 0);
    const attempted = tree.reduce((n, x) => n + x.attempted, 0);
    const correct = tree.reduce((n, x) => n + x.correct, 0);
    return { total, attempted, accuracy: attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : null };
  }, [tree]);

  const units = useMemo(() => allUnits(tree), [tree]);
  const needsWork = useMemo(() => weakest(units, 5, 3), [units]);

  return (
    <div className={cn('rounded-2xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4', className)}>
      <div className="flex items-start gap-3 flex-wrap">
        <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300">
          <Network className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Performance map</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
            Open a paper to see its units, a unit for its categories, a category for its sub-categories.
            {truncated ? ` Based on the ${attemptCount} most recent attempts.` : ''}
          </p>
        </div>
      </div>

      {isLoading && tree.length === 0 ? (
        <div className="mt-4 h-40 rounded-xl bg-gray-50 dark:bg-gray-800/50 animate-pulse" />
      ) : tree.length === 0 ? (
        <p className="mt-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 px-4 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
          Your map appears here once you complete a test.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Accuracy</p>
              <p className={cn('text-lg font-bold tabular-nums', TONE_TEXT[toneOf(totals.accuracy)])}>
                {fmt(totals.accuracy)}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Answered</p>
              <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">
                {totals.attempted}
                <span className="text-xs font-semibold text-gray-400"> / {totals.total}</span>
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">Units</p>
              <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-gray-100">{units.length}</p>
            </div>
          </div>

          {needsWork.length > 0 && (
            <div className="mt-4 rounded-xl border border-rose-100 bg-rose-50/60 px-3 py-2.5 dark:border-rose-900/50 dark:bg-rose-950/20">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Weakest units — start here
              </p>
              <ul className="mt-1.5 space-y-1">
                {needsWork.map(n => (
                  <li key={n.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-gray-800 dark:text-gray-200">{n.name}</span>
                    <span className="shrink-0 font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {fmt(n.accuracy)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
            {tree.map((p, i) => (
              <TreeRow key={p.id} node={p} depth={0} defaultOpen={i === 0 && tree.length === 1} />
            ))}
          </ul>

          <p className="mt-3 flex items-center gap-3 flex-wrap text-[11px] text-gray-500 dark:text-gray-400">
            {(['weak', 'mid', 'strong'] as const).map(t => (
              <span key={t} className="inline-flex items-center gap-1.5">
                <span className={cn('h-2 w-2 rounded-full', TONE_BAR[t])} />
                {{ weak: 'Under 40%', mid: '40–70%', strong: '70% and over' }[t]}
              </span>
            ))}
          </p>
        </>
      )}
    </div>
  );
}
