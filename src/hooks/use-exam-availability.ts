import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { examAvailabilityApi, portalExamIds } from '@/lib/examAvailabilityApi';
import { OPEN_EXAM_IDS } from '@/lib/exam-listing';
import { examGroupOptions, upcomingExamLabels, type ExamGroupKey, type GroupKey } from '@/hooks/use-progress-trend';
import type { FilterOption } from '@/components/user/FilterSelect';

/** The exams open to this student: the admin's setting, or the built-in list until the server answers. */
export function useOpenExamIds(): ReadonlySet<string> {
  const userId = useUserPortal().user?.user_id;
  const q = useQuery({
    queryKey: ['open-exams', userId],
    queryFn: () => examAvailabilityApi.open(),
    enabled: !!userId,
    staleTime: 60 * 1000,
    retry: false,
  });
  return q.data ? new Set(q.data.open_exam_ids.flatMap(portalExamIds)) : OPEN_EXAM_IDS;
}

/** The exam filter's choices: the exams open to this student, as the Exams page shows them. */
export function useExamGroupOptions(): FilterOption<ExamGroupKey>[] {
  return examGroupOptions(useOpenExamIds());
}

/** The same, with "All groups" first — History's filter. */
export function useGroupOptions(): FilterOption<GroupKey>[] {
  return [{ value: 'all', label: 'All groups' }, ...useExamGroupOptions()];
}

/** One or two exams on the way, for the filter's "Coming soon" note. */
export function useUpcomingExamLabels(): string[] {
  return upcomingExamLabels(useOpenExamIds());
}

export function useAdminExams() {
  return useQuery({ queryKey: ['admin-exams'], queryFn: () => examAvailabilityApi.list(), staleTime: 15 * 1000, retry: false });
}

export function useSetExamOpen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isOpen }: { id: string; isOpen: boolean }) => examAvailabilityApi.set(id, isOpen),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-exams'] });
      qc.invalidateQueries({ queryKey: ['open-exams'] });
    },
  });
}
