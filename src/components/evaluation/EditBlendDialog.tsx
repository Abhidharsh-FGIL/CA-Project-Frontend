import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useUpdateAssessmentBlend } from '@/hooks/use-eval-assessments';
import { useAssessmentMix } from '@/hooks/use-assessment-mix';
import { blendTargets } from '@/lib/difficulty-blend';
import { BLEND_KIND_LABEL, BLEND_PRESETS, actualMix, blendKindOf, blendProblem, sameBlend, startingBlend, storedBlend } from '@/lib/assessment-blend';
import type { TagBlend } from '@/lib/tnpscAdminApi';

const BANDS: Array<{ key: keyof TagBlend; label: string; tone: string; bar: string }> = [
  { key: 'easy', label: 'Simple', tone: 'text-emerald-700 dark:text-emerald-300', bar: 'bg-emerald-500' },
  { key: 'medium', label: 'Medium', tone: 'text-amber-700 dark:text-amber-300', bar: 'bg-amber-500' },
  { key: 'hard', label: 'Complex', tone: 'text-rose-700 dark:text-rose-300', bar: 'bg-rose-500' },
];

/**
 * Change how much of a mixed paper is Simple, Medium and Complex.
 *
 * Opens on the mix the server stored, or failing that the standard 30 / 30 / 40. Shows what the paper holds now
 * when its questions say, and how many questions each band will get at the new mix.
 */
export function EditBlendDialog({
  open,
  onOpenChange,
  assessment,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  assessment: any;
}) {
  const kind = blendKindOf(assessment);
  // The list row rarely carries the questions; the assessment's own detail may, with their difficulties.
  const { data: read, isLoading: detailLoading } = useAssessmentMix(assessment?.id, open);
  const detail = read?.detail;
  const actual = read?.mix ?? actualMix(assessment);
  // Saved mix first, then what the questions add up to, then the standard one.
  const saved = storedBlend(detail) ?? storedBlend(assessment);
  const { blend: start, source } = saved
    ? { blend: saved, source: 'saved' as const }
    : actual
      ? { blend: actual.blend, source: 'questions' as const }
      : startingBlend();
  const [blend, setBlend] = useState<TagBlend>(start);
  const update = useUpdateAssessmentBlend();

  // Each opening, and the detail arriving, start from the best that is known.
  const startKey = `${start.easy}/${start.medium}/${start.hard}`;
  useEffect(() => {
    if (open) setBlend(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, assessment?.id, startKey]);

  const problem = blendProblem(blend);
  const total = Number(assessment?.question_count) || 0;
  const targets = !problem && total > 0 ? blendTargets(total, blend) : null;
  const unchanged = sameBlend(blend, start);

  const set = (key: keyof TagBlend, raw: string) => {
    const n = raw === '' ? 0 : Math.max(0, Math.min(100, Math.round(Number(raw))));
    setBlend(b => ({ ...b, [key]: Number.isFinite(n) ? n : 0 }));
  };

  const save = () => update.mutate({ id: assessment.id, blend }, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Difficulty mix</DialogTitle>
          <DialogDescription>
            {kind ? `${BLEND_KIND_LABEL[kind]} · ` : ''}
            {assessment?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {detailLoading ? (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the paper&apos;s current mix…
            </div>
          ) : actual ? (
            <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Now: {actual.counts.easy} Simple · {actual.counts.medium} Medium · {actual.counts.hard} Complex
              <span className="ml-1">
                ({actual.blend.easy} / {actual.blend.medium} / {actual.blend.hard}%)
              </span>
              {read && read.expected > read.matched && (
                <span className="ml-1">— from {read.matched} of the paper&apos;s {read.expected} questions</span>
              )}
            </div>
          ) : source === 'standard' ? (
            // Said plainly: without this the standard mix reads as if it were the one the paper was made to.
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
              The mix this paper was made with is not saved on the server, so this starts from the standard 30 / 30 / 40.
              Set the mix you want and save.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-1.5">
            {BLEND_PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => setBlend({ ...p.blend })}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                  sameBlend(blend, p.blend) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
                )}
              >
                {p.label} {p.blend.easy}/{p.blend.medium}/{p.blend.hard}
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
                    inputMode="numeric"
                    value={blend[b.key]}
                    onChange={e => set(b.key, e.target.value)}
                    className="w-full bg-transparent text-xl font-extrabold tabular-nums focus:outline-none"
                    aria-label={`${b.label} percent`}
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </span>
                {targets && <span className="mt-0.5 block text-[11px] text-muted-foreground">{targets[b.key]} questions</span>}
              </label>
            ))}
          </div>

          {/* The mix as one bar, so the proportions read at a glance. */}
          <div className="flex h-2 overflow-hidden rounded-full bg-muted">
            {BANDS.map(b => (
              <div key={b.key} className={b.bar} style={{ width: `${Math.min(100, blend[b.key])}%` }} />
            ))}
          </div>

          {problem ? (
            <p className="text-xs font-medium text-destructive">{problem}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              The questions are drawn again to this mix from the same units and collections. Attempts already taken keep the
              questions they were sat on.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!!problem || (unchanged && source !== 'standard') || update.isPending}>
            {update.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Save mix
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
