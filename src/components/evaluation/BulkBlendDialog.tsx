import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { BLEND_KIND_LABEL, BLEND_PRESETS, blendKindOf, blendProblem, sameBlend, storedBlend, type BlendKind } from '@/lib/assessment-blend';
import { readTnpscTag, type TagBlend } from '@/lib/tnpscAdminApi';

const KINDS: BlendKind[] = ['mock', 'full-section', 'mixed-unit', 'mixed-topic'];

const BANDS: Array<{ key: keyof TagBlend; label: string; tone: string }> = [
  { key: 'easy', label: 'Simple', tone: 'text-emerald-700 dark:text-emerald-300' },
  { key: 'medium', label: 'Medium', tone: 'text-amber-700 dark:text-amber-300' },
  { key: 'hard', label: 'Complex', tone: 'text-rose-700 dark:text-rose-300' },
];

/** The assessments a bulk change would touch: of this exam, of these kinds, and (if asked) only those with no saved mix. */
export function bulkTargets(
  rows: any[],
  opts: { groupId: string; kinds: BlendKind[]; onlyUnsaved: boolean; blend: TagBlend },
): any[] {
  return rows.filter(r => {
    const kind = blendKindOf(r);
    if (!kind || !opts.kinds.includes(kind)) return false;
    if (readTnpscTag(r).group_id !== opts.groupId) return false;
    const saved = storedBlend(r);
    if (opts.onlyUnsaved && saved) return false;
    // A paper already at this mix has nothing to change.
    return !sameBlend(saved, opts.blend);
  });
}

/**
 * One mix for many papers: every mock, full set and mixed set of an exam — Group 2, say — at once.
 *
 * Each is saved through the same `PATCH …/blend` as the single dialog, one after another, with progress; a paper
 * the server refuses is counted and named, and the rest still go through.
 */
export function BulkBlendDialog({ open, onOpenChange, assessments }: { open: boolean; onOpenChange: (v: boolean) => void; assessments: any[] }) {
  const qc = useQueryClient();
  const groups = TNPSC_GROUPS.filter(g => assessments.some(a => readTnpscTag(a).group_id === g.id && blendKindOf(a)));
  const [groupId, setGroupId] = useState<string>(groups.find(g => g.id === 'group-2')?.id ?? groups[0]?.id ?? 'group-4');
  const [kinds, setKinds] = useState<BlendKind[]>(KINDS);
  const [onlyUnsaved, setOnlyUnsaved] = useState(true);
  const [blend, setBlend] = useState<TagBlend>({ easy: 10, medium: 30, hard: 60 });
  const [running, setRunning] = useState<{ done: number; total: number } | null>(null);

  const problem = blendProblem(blend);
  const targets = useMemo(
    () => bulkTargets(assessments, { groupId, kinds, onlyUnsaved, blend }),
    [assessments, groupId, kinds, onlyUnsaved, blend],
  );
  const countBy = (k: BlendKind) => targets.filter(t => blendKindOf(t) === k).length;

  const set = (key: keyof TagBlend, raw: string) => {
    const n = raw === '' ? 0 : Math.max(0, Math.min(100, Math.round(Number(raw))));
    setBlend(b => ({ ...b, [key]: Number.isFinite(n) ? n : 0 }));
  };

  const run = async () => {
    const list = [...targets];
    setRunning({ done: 0, total: list.length });
    const failed: string[] = [];
    for (let i = 0; i < list.length; i++) {
      try {
        await api.patch(`/api/v1/evaluation/assessments/${list[i].id}/blend`, { difficulty_blend: blend });
      } catch (err: any) {
        // The first refused as "no such endpoint": the server cannot do this at all, so stop rather than fail them all.
        if (i === 0 && (err?.status === 404 || err?.status === 405)) {
          setRunning(null);
          toast.error('Changing the mix is not available on the server yet.');
          return;
        }
        failed.push(list[i].title ?? list[i].id);
      }
      setRunning({ done: i + 1, total: list.length });
    }
    await qc.invalidateQueries({ queryKey: ['eval-assessments'] });
    await qc.invalidateQueries({ queryKey: ['assessment-mix'] });
    setRunning(null);
    const ok = list.length - failed.length;
    if (failed.length === 0) {
      toast.success(`Mix ${blend.easy}/${blend.medium}/${blend.hard} set on ${ok} assessment${ok === 1 ? '' : 's'}.`);
      onOpenChange(false);
    } else {
      toast.warning(`Set on ${ok}; ${failed.length} could not be changed: ${failed.slice(0, 3).join(', ')}${failed.length > 3 ? '…' : ''}`, {
        duration: 12000,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !running && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Set the difficulty mix for many</DialogTitle>
          <DialogDescription>Apply one Simple / Medium / Complex mix to every matching assessment of an exam.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Exam">
            {groups.map(g => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={groupId === g.id}
                onClick={() => setGroupId(g.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  groupId === g.id ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {g.short_name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {KINDS.map(k => (
              <label key={k} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium">
                <Checkbox
                  checked={kinds.includes(k)}
                  onCheckedChange={v => setKinds(ks => (v ? [...ks, k] : ks.filter(x => x !== k)))}
                />
                <span className="flex-1">{BLEND_KIND_LABEL[k]}</span>
                <span className="tabular-nums text-muted-foreground">{countBy(k)}</span>
              </label>
            ))}
          </div>

          <label className="flex items-center gap-2 text-xs">
            <Checkbox checked={onlyUnsaved} onCheckedChange={v => setOnlyUnsaved(!!v)} />
            Only assessments that have no saved mix yet
          </label>

          <div className="flex flex-wrap gap-1.5">
            {[{ label: 'Group 2 · 10/30/60', blend: { easy: 10, medium: 30, hard: 60 } }, ...BLEND_PRESETS].map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => setBlend({ ...p.blend })}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  sameBlend(blend, p.blend) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {p.label.includes('/') ? p.label : `${p.label} ${p.blend.easy}/${p.blend.medium}/${p.blend.hard}`}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {BANDS.map(b => (
              <label key={b.key} className="rounded-xl border p-2.5">
                <span className={cn('block text-xs font-bold', b.tone)}>{b.label}</span>
                <span className="mt-1 flex items-baseline gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={blend[b.key]}
                    onChange={e => set(b.key, e.target.value)}
                    className="w-full bg-transparent text-xl font-extrabold tabular-nums focus:outline-none"
                    aria-label={`${b.label} percent`}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </span>
              </label>
            ))}
          </div>

          {problem ? (
            <p className="text-xs font-medium text-destructive">{problem}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              <b className="text-foreground">{targets.length}</b> assessment{targets.length === 1 ? '' : 's'} will be set to {blend.easy} /{' '}
              {blend.medium} / {blend.hard}. Each one&apos;s questions are drawn again to this mix; attempts already taken keep theirs.
            </p>
          )}

          {running && (
            <div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all" style={{ width: `${(running.done / Math.max(1, running.total)) * 100}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                {running.done} of {running.total}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={!!running} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={run} disabled={!!problem || targets.length === 0 || !!running}>
            {running && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Apply to {targets.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
