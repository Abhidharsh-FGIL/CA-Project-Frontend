/**
 * Re-derive a collection's difficulty and level from the questions it holds.
 *
 * Works on **collections**, not assessments. A collection is the content; an
 * assessment is one publication of it. Fixing the collection fixes every
 * assessment built from it afterwards, and there is one collection where there
 * might be a dozen assessments — so this is both the smaller job and the one that
 * stays fixed.
 *
 * What drifted: a collection's stored `difficulty` was set when it was imported or
 * generated and never reconciled with the questions that ended up in it, and
 * nothing ever gave a collection a TNPSC level at all. The stored values cannot
 * repair themselves, so this reads the questions. It proposes, shows every change,
 * and writes only what you tick.
 */
import { useMemo, useState } from 'react';
import {
  Check,
  Loader2,
  RefreshCw,
  ScanLine,
  TriangleAlert,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LEVEL_META, type TnpscLevel } from '@/config/tnpsc';
import { setPaperClassification } from '@/lib/tnpscAdminApi';
import {
  changeOf,
  describeMix,
  difficultyMix,
  isNotEditableError,
  isVirtualPaper,
  levelFor,
  mapLimit,
  writeOutcome,
  type ReclassifyRow,
} from '@/lib/reclassify';

/** Papers are scanned a few at a time — see `mapLimit`. */
const SCAN_CONCURRENCY = 4;

