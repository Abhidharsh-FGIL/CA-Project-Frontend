import { describe, expect, it } from 'vitest';
import { toDailyAverages } from '@/hooks/use-progress-trend';

const at = (day: string, hour: number, percentage: number | null, test_name = 'Paper') => ({
  start_time: `${day}T${String(hour).padStart(2, '0')}:00:00`,
  percentage,
  test_name,
});

describe('toDailyAverages — the average for each date', () => {
  it('is the day’s own average, not a running one', () => {
    const points = toDailyAverages([at('2026-10-09', 9, 25), at('2026-10-14', 9, 2), at('2026-10-15', 9, 4)]);
    expect(points.map(p => p.value)).toEqual([25, 2, 4]);
  });

  it('averages the attempts taken on one day', () => {
    const [p] = toDailyAverages([at('2026-10-09', 9, 20), at('2026-10-09', 14, 40)]);
    expect(p.value).toBe(30);
    expect(p.tests).toBe(2);
    expect(p.name).toBe('2 tests');
  });

  it('names the paper when only one was taken that day', () => {
    const [p] = toDailyAverages([at('2026-10-09', 9, 25, 'General Science · Simple')]);
    expect(p.name).toBe('General Science · Simple');
    expect(p.tests).toBe(1);
  });

  it('puts the days in date order whatever order the attempts arrive in', () => {
    const points = toDailyAverages([at('2026-10-15', 9, 4), at('2026-10-09', 9, 25)]);
    expect(points.map(p => p.date)).toEqual(['2026-10-09', '2026-10-15']);
  });

  it('has no point for a day with no test, and ignores an attempt with no score', () => {
    const points = toDailyAverages([at('2026-10-09', 9, 25), at('2026-10-12', 9, null), at('2026-10-14', 9, 2)]);
    expect(points.map(p => p.date)).toEqual(['2026-10-09', '2026-10-14']);
  });

  it('rounds to one decimal and is empty for no attempts', () => {
    expect(toDailyAverages([at('2026-10-09', 9, 10), at('2026-10-09', 10, 10), at('2026-10-09', 11, 11)])[0].value).toBe(10.3);
    expect(toDailyAverages([])).toEqual([]);
  });
});
