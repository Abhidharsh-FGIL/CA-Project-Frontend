import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { actualMix } from '@/lib/assessment-blend';

/** Ids per request: a couple of hundred in one address is long enough for the server to refuse it. */
const BATCH = 40;

/**
 * What a saved paper's questions add up to — Simple, Medium, Complex — read from the questions themselves.
 *
 * The server does not keep the mix a paper was made to, and a shuffled paper's detail lists its questions only as
 * `question_ids`. So this reads the detail, and where it has no questions inline, fetches the ones it names from the
 * bank (in batches) and counts their difficulties. `matched` says how many of the paper's questions were found, so
 * a partial read can say so.
 */
export function useAssessmentMix(assessmentId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['assessment-mix', assessmentId],
    enabled: enabled && !!assessmentId,
    staleTime: 60_000,
    queryFn: async () => {
      const detail = await api.get<any>(`/api/v1/evaluation/assessments/${assessmentId}`);
      const inline = actualMix(detail);
      if (inline) return { detail, mix: inline, matched: inline.total, expected: inline.total };

      const ids: string[] = Array.isArray(detail?.question_ids) ? detail.question_ids.map(String) : [];
      if (ids.length === 0) return { detail, mix: null, matched: 0, expected: 0 };

      const wanted = new Set(ids);
      const found = new Map<string, any>();
      for (let i = 0; i < ids.length; i += BATCH) {
        const chunk = ids.slice(i, i + BATCH);
        try {
          const rows = (await api.get<any[]>(`/api/v1/evaluation/questions?ids=${chunk.join(',')}`)) ?? [];
          // Only the paper's own questions count, whatever else a server that ignores `ids` sends back.
          for (const q of Array.isArray(rows) ? rows : []) {
            const id = String(q?.id ?? q?.question_id ?? '');
            if (wanted.has(id)) found.set(id, q);
          }
        } catch {
          /* a batch that fails leaves those questions out; the rest still count */
        }
      }
      const mix = actualMix({ questions: [...found.values()] });
      return { detail, mix, matched: mix?.total ?? 0, expected: ids.length };
    },
  });
}
