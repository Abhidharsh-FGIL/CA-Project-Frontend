import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  afterSignIn,
  announceable,
  clearReturnTo,
  clockOffset,
  countdownParts,
  fromLocalInput,
  isEditable,
  isPromotional,
  istDay,
  promotionalPhase,
  returnTo,
  scheduleProblem,
  setReturnTo,
  switchedOff,
  toLeaderboard,
  withoutPromotional,
} from './promotionalApi';

const T = (s: string) => Date.parse(s);
const promo = { starts_at: '2026-11-10T12:00:00Z', ends_at: '2026-11-10T14:00:00Z' };

describe('promotionalPhase — when the test is open', () => {
  it('upcoming before the start, live inside the window, ended from the close', () => {
    expect(promotionalPhase(promo, T('2026-11-10T11:59:59Z'))).toBe('upcoming');
    expect(promotionalPhase(promo, T('2026-11-10T12:00:00Z'))).toBe('live');
    expect(promotionalPhase(promo, T('2026-11-10T13:59:59Z'))).toBe('live');
    expect(promotionalPhase(promo, T('2026-11-10T14:00:00Z'))).toBe('ended');
  });

  it('can be edited only before it opens', () => {
    expect(isEditable(promo, T('2026-11-10T11:00:00Z'))).toBe(true);
    expect(isEditable(promo, T('2026-11-10T12:00:00Z'))).toBe(false);
  });
});

describe('the admin switch', () => {
  it('closes the test to students whatever the times say, and is on when missing', () => {
    expect(switchedOff({ is_active: false })).toBe(true);
    expect(switchedOff({})).toBe(false);
    expect(promotionalPhase({ ...promo, is_active: false }, T('2026-11-10T13:00:00Z'))).toBe('ended');
    expect(promotionalPhase({ ...promo, is_active: true }, T('2026-11-10T13:00:00Z'))).toBe('live');
  });
  it('can still be edited before the start even while switched off', () => {
    expect(isEditable({ ...promo, is_active: false } as typeof promo, T('2026-11-10T11:00:00Z'))).toBe(true);
  });
});

describe('scheduleProblem', () => {
  const now = T('2026-11-01T00:00:00Z');
  it('accepts a start in the future and an end after it', () => {
    expect(scheduleProblem('2026-11-10T12:00:00Z', '2026-11-10T14:00:00Z', now)).toBeNull();
  });
  it('refuses a missing time, a start in the past, and an end before the start', () => {
    expect(scheduleProblem('', '2026-11-10T14:00:00Z', now)).toMatch(/opens/);
    expect(scheduleProblem('2026-11-10T12:00:00Z', '', now)).toMatch(/closes/);
    expect(scheduleProblem('2026-10-31T12:00:00Z', '2026-11-10T14:00:00Z', now)).toMatch(/passed/);
    expect(scheduleProblem('2026-11-10T14:00:00Z', '2026-11-10T12:00:00Z', now)).toMatch(/after/);
  });
});

describe('clockOffset — the server’s clock, not the device’s', () => {
  const now = T('2026-11-10T12:00:00Z');
  it('ignores a small difference, and corrects a large one', () => {
    expect(clockOffset('2026-11-10T12:00:02Z', now)).toBe(0);
    expect(clockOffset('2026-11-10T12:10:00Z', now)).toBe(10 * 60 * 1000);
    expect(clockOffset(null, now)).toBe(0);
  });
});

describe('countdownParts', () => {
  it('splits a span, and never goes negative', () => {
    expect(countdownParts((2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
    expect(countdownParts(-5000)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  });
});

describe('datetime-local round trip', () => {
  it('reads back what it wrote', () => {
    const iso = fromLocalInput('2026-11-10T18:30');
    expect(Date.parse(iso)).toBe(new Date('2026-11-10T18:30').getTime());
  });
  it('is empty for nothing', () => {
    expect(fromLocalInput('')).toBe('');
  });
});

describe('isPromotional / withoutPromotional — never listed among the exams', () => {
  it('reads the server’s flag', () => {
    expect(isPromotional({ is_promotional: true })).toBe(true);
    expect(isPromotional({ is_promotional: false })).toBe(false);
    expect(isPromotional(null)).toBe(false);
  });
  it('drops promotional rows from a list', () => {
    expect(withoutPromotional([{ id: 'a' }, { id: 'b', is_promotional: true }]).map(r => r.id)).toEqual(['a']);
  });
});

describe('return path after sign-in', () => {
  beforeEach(() => {
    // The tests run in Node, which has no localStorage.
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it('goes to the test after sign-in, and to the usual place when none is pending', () => {
    expect(afterSignIn('/user/dashboard')).toBe('/user/dashboard');
    setReturnTo('/user/promotional/p1');
    expect(afterSignIn('/user/dashboard')).toBe('/user/promotional/p1');
    expect(afterSignIn('/user/exams')).toBe('/user/promotional/p1');
  });

  it('is kept until the test page clears it', () => {
    setReturnTo('/user/promotional/p1');
    expect(returnTo()).toBe('/user/promotional/p1');
    clearReturnTo();
    expect(returnTo()).toBeNull();
  });

  it('only ever leads inside the student portal', () => {
    setReturnTo('https://evil.example/');
    expect(returnTo()).toBeNull();
  });
});

describe('the daily popup', () => {
  it('counts the day in India time', () => {
    expect(istDay(T('2026-11-10T18:29:00Z'))).toBe('2026-11-10');
    expect(istDay(T('2026-11-10T18:31:00Z'))).toBe('2026-11-11');
  });

  it('announces upcoming and live tests not yet taken, soonest first', () => {
    const now = T('2026-11-10T13:00:00Z');
    const list = [
      { id: 'later', title: 'l', starts_at: '2026-11-12T12:00:00Z', ends_at: '2026-11-12T14:00:00Z' },
      { id: 'live', title: 'v', starts_at: '2026-11-10T12:00:00Z', ends_at: '2026-11-10T14:00:00Z' },
      { id: 'done', title: 'd', starts_at: '2026-11-10T12:00:00Z', ends_at: '2026-11-10T14:00:00Z', attempted: true },
      { id: 'over', title: 'o', starts_at: '2026-11-09T12:00:00Z', ends_at: '2026-11-09T14:00:00Z' },
    ];
    expect(announceable(list, now).map(p => p.id)).toEqual(['live', 'later']);
  });
});

describe('toLeaderboard — tolerant of how the server words it', () => {
  const row = { rank: 1, user_id: 'u', name: 'A', score: 5 };
  it('reads top, or another list name, or a bare array', () => {
    expect(toLeaderboard({ top: [row] }, 'x').top).toEqual([row]);
    expect(toLeaderboard({ rows: [row], total_participants: 9 }, 'x')).toMatchObject({ top: [row], total_participants: 9 });
    expect(toLeaderboard([row], 'x').top).toEqual([row]);
  });
  it('never leaves the rows undefined', () => {
    expect(toLeaderboard({}, 'x')).toMatchObject({ top: [], total_participants: 0, published: true, assessment_id: 'x' });
    expect(toLeaderboard(null, 'x').top).toEqual([]);
  });
});