export function TnpscReclassifyDialog({
  open,
  onOpenChange,
  papers,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Collections, as `GET /evaluation/papers` returns them. */
  papers: any[];
  onApplied?: () => void;
}) {
  const [rows, setRows] = useState<ReclassifyRow[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  /**
   * Every collection that holds questions and can actually store the result.
   *
   * "Custom Questions" is assembled by the API on the fly and has no row behind
   * it, so it is left out rather than offered as a change that would be refused
   * on every scan. Empty collections have nothing to read.
   */
  const candidates = useMemo(
    () => (papers ?? []).filter(p => (p?.question_count ?? 0) > 0 && !isVirtualPaper(p)),
    [papers],
  );

  /** Counted so the screen can account for it, rather than silently dropping it. */
  const virtualSkipped = useMemo(
    () => (papers ?? []).filter(p => isVirtualPaper(p) && (p?.question_count ?? 0) > 0).length,
    [papers],
  );

  const scan = async () => {
    setScanning(true);
    setProgress({ done: 0, total: candidates.length });

    const scanned = await mapLimit(
      candidates,
      SCAN_CONCURRENCY,
      async (paper): Promise<ReclassifyRow> => {
        const base = {
          id: paper.id,
          title: paper.title ?? paper.id,
          currentDifficulty: paper.difficulty ?? null,
          currentLevel: (paper.tnpsc_level ?? null) as TnpscLevel | null,
        };
        try {
          const questions = await api.get<any[]>(
            `/api/v1/evaluation/papers/${paper.id}/questions`,
          );
          const mix = difficultyMix(questions ?? []);
          const proposedDifficulty = mix.verdict;
          const proposedLevel = levelFor(mix);
          return {
            ...base,
            mix,
            proposedDifficulty,
            proposedLevel,
            change: changeOf({ ...base, proposedDifficulty, proposedLevel }),
          };
        } catch (err: any) {
          return {
            ...base,
            mix: null,
            proposedDifficulty: null,
            proposedLevel: null,
            change: null,
            error: err?.message ?? 'Could not read this collection’s questions',
          };
        }
      },
      (done, total) => setProgress({ done, total }),
    );

    setRows(scanned);
    // Pre-tick exactly what would change — nothing else is worth a write.
    setPicked(new Set(scanned.filter(r => r.change).map(r => r.id)));
    setScanning(false);
  };

  const changed = useMemo(() => (rows ?? []).filter(r => r.change), [rows]);
  const unchanged = (rows?.length ?? 0) - changed.length;
  const failed = useMemo(() => (rows ?? []).filter(r => r.error), [rows]);

  const apply = async () => {
    const todo = (rows ?? []).filter(r => picked.has(r.id) && r.change);
    if (todo.length === 0) return;
    setApplying(true);

    let written = 0;
    let ignored = 0;
    let unverified = 0;
    let refused = 0;
    let unsupported = false;

    try {
      for (const r of todo) {
        // One call per collection: both fields live on the paper row, so there is
        // nothing to be gained by splitting them and something to lose — a paper
        // left with its new level and its old difficulty.
        try {
          const res = await setPaperClassification(r.id, {
            difficulty: r.proposedDifficulty ?? undefined,
            tnpsc_level: r.proposedLevel ?? undefined,
          });
          // A 200 is not proof: a server that ignores keys it does not know
          // answers 200 and stores nothing. Where the row comes back, check it.
          const checks = [
            r.proposedDifficulty ? writeOutcome(res, 'difficulty', r.proposedDifficulty) : null,
            r.proposedLevel ? writeOutcome(res, 'tnpsc_level', r.proposedLevel) : null,
          ].filter((x): x is NonNullable<typeof x> => x !== null);
          if (checks.includes('ignored')) ignored += 1;
          else {
            written += 1;
            if (checks.includes('unknown')) unverified += 1;
          }
        } catch (err: any) {
          if (isNotEditableError(err)) {
            // A collection that cannot hold these fields — skipped, not failed.
            refused += 1;
          } else if (err?.status === 404 || err?.status === 405 || err?.status === 422) {
            unsupported = true;
          } else {
            throw err;
          }
        }
      }

      if (ignored > 0) {
        toast.error(
          `${ignored} collection${ignored === 1 ? '' : 's'} came back unchanged — the server accepted the request but did not store the difficulty or level. See BACKEND_WORK.md.`,
          { duration: 10000 },
        );
      }
      if (written > 0) {
        toast.success(
          `Sent ${written} collection${written === 1 ? '' : 's'}${unverified > 0 ? ' — the server did not echo the row back, so check the list to confirm' : ''}.`,
        );
      }
      if (refused > 0) {
        toast.info(
          `${refused} collection${refused === 1 ? '' : 's'} cannot store a difficulty and ${refused === 1 ? 'was' : 'were'} skipped.`,
        );
      }
      if (unsupported) {
        toast.warning(
          'This backend does not accept difficulty / level on a collection yet — see TNPSC_RECLASSIFY.md §3.',
        );
      }

      onApplied?.();
      if (written > 0) onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not apply the changes');
    } finally {
      setApplying(false);
    }
  };

  const toggle = (id: string) =>
    setPicked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allPicked = changed.length > 0 && changed.every(r => picked.has(r.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Reclassify collections by difficulty</DialogTitle>
          <DialogDescription>
            Reads the questions in each collection and proposes the difficulty and level they
            actually justify. Assessments built from a collection afterwards inherit it.
            Nothing is written until you apply.
          </DialogDescription>
        </DialogHeader>

        {/* ── Scan ─────────────────────────────────────────────────────── */}
        {!rows && (
          <div className="py-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/40 mb-3">
              {scanning ? (
                <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              ) : (
                <ScanLine className="h-6 w-6 text-blue-500" />
              )}
            </span>
            <p className="text-sm font-semibold">
              {scanning
                ? `Reading questions — ${progress.done} of ${progress.total}`
                : `${candidates.length} collection${candidates.length === 1 ? '' : 's'} to check`}
            </p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Each collection is read once for the difficulty its questions declare. Empty
              collections are skipped. Questions that declare no difficulty of their own are
              counted but never decide the result.
            </p>
            {virtualSkipped > 0 && (
              <p className="mx-auto mt-2 max-w-md text-[11px] text-muted-foreground">
                “Custom Questions” is assembled on the fly rather than stored, so it has nowhere
                to keep a difficulty and is not included.
              </p>
            )}
            {!scanning && (
              <Button onClick={scan} disabled={candidates.length === 0} className="mt-4">
                <ScanLine className="mr-2 h-4 w-4" /> Scan {candidates.length} collections
              </Button>
            )}
          </div>
        )}

        {/* ── Review ───────────────────────────────────────────────────── */}
        {rows && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="border-blue-300 text-blue-600">
                {changed.length} to change
              </Badge>
              {unchanged > 0 && (
                <Badge variant="outline" className="text-muted-foreground">
                  {unchanged} already correct
                </Badge>
              )}
              {failed.length > 0 && (
                <Badge variant="outline" className="border-amber-300 text-amber-700">
                  {failed.length} unreadable
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setRows(null); setPicked(new Set()); }}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Rescan
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto rounded-lg border">
              {changed.length === 0 ? (
                <div className="py-12 text-center">
                  <Check className="mx-auto mb-2 h-7 w-7 text-emerald-500" />
                  <p className="text-sm font-semibold">
                    Every scanned collection already matches its questions.
                  </p>
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
                    <tr className="border-b">
                      <th className="w-10 p-2">
                        <Checkbox
                          checked={allPicked}
                          onCheckedChange={() =>
                            setPicked(allPicked ? new Set() : new Set(changed.map(r => r.id)))
                          }
                        />
                      </th>
                      <th className="p-2 font-semibold">Collection</th>
                      <th className="p-2 font-semibold">Questions say</th>
                      <th className="p-2 font-semibold">Difficulty</th>
                      <th className="p-2 font-semibold">Level</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changed.map(r => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                        <td className="p-2 align-top">
                          <Checkbox checked={picked.has(r.id)} onCheckedChange={() => toggle(r.id)} />
                        </td>
                        <td className="p-2 align-top">
                          <p className="font-medium line-clamp-2">{r.title}</p>
                          <p className="text-[10px] text-muted-foreground">{r.mix?.total ?? 0} questions</p>
                        </td>
                        <td className="p-2 align-top text-muted-foreground">
                          {r.mix ? describeMix(r.mix) : '—'}
                        </td>
                        <td className="p-2 align-top">
                          <Delta
                            from={r.currentDifficulty}
                            to={r.proposedDifficulty}
                            same={r.change === 'level'}
                          />
                        </td>
                        <td className="p-2 align-top">
                          <Delta
                            from={r.currentLevel ? LEVEL_META[r.currentLevel].label : null}
                            to={r.proposedLevel ? LEVEL_META[r.proposedLevel].label : null}
                            same={r.change === 'difficulty'}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {failed.length > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
                {failed.length} collection{failed.length === 1 ? '' : 's'} could not be read and{' '}
                {failed.length === 1 ? 'was' : 'were'} left alone.
              </p>
            )}

            <div className="flex items-center justify-end gap-2 border-t pt-3">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={applying}>
                Cancel
              </Button>
              <Button onClick={apply} disabled={applying || picked.size === 0}>
                {applying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying…
                  </>
                ) : (
                  `Apply to ${picked.size} collection${picked.size === 1 ? '' : 's'}`
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** old → new, or a quiet dash where this column is not the one changing. */
function Delta({ from, to, same }: { from: string | null; to: string | null; same: boolean }) {
  if (same || !to) {
    return <span className="text-muted-foreground capitalize">{from ?? '—'}</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="text-muted-foreground line-through capitalize">{from ?? 'unset'}</span>
      <span className="text-muted-foreground">→</span>
      <span className={cn('font-semibold capitalize text-blue-600 dark:text-blue-400')}>{to}</span>
    </span>
  );
}


