import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { TnpscTagFields } from './TnpscTagFields';
import {
  EMPTY_TAG,
  readTnpscTag,
  tagAssessment,
  validateTnpscTag,
  type TnpscTagValue,
} from '@/lib/tnpscAdminApi';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The assessment row — used to prefill existing tags and the question count. */
  assessment: any;
}

/** Tag an already-created assessment into the TNPSC hierarchy. */
export function TnpscTagDialog({ open, onOpenChange, assessment }: Props) {
  const qc = useQueryClient();
  const [tag, setTag] = useState<TnpscTagValue>(EMPTY_TAG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setTag(readTnpscTag(assessment));
  }, [open, assessment]);

  const questionCount = assessment?.question_count ?? undefined;
  const { ok } = validateTnpscTag(tag, questionCount);

  const save = async () => {
    setSaving(true);
    try {
      await tagAssessment(assessment.id, tag);
      toast.success('Tagged — this paper will now appear in the aspirant portal.');
      qc.invalidateQueries({ queryKey: ['eval-assessments'] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(
        err?.message?.includes('404')
          ? 'Tagging endpoint not deployed yet (PATCH /evaluation/assessments/{id}/tnpsc).'
          : err?.message || 'Could not save the tags',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4" /> TNPSC placement
          </DialogTitle>
          <DialogDescription className="line-clamp-2">
            Where should “{assessment?.title}” appear in the aspirant portal?
            {questionCount ? ` ${questionCount} questions.` : ''}
          </DialogDescription>
        </DialogHeader>

        <TnpscTagFields value={tag} onChange={setTag} questionCount={questionCount} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!ok || saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save placement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
