/**
 * The exam, test type and date range a student is looking at, carried in the address.
 *
 * The dashboard and the Performance page each have these three filters. A link from one to the other used to
 * carry none of them, so "View detailed report" on a Mock-tests view opened Performance on Practice. The link now
 * carries the view, and the page starts on it.
 */
import { GROUP_STAGE, type ExamGroupKey, type ExamTrackKey } from '@/hooks/use-progress-trend';
import { ALL_TIME, type DateRange, type DateRangeKey } from '@/components/user/DateRangeFilter';

export interface PerformanceView {
  group: ExamGroupKey;
  track: ExamTrackKey;
  range: DateRange;
}

const RANGE_KEYS: DateRangeKey[] = ['all', 'week', 'month', 'quarter', 'custom'];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function performanceHref(view: PerformanceView): string {
  const p = new URLSearchParams({ group: view.group, track: view.track });
  if (view.range.key !== 'all') {
    p.set('range', view.range.key);
    if (view.range.from) p.set('from', view.range.from);
    if (view.range.to) p.set('to', view.range.to);
  }
  return `/user/performance?${p.toString()}`;
}

/** Whatever the address names; a value that is missing or not one of the known ones is left out. */
export function readPerformanceView(params: URLSearchParams): Partial<PerformanceView> {
  const out: Partial<PerformanceView> = {};

  const group = params.get('group');
  if (group && group in GROUP_STAGE) out.group = group as ExamGroupKey;

  const track = params.get('track');
  if (track === 'mock' || track === 'practice') out.track = track;

  const key = params.get('range') as DateRangeKey | null;
  if (key && RANGE_KEYS.includes(key)) {
    if (key === 'all') out.range = ALL_TIME;
    else {
      const from = params.get('from');
      const to = params.get('to');
      out.range = { key, from: from && DAY.test(from) ? from : null, to: to && DAY.test(to) ? to : null };
    }
  }
  return out;
}
