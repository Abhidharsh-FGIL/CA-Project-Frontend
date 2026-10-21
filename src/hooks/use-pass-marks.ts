import { useQuery } from '@tanstack/react-query';
import { applyPassMarks, currentPassMarks, type PassMarkTable } from '@/config/pass-marks';
import { getPassMarks } from '@/lib/tnpscApi';

/**
 * The pass marks, from the server.
 *
 * Fetched once and kept: they are a setting, not per-student data. When the server has none (the endpoint is
 * absent, or sends nothing usable) the bundled benchmarks stay in force, so the portal never shows a report
 * without one. A component that shows a benchmark calls this so it draws again once the server's arrive;
 * `passMarkFor` then reads the table in force.
 */
export function usePassMarks(): PassMarkTable {
  const { data } = useQuery({
    queryKey: ['tnpsc-pass-marks'],
    queryFn: async () => {
      const table = await getPassMarks();
      if (table) applyPassMarks(table);
      return table ?? currentPassMarks();
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  return data ?? currentPassMarks();
}
