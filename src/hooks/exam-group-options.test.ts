import { describe, expect, it } from 'vitest';
import { EXAM_GROUP_OPTIONS, GROUP_OPTIONS, openGroupKey } from '@/hooks/use-progress-trend';
import { OPEN_EXAM_IDS } from '@/lib/exam-listing';

const option = (value: string) => GROUP_OPTIONS.find(o => o.value === value)!;

describe('the exam filter follows which exams are open', () => {
  it('lists Group 1 and GAT-B but does not let either be chosen, and says why', () => {
    for (const value of ['group-1', 'gat-b']) {
      expect(option(value).disabled).toBe(true);
      expect(option(value).hint).toBe('Coming soon');
    }
  });

  it('leaves Group 4 open, with its own hint', () => {
    expect(option('group-4').disabled).toBeFalsy();
    expect(option('group-4').hint).toBe('Written');
  });

  it('leaves "All groups" open on History', () => {
    expect(option('all').disabled).toBeFalsy();
  });

  it('is exactly the exams the Exams page opens — one rule, not two', () => {
    const open = EXAM_GROUP_OPTIONS.filter(o => !o.disabled).map(o => o.value);
    expect(open.sort()).toEqual([...OPEN_EXAM_IDS].sort());
  });

  it('keeps the same labels', () => {
    expect(EXAM_GROUP_OPTIONS.map(o => o.label)).toEqual(['Group 1', 'Group 4', 'GAT-B']);
  });
});

describe('openGroupKey — the exam a view opens on', () => {
  it('is the aspirant\'s exam when it is open', () => {
    expect(openGroupKey('group-4')).toBe('group-4');
  });

  it('falls back to Group 4 for an exam that is not open, so the locked option is never the selected one', () => {
    expect(openGroupKey('group-1')).toBe('group-4');
    expect(openGroupKey('gat-b')).toBe('group-4');
  });

  it('falls back for nothing, or for a code the build does not know', () => {
    expect(openGroupKey(undefined)).toBe('group-4');
    expect(openGroupKey(null)).toBe('group-4');
    expect(openGroupKey('ssc-cgl')).toBe('group-4');
  });
});
