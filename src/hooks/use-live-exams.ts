import { useQuery } from '@tanstack/react-query';
import { DEFAULT_LIVE_EXAMS } from '@/config/landing-settings';
import { getLiveExams } from '@/lib/landingSettingsApi';

/** The exams the landing page shows as open — the admin's list, else the built-in one. Draws the built-in list until the server answers. */
export function useLiveExams(): string[] {
  const { data } = useQuery({
    queryKey: ['landing-live-exams'],
    queryFn: getLiveExams,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return data ?? DEFAULT_LIVE_EXAMS;
}
