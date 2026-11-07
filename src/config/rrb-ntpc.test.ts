import { describe, expect, it } from 'vitest';
import { ntpcLabel } from './rrb-ntpc';
import { TNPSC_GROUPS, findStage, negativeMarkingLabel, stageForTitle, stageUnits } from './tnpsc';
import { OPEN_EXAM_IDS, splitExams, examEntryPath } from '@/lib/exam-listing';
import { GROUP_STAGE, EXAM_GROUP_OPTIONS } from '@/hooks/use-progress-trend';

describe('RRB NTPC', () => {
  it('is two exams, CBT-1 and CBT-2, open next to Group 4 and Group 2', () => {
    expect(splitExams(TNPSC_GROUPS).open.map(g => g.id)).toEqual(['group-4', 'group-2', 'rrb-ntpc-cbt-1', 'rrb-ntpc-cbt-2']);
    for (const id of ['rrb-ntpc-cbt-1', 'rrb-ntpc-cbt-2'] as const) {
      expect(OPEN_EXAM_IDS.has(id)).toBe(true);
      expect(EXAM_GROUP_OPTIONS.find(o => o.value === id)?.disabled).toBeFalsy();
      expect(findStage(id, GROUP_STAGE[id])).toBeDefined();
    }
    const g = TNPSC_GROUPS.find(x => x.id === 'rrb-ntpc-cbt-1')!;
    expect(examEntryPath(g)).toBe('/user/exams/rrb-ntpc-cbt-1/rrb-ntpc-cbt-1-exam');
  });

  it('carries each test\'s own pattern: 100 questions for CBT 1, 120 for CBT 2, a third of a mark off', () => {
    const one = findStage('rrb-ntpc-cbt-1', 'rrb-ntpc-cbt-1-exam')!.stage.pattern!;
    const two = findStage('rrb-ntpc-cbt-2', 'rrb-ntpc-cbt-2-exam')!.stage.pattern!;
    expect(one.sections.map(s => [s.name, s.questions])).toEqual([['General Awareness', 40], ['Mathematics', 30], ['General Intelligence & Reasoning', 30]]);
    expect(two.sections.map(s => s.questions)).toEqual([50, 35, 35]);
    for (const p of [one, two]) {
      expect(p.sections.reduce((n, s) => n + s.questions, 0)).toBe(p.total_questions);
      expect(p.duration_minutes).toBe(90);
      expect(negativeMarkingLabel(p)).toBe('−0.33 per wrong answer');
    }
    expect([one.total_questions, two.total_questions]).toEqual([100, 120]);
  });

  it('lists the syllabus units: 22 in General Awareness, 13 in Mathematics, 17 in Reasoning, each with its own id', () => {
    const stage = findStage('rrb-ntpc-cbt-2', 'rrb-ntpc-cbt-2-exam')!.stage;
    const [ga, maths, reasoning] = stage.pattern!.sections.map(s => s.units!.length);
    expect([ga, maths, reasoning]).toEqual([22, 13, 17]);
    const ids = stageUnits(stage).map(u => u.unit.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tells the two tests apart by a paper\'s title', () => {
    expect(stageForTitle('RRB NTPC CBT-1 — Mathematics: Percentage · Mixed')?.id).toBe('rrb-ntpc-cbt-1-exam');
    expect(stageForTitle('RRB NTPC CBT-2 — Syllogism · Mixed')?.id).toBe('rrb-ntpc-cbt-2-exam');
  });
  it('names a unit, topic or subject in the chosen language alone, English where there is no translation', () => {
    expect(ntpcLabel('Games and Sports', 'english')).toBe('Games and Sports');
    expect(ntpcLabel('Games and Sports', 'tamil')).toBe('விளையாட்டுகள்');
    expect(ntpcLabel('Games and Sports', 'hindi')).toBe('खेलकूद');
    expect(ntpcLabel('General Awareness', 'hindi')).toBe('सामान्य जागरूकता');
    expect(ntpcLabel('Current Events', 'hindi')).not.toMatch(/[A-Za-z]/);
    expect(ntpcLabel('Not an NTPC name', 'hindi')).toBe('Not an NTPC name');
  });
});
