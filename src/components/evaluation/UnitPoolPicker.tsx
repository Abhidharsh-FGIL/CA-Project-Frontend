import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronsUpDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { unitDisplayName, type TnpscStage, type TnpscSyllabusUnit } from '@/config/tnpsc';
import { subjectSpread, type UnitBankCounts } from '@/lib/unit-pool';

interface Props {
  stage: TnpscStage | undefined;
  units: Array<{ unit: TnpscSyllabusUnit; sectionName: string }>;
  selectedIds: string[];
  onToggle: (unitId: string) => void;
  /** Replace the whole selection — used by a section's "all" / "none". */
  onSet: (unitIds: string[]) => void;
  /** Questions the bank holds per unit; null until the bank has loaded. */
  counts: UnitBankCounts | null;
  /** Opens the per-collection view of where questions landed. */
  onShowMapping?: () => void;
}

/**
 * The published units of the stage, grouped by the section that prints them.
 *
 * Each row carries two numbers on purpose: what the real paper asks of the unit
 * ("25 in paper") and what the bank can actually supply ("31 in bank"). Picking a
 * unit the bank has nothing for yields an empty pool, and the admin should see that
 * before choosing it rather than after.
 */
export function UnitPoolPicker({ stage, units, selectedIds, onToggle, onSet, counts, onShowMapping }: Props) {
  const sections = useMemo(() => {
    const out: Array<{ name: string; items: Props['units'] }> = [];
    for (const row of units) {
      const last = out[out.length - 1];
      if (last && last.name === row.sectionName) last.items.push(row);
      else out.push({ name: row.sectionName, items: [row] });
    }
    return out;
  }, [units]);

  const selected = new Set(selectedIds);
  const nameOf = (u: TnpscSyllabusUnit) => `${u.label ? `${u.label}. ` : ''}${unitDisplayName(stage, u)}`;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full h-10 justify-between font-normal">
            {selectedIds.length > 0 ? `${selectedIds.length} selected` : 'Select units…'}
            <ChevronsUpDown className="h-4 w-4 ml-2 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-2 max-h-80 overflow-y-auto" align="start">
          {sections.map(sec => {
            const ids = sec.items.map(x => x.unit.id);
            const all = ids.every(id => selected.has(id));
            return (
              <div key={sec.name} className="mb-1">
                <div className="flex items-center justify-between px-2 pt-1.5 pb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{sec.name}</p>
                  <button
                    type="button"
                    className="text-[11px] text-blue-600 hover:underline dark:text-blue-400"
                    onClick={() =>
                      onSet(
                        all
                          ? selectedIds.filter(id => !ids.includes(id))
                          : [...selectedIds, ...ids.filter(id => !selected.has(id))],
                      )
                    }
                  >
                    {all ? 'none' : 'all'}
                  </button>
                </div>

                {sec.items.map(({ unit }) => {
                  const inBank = counts?.byUnit[unit.id];
                  return (
                    <label
                      key={unit.id}
                      className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded cursor-pointer text-sm"
                    >
                      <Checkbox checked={selected.has(unit.id)} onCheckedChange={() => onToggle(unit.id)} />
                      <span className="flex-1 min-w-0 truncate">{nameOf(unit)}</span>
                      <span className="shrink-0 text-[10px] tabular-nums text-slate-400">
                        {unit.questions != null ? `${unit.questions} in paper` : ''}
                      </span>
                      {inBank != null && (
                        <span
                          className={cn(
                            'shrink-0 text-[10px] tabular-nums',
                            inBank === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500',
                          )}
                        >
                          {inBank === 0 ? 'none in bank' : `${inBank} in bank`}
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            );
          })}

          {counts && counts.viaCollection.total > 0 && (
            <p className="mt-1 border-t border-slate-100 px-2 pt-2 pb-1 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800">
              {counts.viaCollection.total} question{counts.viaCollection.total === 1 ? ' is' : 's are'} placed by the
              name of their collection — their own tags do not say which unit they are —{' '}
              {counts.viaCollection.titles.slice(0, 3).map(t => `“${t.title}” (${t.count})`).join(', ')}
              {counts.viaCollection.titles.length > 3 ? ' and more' : ''}.
            </p>
          )}

          {counts && counts.unclearCollections.length > 0 && (
            <p className="mt-1 border-t border-slate-100 px-2 pt-2 pb-1 text-[11px] leading-relaxed text-amber-700 dark:border-slate-800 dark:text-amber-400">
              {counts.unclearCollections.slice(0, 3).map(t => `“${t.title}” (${t.count})`).join(', ')}
              {counts.unclearCollections.length > 3 ? ' and more' : ''} read{counts.unclearCollections.length === 1 ? 's' : ''} like
              a unit but do{counts.unclearCollections.length === 1 ? 'es' : ''} not say which paper — Tamil, English, GS or
              Aptitude — so their questions are in no unit. Name it e.g. “Unit_4_Tamil_…”.
            </p>
          )}

          {onShowMapping && (
            <button
              type="button"
              onClick={onShowMapping}
              className="mt-1 w-full border-t border-slate-100 px-2 pt-2 pb-1 text-left text-[11px] font-medium text-blue-600 hover:underline dark:border-slate-800 dark:text-blue-400"
            >
              A collection’s questions not showing up? See where each one went →
            </button>
          )}

          {counts && counts.unmapped > 0 && (
            <p className="mt-1 border-t border-slate-100 px-2 pt-2 pb-1 text-[11px] leading-relaxed text-slate-500 dark:border-slate-800">
              {counts.unmapped} bank question{counts.unmapped === 1 ? '' : 's'} sit in this exam’s subjects but in no
              unit — usually tagged Current Events, or with a Topic that is not a unit’s printed name — so they
              cannot be reached from here.
            </p>
          )}
        </PopoverContent>
      </Popover>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {units
            .filter(x => selected.has(x.unit.id))
            .map(({ unit }) => (
              <Badge key={unit.id} variant="secondary" className="text-xs">
                {nameOf(unit)}
              </Badge>
            ))}
        </div>
      )}
    </>
  );
}

interface DiagnosisProps {
  loading: boolean;
  /** The request's own error text, when it failed. */
  error: string | null;
  onRetry: () => void;
  /** Every question the bank returned, before any unit is applied. */
  bank: Array<{ subject?: string | null }>;
  /** The source-type filter in force, so an empty result can name it. */
  sourceType: string;
}

/**
 * Why the chosen units gave no questions.
 *
 * "The bank has no questions in the selected units" was said for four different
 * situations — still loading, the request failed, the bank is empty under this source
 * filter, and the bank is full of questions whose names match no unit — and an admin
 * cannot tell which, or what to do. Each is named, and the last one shows the subject
 * names the bank actually holds so the mismatch is visible at a glance.
 */
export function UnitPoolDiagnosis({ loading, error, onRetry, bank, sourceType }: DiagnosisProps) {
  const box = 'mb-2 rounded-lg border p-3 text-xs leading-relaxed';

  if (loading) {
    return (
      <div className={cn(box, 'flex items-center gap-2 border-slate-200 text-slate-600 dark:border-slate-800 dark:text-slate-300')}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the question bank…
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn(box, 'border-rose-200 bg-rose-50/70 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-200')}>
        <p className="font-semibold">The question bank could not be loaded.</p>
        <p className="mt-1 opacity-90">{error}</p>
        <Button type="button" size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }

  if (bank.length === 0) {
    return (
      <div className={cn(box, 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200')}>
        <p className="font-semibold">
          The question bank returned no questions{sourceType && sourceType !== 'all' ? ` for source “${sourceType}”` : ''}.
        </p>
        <p className="mt-1 opacity-90">
          {sourceType && sourceType !== 'all'
            ? 'Questions imported from a file or sheet are not “online”. Try Question Source Type: All.'
            : 'Import or generate a paper first — the bank is empty.'}
        </p>
      </div>
    );
  }

  const spread = subjectSpread(bank, 8);
  return (
    <div className={cn(box, 'border-amber-200 bg-amber-50/70 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200')}>
      <p className="font-semibold">
        The bank has {bank.length} question{bank.length === 1 ? '' : 's'}, but none map to the selected units.
      </p>
      <p className="mt-1 opacity-90">
        A unit is matched by the question’s <b>Subject</b>; for Tamil, English and Aptitude units its{' '}
        <b>Topic</b> too. The bank’s subjects are:
      </p>
      <p className="mt-1 font-mono text-[11px] opacity-90">
        {spread.map(([name, n]) => `${name} (${n})`).join(' · ')}
      </p>
      <p className="mt-1 opacity-90">
        If these are not the printed unit names, fix the Subject on the questions, or see
        TNPSC_G4_SHEET_NAMES.md for the wording to use.
      </p>
    </div>
  );
}
