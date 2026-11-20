import { useQuery } from '@tanstack/react-query';
import { applyPassMarkSettings, currentPassMarks, type PassMarkTable } from '@/config/pass-marks';
import { getPassMarkSettings } from '@/lib/tnpscApi';
import { getAdminPassMarks } from '@/lib/tnpscAdminApi';

/**
 * The pass marks, from the server.
 *
 * Fetched once and kept: they are a setting, not per-student data. When the server has none (the endpoint is
 * absent, or sends nothing usable) the bundled benchmarks stay in force, so the portal never shows a report
 * without one. A component that shows a benchmark calls this so it draws again once the server's arrive;
 * `passMarkFor` then reads the table in force — the product-wide one, and each exam's own settings over it.
 */
export function usePassMarks(): PassMarkTable {
  const { data } = useQuery({
    queryKey: ['tnpsc-pass-marks'],
    queryFn: async () => {
      const settings = await getPassMarkSettings();
      if (settings) applyPassMarkSettings(settings);
      return settings?.global ?? currentPassMarks();
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
  return data ?? currentPassMarks();
}

/**
 * The pass marks as the admin portal reads them — the admin endpoint, since an admin's token is not an aspirant's. Puts them in
 * force the same way, so a form can show what a paper would be held to. Absent on a server without the endpoint.
 */
export function useAdminPassMarks(): void {
  useQuery({
    queryKey: ['admin-pass-marks', 'in-force'],
    queryFn: async () => {
      const settings = await getAdminPassMarks();
      applyPassMarkSettings(settings);
      return settings;
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
