import { useQuery } from '@tanstack/react-query';
import { syllabusApi, type Syllabus } from '@/lib/taxonomyApi';

/**
 * A stage's official units > categories > sub-categories (`GET /syllabus/{exam}/{stage}`).
 *
 * Null while loading, when no exam is given, or when the list cannot be read — callers then keep to the
 * hand-typed syllabus in `config/tnpsc.ts`, so nothing goes blank if the endpoint is down.
 */
export function useSyllabus(exam: string | null | undefined, stage: string | null | undefined): Syllabus | null {
  const q = useQuery({
    queryKey: ['syllabus', exam, stage],
    queryFn: () => syllabusApi.get(exam!, stage!),
    enabled: !!exam && !!stage,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
  return q.data ?? null;
}
