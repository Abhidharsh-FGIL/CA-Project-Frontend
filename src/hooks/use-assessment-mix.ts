import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { actualMix } from '@/lib/assessment-blend';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

/** Ids per request: a couple of hundred in one address is long enough for the server to refuse it. */
const BATCH = 40;
/** Requests in flight at once: a pool of thousands of ids reads in seconds, not minutes, without flooding the server. */
const PARALLEL = 4;

/**
 * What a saved paper's questions add up to — Simple, Medium, Complex — read from the questions themselves.
 *
 * The server does not keep the mix a paper was made to, and a shuffled paper's detail lists its questions only as
 * `question_ids`. So this reads the detail, and where it has no questions inline, fetches the ones it names from the
 * bank (in batches) and counts their difficulties. `matched` says how many of the paper's questions were found, so
 * a partial read can say so.
 *
 * The bank endpoint needs the organisation (`org_id`); without it every request is refused (422). The first batch
 * that fails stops the read — the rest would fail the same way — and a batch is skipped once all its ids are found
 * (a server that ignores `ids` sends the whole bank in the first answer, which finds them all at once).
 */
export function useAssessmentMix(assessmentId: string | undefined, enabled: boolean) {
  const { orgId } = useWorkspaceContext();
  return useQuery({
    queryKey: ['assessment-mix', assessmentId, orgId],
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
      const batches: string[][] = [];
      for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));

      let next = 0;
      let failed = false;
      const worker = async () => {
        while (!failed && next < batches.length) {
          const chunk = batches[next++].filter(id => !found.has(id));
          if (chunk.length === 0) continue;
          const params = new URLSearchParams({ ids: chunk.join(',') });
          if (orgId) params.set('org_id', orgId);
          try {
            const rows = (await api.get<any[]>(`/api/v1/evaluation/questions?${params}`)) ?? [];
            // Only the paper's own questions count, whatever else a server that ignores `ids` sends back.
            for (const q of Array.isArray(rows) ? rows : []) {
              const id = String(q?.id ?? q?.question_id ?? '');
              if (wanted.has(id)) found.set(id, q);
            }
          } catch {
            // The rest would be refused the same way; count what was found.
            failed = true;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, batches.length) }, worker));

      const mix = actualMix({ questions: [...found.values()] });
      return { detail, mix, matched: mix?.total ?? 0, expected: ids.length };
    },
  });
}
