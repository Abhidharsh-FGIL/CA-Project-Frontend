import { useMyPromotional } from '@/hooks/use-my-promotional';
import { onDashboard, promotionalPhase, type PromotionalAssessment } from '@/lib/promotionalApi';
import { useNow } from '@/components/promotional/Countdown';

/**
 * The student's free promotional tests worth showing on the Exams page right now, soonest first: upcoming ones with a
 * countdown, live ones to start, and closed ones they took, to see their result, for six hours after they close — and
 * only while there is nothing newer. Empty when there are none. `now` ticks every second for the countdowns.
 */
export function usePromotionalToShow(): { tests: PromotionalAssessment[]; now: number } {
  const { data } = useMyPromotional();
  const now = useNow(0, 1000);
  const all = (data ?? [])
    .filter(p => onDashboard(p, now))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  // Once there is a test to take (live) or to wait for (upcoming), the closed ones step aside; they show again only
  // when nothing newer is on.
  const current = all.filter(p => promotionalPhase(p, now) !== 'ended');
  return { tests: current.length > 0 ? current : all, now };
}
