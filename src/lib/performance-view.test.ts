import { describe, expect, it } from 'vitest';
import { ALL_TIME } from '@/components/user/DateRangeFilter';
import { historyHref, performanceHref, readPerformanceView } from './performance-view';

const read = (href: string) => readPerformanceView(new URL(href, 'http://x').searchParams);

describe('performance view in the address', () => {
  it('carries the exam, test type and range through a link and back', () => {
    const view = { group: 'group-4', track: 'mock', range: { key: 'month', from: '2026-09-22', to: null } } as const;
    expect(read(performanceHref(view))).toEqual(view);
  });

  it('carries a custom range with both ends', () => {
    const view = { group: 'group-4', track: 'practice', range: { key: 'custom', from: '2026-10-01', to: '2026-10-15' } } as const;
    expect(read(performanceHref(view))).toEqual(view);
  });

  it('leaves the range out for all time, and reads it back as all time', () => {
    const href = performanceHref({ group: 'group-4', track: 'mock', range: ALL_TIME });
    expect(href).toBe('/user/performance?group=group-4&track=mock');
    expect(read(href).range).toBeUndefined();
    expect(read('/user/performance?range=all').range).toEqual(ALL_TIME);
  });

  it('ignores what it does not know, rather than breaking the page', () => {
    expect(read('/user/performance?group=nope&track=all&range=decade&from=yesterday')).toEqual({});
    expect(read('/user/performance?range=week&from=junk').range).toEqual({ key: 'week', from: null, to: null });
    expect(read('/user/performance')).toEqual({});
  });
});

describe('the history link', () => {
  it('opens Test History on the same exam, test type and range', () => {
    const view = { group: 'group-4', track: 'practice', range: { key: 'week', from: '2026-10-16', to: null } } as const;
    const href = historyHref(view);
    expect(href.startsWith('/user/history?')).toBe(true);
    expect(read(href)).toEqual(view);
  });

  it('carries only the track and exam when the range is all time', () => {
    expect(historyHref({ group: 'group-4', track: 'mock', range: { key: 'all', from: null, to: null } })).toBe(
      '/user/history?group=group-4&track=mock',
    );
  });
});