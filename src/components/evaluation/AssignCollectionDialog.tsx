import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { placeCollection, placeableGroups, unitChoices } from '@/lib/collection-hierarchy';
import { useAssignCollection } from '@/hooks/use-collection-placement';

/**
 * Move a collection to a syllabus unit: pick the exam, then the unit under its subject. Starts on where the
 * collection already is, if anywhere, so correcting a placement is one change.
 */
export function AssignCollectionDialog({ paper, onClose }: { paper: any | null; onClose: () => void }) {
  const assign = useAssignCollection();
  const groups = useMemo(() => placeableGroups(), []);
  const [groupId, setGroupId] = useState<string>('group-4');
  const [unitId, setUnitId] = useState<string>('');

  useEffect(() => {
    if (!paper) return;
    const here = placeCollection(paper);
    setGroupId(here.groupId ?? 'group-4');
    setUnitId(here.unitId ?? '');
  }, [paper]);

  const choices = useMemo(() => unitChoices(groupId), [groupId]);
  const chosen = choices.find(c => c.units.some(u => u.id === unitId));

  const save = () => {
    if (!paper || !chosen) return;
    assign.mutate(
      { paperId: paper.id, groupId, stageId: chosen.stageId, unitId, sectionName: chosen.section },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={!!paper} onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to a unit</DialogTitle>
          <DialogDescription className="break-all">{paper?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Exam</Label>
            <Select
              value={groupId}
              onValueChange={v => {
                setGroupId(v);
                setUnitId('');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups.map(g => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Subject and unit</Label>
            <Select value={unitId || undefined} onValueChange={setUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose the unit this collection belongs to">
                  {chosen ? (
                    <span className="block truncate text-left">
                      {(() => {
                        const u = chosen.units.find(x => x.id === unitId);
                        return u ? `${u.label ? `${u.label} · ` : ''}${u.name}` : '';
                      })()}
                    </span>
                  ) : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-[60vh]">
                {choices.map(c => (
                  <SelectGroup key={c.section}>
                    <SelectLabel>{c.section}</SelectLabel>
                    {c.units.map(u => (
                      <SelectItem key={u.id} value={u.id}>
                        <span className="inline-block w-7 text-[10px] font-bold text-muted-foreground">{u.label || '—'}</span>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {chosen && (
              <p className="text-[11px] text-muted-foreground">
                Goes under {chosen.section} → {chosen.units.find(u => u.id === unitId)?.name}.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!chosen || assign.isPending}>
            {assign.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
