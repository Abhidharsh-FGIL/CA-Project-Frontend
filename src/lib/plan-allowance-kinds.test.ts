import { describe, expect, it } from 'vitest';
import { SUBSCRIPTION_PLANS } from '@/data/userPortalSampleData';
import { attemptKind, planAllowance, type AllowanceAttempt } from '@/lib/plan-allowance';

const free = { ...SUBSCRIPTION_PLANS.find(p => p.tier === 'free')!, features: { ...SUBSCRIPTION_PLANS.find(p => p.tier === 'free')!.features, practice_tests_per_month: 5, mock_tests_per_month: 2 } };

const attempt = (over: Partial<AllowanceAttempt>): AllowanceAttempt => ({
  test_mode: 'practice',
  start_time: '2026-10-05T10:00:00Z',
  ...over,
});

describe('attemptKind — which allowance an attempt is spent from', () => {
  it('reads the paper\'s track first', () => {
    expect(attemptKind(attempt({ mode: 'practice', test_mode: 'mock' }))).toBe('practice');
    expect(attemptKind(attempt({ mode: 'mock', test_mode: 'practice' }))).toBe('mock');
  });

  it('falls back to the paper itself, then to the raw flag', () => {
    expect(attemptKind(attempt({ test_mode: 'mock' }), 'practice')).toBe('practice');
    expect(attemptKind(attempt({ test_mode: 'mock' }), null)).toBe('mock');
    expect(attemptKind(attempt({ test_mode: 'practice' }))).toBe('practice');
  });

  it('reads "exam" as a mock, as the server does', () => {
    expect(attemptKind(attempt({ test_mode: 'exam' }))).toBe('mock');
    expect(attemptKind(attempt({ mode: ' Exam ' }))).toBe('mock');
  });

  it('is nothing for an attempt that says nothing useful', () => {
    expect(attemptKind(attempt({ test_mode: null }))).toBeNull();
    expect(attemptKind(attempt({ test_mode: 'assignment', mode: 'sample' }))).toBeNull();
  });
});

describe('practice and Key Topics tests are one allowance', () => {
  // A Key Topics paper is a practice paper (track "practice", saved as a unit paper that names its
  // topic). When it is timed the assessment's own flag is "exam", so the history calls it a mock.
  const papers = [
    { assessment_id: 'unit-set', mode: 'practice' as const },
    { assessment_id: 'key-topic-timed', mode: 'practice' as const },
    { assessment_id: 'exam', mode: 'mock' as const },
  ];

  it('counts a Key Topics test with the practice tests, not as a mock', () => {
    const history = [
      attempt({ test_id: 'unit-set', test_mode: 'practice' }),
      attempt({ test_id: 'key-topic-timed', test_mode: 'mock' }), // the raw flag says mock
      attempt({ test_id: 'exam', test_mode: 'mock' }),
    ];
    expect(planAllowance(free, 'practice', history, null, papers)).toEqual({ limit: 5, used: 2, left: 3 });
    expect(planAllowance(free, 'mock', history, null, papers)).toEqual({ limit: 2, used: 1, left: 1 });
  });

  it('does the same when the history carries the track itself', () => {
    const history = [attempt({ test_id: 'a', mode: 'practice', test_mode: 'practice' }), attempt({ test_id: 'b', mode: 'practice', test_mode: 'mock' })];
    expect(planAllowance(free, 'practice', history).used).toBe(2);
    expect(planAllowance(free, 'mock', history).used).toBe(0);
  });

  it('without the papers or the track, falls back to the raw flag as before', () => {
    const history = [attempt({ test_id: 'key-topic-timed', test_mode: 'mock' })];
    expect(planAllowance(free, 'mock', history).used).toBe(1);
  });

  it('still leaves out attempts from before the plan began', () => {
    const history = [
      attempt({ test_id: 'key-topic-timed', test_mode: 'mock', start_time: '2026-09-01T00:00:00Z' }),
      attempt({ test_id: 'key-topic-timed', test_mode: 'mock', start_time: '2026-10-05T00:00:00Z' }),
    ];
    expect(planAllowance(free, 'practice', history, '2026-10-01T00:00:00Z', papers).used).toBe(1);
  });

  it('never leaves less than zero, however many were taken', () => {
    const history = Array.from({ length: 9 }, () => attempt({ test_id: 'key-topic-timed', test_mode: 'mock' }));
    expect(planAllowance(free, 'practice', history, null, papers).left).toBe(0);
  });
});
