import { describe, expect, it } from 'vitest';
import { EXAM_GROUP_OPTIONS, GROUP_OPTIONS, openGroupKey } from '@/hooks/use-progress-trend';
import { OPEN_EXAM_IDS } from '@/lib/exam-listing';

const option = (value: string) => GROUP_OPTIONS.find(o => o.value === value)!;

describe('the exam filter follows which exams are open', () => {
  it('leaves out Group 1 and GAT-B, which are not open yet, instead of listing them greyed out', () => {
    for (const value of ['group-1', 'gat-b']) expect(GROUP_OPTIONS.find(o => o.value === value)).toBeUndefined();
    expect(GROUP_OPTIONS.some(o => o.disabled || o.hint === 'Coming soon')).toBe(false);
  });

  it('leaves Group 4 open, with its own hint', () => {
    expect(option('group-4').disabled).toBeFalsy();
    expect(option('group-4').hint).toBe('Written');
  });

  it('leaves "All groups" open on History', () => {
    expect(option('all').disabled).toBeFalsy();
  });

  it('is exactly the exams the Exams page opens — one rule, not two', () => {
    expect(EXAM_GROUP_OPTIONS.map(o => o.value).sort()).toEqual([...OPEN_EXAM_IDS].sort());
  });

  it('keeps the same labels, in the same order', () => {
    expect(EXAM_GROUP_OPTIONS.map(o => o.label)).toEqual(['Group 2', 'Group 4', 'RRB NTPC CBT-1 (UG)', 'RRB NTPC CBT-2']);
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

describe('the filter follows the exams the server says are open', () => {
  it('lists only those, in the usual order', async () => {
    const { examGroupOptions } = await import('@/hooks/use-progress-trend');
    expect(examGroupOptions(new Set(['rrb-ntpc-cbt-1', 'group-4', 'group-2'])).map(o => o.value)).toEqual(['group-2', 'group-4', 'rrb-ntpc-cbt-1']);
  });

  it('moves a view off an exam that has closed: to the aspirant\'s own if open, else the first open one', async () => {
    const { openGroupIn } = await import('@/hooks/use-progress-trend');
    const open = new Set(['group-2', 'group-4', 'rrb-ntpc-cbt-1']);
    expect(openGroupIn(open, 'rrb-ntpc-cbt-1', 'group-4')).toBe('rrb-ntpc-cbt-1');
    expect(openGroupIn(open, 'rrb-ntpc-cbt-2', 'group-4')).toBe('group-4');
    expect(openGroupIn(open, 'rrb-ntpc-cbt-2', 'gat-b')).toBe('group-2');
  });

  it('keeps an exam\'s name even when it is not open', async () => {
    const { examGroupLabel } = await import('@/hooks/use-progress-trend');
    expect(examGroupLabel('rrb-ntpc-cbt-2')).toBe('RRB NTPC CBT-2');
  });
});

describe('the "Coming soon" note under the filter', () => {
  it('names at most two exams that are not open yet, CBT-1 Graduate first, and none that are open', async () => {
    const { upcomingExamLabels } = await import('@/hooks/use-progress-trend');
    expect(upcomingExamLabels(new Set(['group-2', 'group-4', 'rrb-ntpc-cbt-1']))).toEqual(['RRB NTPC CBT-1 (Graduate)', 'Group 1']);
    expect(upcomingExamLabels(new Set(['group-1', 'group-2', 'group-4', 'gat-b', 'rrb-ntpc-cbt-1', 'rrb-ntpc-cbt-1-grad']))).toEqual(['RRB NTPC CBT-2']);
  });
});
