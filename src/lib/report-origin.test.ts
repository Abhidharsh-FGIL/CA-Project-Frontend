import { describe, expect, it } from 'vitest';
import { originOf } from '@/lib/report-origin';

describe('originOf — where a report goes back to', () => {
  it('reads the page a link recorded', () => {
    expect(originOf({ from: '/user/history?range=week' })).toBe('/user/history?range=week');
    expect(originOf({ from: '/user/dashboard' })).toBe('/user/dashboard');
  });

  it('is nothing when no page was recorded — a direct link, or the page after a submit', () => {
    expect(originOf(null)).toBeNull();
    expect(originOf(undefined)).toBeNull();
    expect(originOf({})).toBeNull();
  });

  it('ignores anything that is not an in-app path', () => {
    expect(originOf({ from: 'https://example.com' })).toBeNull();
    expect(originOf({ from: 42 })).toBeNull();
    expect(originOf('/user/history')).toBeNull();
  });
});
