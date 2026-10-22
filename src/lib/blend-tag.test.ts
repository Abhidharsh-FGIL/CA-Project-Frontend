import { describe, expect, it } from 'vitest';
import { EMPTY_TAG, validateTnpscTag, type TnpscTagValue } from '@/lib/tnpscAdminApi';
import { blendTargets } from '@/lib/difficulty-blend';

const mock = (blend?: TnpscTagValue['blend']): TnpscTagValue => ({
  ...EMPTY_TAG,
  group_id: 'group-4',
  stage_id: 'group-4-written',
  track: 'mock',
  language: 'tamil',
  blend,
});

describe('a custom difficulty mix', () => {
  it('has to add up to 100', () => {
    const bad = validateTnpscTag(mock({ easy: 30, medium: 30, hard: 30 }));
    expect(bad.errors.some(e => /add up to 100%/.test(e))).toBe(true);
    const good = validateTnpscTag(mock({ easy: 20, medium: 30, hard: 50 }));
    expect(good.errors.some(e => /add up to 100%/.test(e))).toBe(false);
  });

  it('is not checked when no mix was set', () => {
    expect(validateTnpscTag(mock()).errors.some(e => /add up to 100%/.test(e))).toBe(false);
  });

  it('shapes the question counts', () => {
    expect(blendTargets(50, { easy: 20, medium: 30, hard: 50 })).toEqual({ easy: 10, medium: 15, hard: 25 });
  });
});
