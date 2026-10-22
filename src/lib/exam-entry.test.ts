import { describe, expect, it } from 'vitest';
import { examEntryPath, skipsStageList } from '@/lib/exam-listing';
import type { TnpscGroup } from '@/config/tnpsc';

const group = (stages: Array<{ id: string; status: string }>) => ({ id: 'g', stages }) as unknown as TnpscGroup;

describe('examEntryPath', () => {
  it('goes straight to the only open stage', () => {
    const g = group([{ id: 'prelims', status: 'active' }, { id: 'mains', status: 'coming_soon' }]);
    expect(examEntryPath(g)).toBe('/user/exams/g/prelims');
    expect(skipsStageList(g)).toBe(true);
  });

  it('stops at the stage list when several stages are open', () => {
    const g = group([{ id: 'a', status: 'active' }, { id: 'b', status: 'active' }]);
    expect(examEntryPath(g)).toBe('/user/exams/g');
    expect(skipsStageList(g)).toBe(false);
  });

  it('stops at the stage list when none is open', () => {
    expect(examEntryPath(group([{ id: 'a', status: 'coming_soon' }]))).toBe('/user/exams/g');
  });
});
