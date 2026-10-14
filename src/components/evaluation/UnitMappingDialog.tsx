import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { findUnit, unitDisplayName, type TnpscStage } from '@/config/tnpsc';
import { mappingTotals, summariseCollections } from '@/lib/collection-mapping';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: TnpscStage | undefined;
  /** The question bank as the wizard loaded it. */
  questions: any[];
  papers: any[];
}

/**
 * Where each collection's questions went, unit by unit.
 *
 * Built for the question "this collection has 50 questions, why does its unit show none?".
 * A collection that landed in a unit is shown with the unit; one that did not is shown with
 * the Subject and Topic its questions actually carry and a sample, which is what has to
 * change — or be taught to the matcher — for them to be found.
 */
export function UnitMappingDialog({ open, onOpenChange, stage, questions, papers }: Props) {
  const [search, setSearch] = useState('');

  // Only worked out while the dialog is open: it walks the whole bank.
  const rows = useMemo(
    () => (open ? summariseCollections(stage, questions, papers) : []),
    [open, stage, questions, papers],
  );
  const totals = useMemo(() => mappingTotals(rows), [rows]);

  const needle = search.trim().toLowerCase();
  const shown = needle ? rows.filter(r => r.title.toLowerCase().includes(needle)) : rows;

  const unitName = (id: string) => {
    const u = findUnit(stage, id);
    return u ? `${u.label ? `${u.label}. ` : ''}${unitDisplayName(stage, u)}` : id;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Where each collection’s questions went</DialogTitle>
          <DialogDescription>
            {totals.total > 0
              ? `${totals.placed} of ${totals.total} questions in the bank land in a unit. Collections with questions that do not are listed first.`
              : 'The question bank has not loaded yet.'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Find a collection…"
            className="pl-9"
          />
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {shown.map(r => {
            const missing = r.total - r.placed;
            return (
              <div
                key={r.id ?? 'none'}
                className={cn(
                  'rounded-lg border p-3 text-xs',
                  missing === 0
                    ? 'border-emerald-200 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20'
                    : r.placed === 0
                      ? 'border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20'
                      : 'border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20',
                )}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-semibold break-all">{r.title}</p>
                  <p className="tabular-nums text-muted-foreground">
                    <b className="text-foreground">{r.placed}</b> of {r.total} in a unit
                  </p>
                </div>

                <p className="mt-1 text-[11px] text-muted-foreground">
                  Simple {r.difficulty.easy} · Medium {r.difficulty.medium} · Complex {r.difficulty.hard}
                  {r.difficulty.untagged > 0 ? ` · ungraded ${r.difficulty.untagged}` : ''}
                </p>

                {r.byUnit.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {r.byUnit.map(u => (
                      <span key={u.unitId} className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100">
                        {unitName(u.unitId)} · {u.count}
                      </span>
                    ))}
                  </div>
                )}

                {missing > 0 && (
                  <div className="mt-2 space-y-1.5 border-t border-black/5 pt-2 dark:border-white/10">
                    <p className="font-semibold">{missing} not in any unit. Tagged:</p>
                    {r.unplaced.map(t => (
                      <div key={`${t.subject}|${t.chapter}`}>
                        <p>
                          <span className="font-mono">{t.subject || '(no subject)'}</span>
                          <span className="text-muted-foreground"> · Topic </span>
                          <span className="font-mono">{t.chapter || '(none)'}</span>
                          <span className="text-muted-foreground"> · {t.count}</span>
                        </p>
                        {t.sample && <p className="truncate text-[11px] text-muted-foreground">“{t.sample}”</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {shown.length === 0 && totals.total > 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No collection matches “{search}”.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
