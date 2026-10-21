import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { setPaperPlacement } from '@/lib/tnpscAdminApi';
import { storedPlacement } from '@/lib/collection-hierarchy';

export interface AssignArgs {
  paperId: string;
  groupId: string;
  stageId: string;
  unitId: string | null;
  sectionName: string | null;
}

/**
 * Move a collection to a syllabus unit.
 *
 * A 200 only says the request was understood, not that the placement was kept — a server that ignores fields it
 * does not know answers 200 and changes nothing. So after the write the list is read again, and the move is only
 * reported as done when the collection comes back with the unit on it.
 */
export function useAssignCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: AssignArgs) => {
      await setPaperPlacement(a.paperId, {
        groupId: a.groupId,
        stageId: a.stageId,
        unitId: a.unitId,
        sectionName: a.sectionName,
      });
      await qc.refetchQueries({ queryKey: ['eval-papers'] });
      const lists = qc.getQueriesData<any[]>({ queryKey: ['eval-papers'] });
      const row = lists.flatMap(([, data]) => data ?? []).find((p: any) => p?.id === a.paperId);
      const kept = row ? storedPlacement(row) : null;
      return { kept: !!kept && (a.unitId ? kept.unitId === a.unitId : kept.stageId === a.stageId) };
    },
    onSuccess: ({ kept }) => {
      if (kept) toast.success('Collection moved');
      else
        toast.warning(
          'The request went through, but the server did not keep the placement. The backend needs to store a collection’s unit — see the backend note for this change.',
        );
    },
    onError: (err: any) => {
      const s = err?.status;
      toast.error(
        s === 404 || s === 405 || s === 422
          ? 'The server cannot store a collection’s unit yet — the backend change is pending.'
          : err?.message || 'Could not move the collection',
      );
    },
  });
}
