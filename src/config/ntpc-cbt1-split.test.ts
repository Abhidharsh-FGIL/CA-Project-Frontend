/**
 * RRB NTPC CBT-1 as two exams: Under-Graduate (`rrb-ntpc-cbt-1`, the id CBT-1 always had) and Graduate
 * (`rrb-ntpc-cbt-1-grad`), each with its own backend stage — see BACKEND_NTPC_LEVELS.md. Each still keeps its own
 * level's papers.
 */
import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS, stageForTitle } from '@/config/tnpsc';
import { fromWireRow, toWireGroup, toWireStage } from '@/config/rrb-ntpc';
import { OPEN_EXAM_IDS } from '@/lib/exam-listing';
import { portalExamIds } from '@/lib/examAvailabilityApi';
import { ntpcFixedLevel, papersForNtpc } from '@/lib/ntpc-level';
import { recommendationsQuery } from '@/lib/recommendationsApi';
import { EMPTY_TAG, suggestAssessmentTitle } from '@/lib/tnpscAdminApi';

const group = (id: string) => TNPSC_GROUPS.find(g => g.id === id);

describe('the two CBT-1 exams', () => {
  it('are in the catalog under their own names, with the same syllabus', () => {
    expect(group('rrb-ntpc-cbt-1')?.name).toBe('RRB NTPC CBT-1 (UG)');
    expect(group('rrb-ntpc-cbt-1-grad')?.name).toBe('RRB NTPC CBT-1 (Graduate)');
    expect(group('rrb-ntpc-cbt-1-grad')?.stages[0].id).toBe('rrb-ntpc-cbt-1-grad-exam');
    // The same 52 units, under the backend's own ids: n1-… for Under-Graduate, ng-… for Graduate.
    const units = (id: string) => group(id)!.stages[0].pattern!.sections.flatMap(s => (s.units ?? []).map(u => u.id));
    expect(units('rrb-ntpc-cbt-1')).toHaveLength(52);
    expect(units('rrb-ntpc-cbt-1-grad')).toEqual(units('rrb-ntpc-cbt-1').map(id => id.replace(/^n1-/, 'ng-')));
    expect(units('rrb-ntpc-cbt-1-grad')).toContain('ng-ga-history');
    expect(group('rrb-ntpc-cbt-2')?.name).toBe('RRB NTPC CBT-2');
  });

  it('each say their level; CBT-2 leaves it to the aspirant', () => {
    expect(ntpcFixedLevel('rrb-ntpc-cbt-1')).toBe('undergraduate');
    expect(ntpcFixedLevel('rrb-ntpc-cbt-1-grad')).toBe('graduate');
    expect(ntpcFixedLevel('rrb-ntpc-cbt-2')).toBeNull();
    expect(ntpcFixedLevel('group-4')).toBeNull();
  });

  it('opens UG and keeps Graduate coming soon', () => {
    expect(OPEN_EXAM_IDS.has('rrb-ntpc-cbt-1')).toBe(true);
    expect(OPEN_EXAM_IDS.has('rrb-ntpc-cbt-1-grad')).toBe(false);
  });
});

describe('what is sent to the backend', () => {
  it("is each exam's own stage under the one RRB NTPC exam", () => {
    expect(toWireGroup('rrb-ntpc-cbt-1-grad')).toBe('rrb-ntpc');
    expect(toWireStage('rrb-ntpc-cbt-1-grad-exam')).toBe('rrb-ntpc-cbt-1-grad');
    expect(recommendationsQuery('rrb-ntpc-cbt-1-grad', 'rrb-ntpc-cbt-1-grad-exam')).toBe('exam=rrb-ntpc&stage=rrb-ntpc-cbt-1-grad');
    // Under-Graduate is unchanged.
    expect(recommendationsQuery('rrb-ntpc-cbt-1', 'rrb-ntpc-cbt-1-exam')).toBe('exam=rrb-ntpc&stage=rrb-ntpc-cbt-1');
  });

  it('opens Graduate only when the server names it; its CBT-1 switch is the Under-Graduate exam\'s', () => {
    expect(portalExamIds('ntpc-cbt-1')).toEqual(['rrb-ntpc-cbt-1']);
    expect(portalExamIds('rrb-ntpc')).not.toContain('rrb-ntpc-cbt-1-grad');
    expect(portalExamIds('rrb-ntpc-cbt-1-grad')).toEqual(['rrb-ntpc-cbt-1-grad']);
  });
});

describe('what comes back is filed under the exam its stage says', () => {
  it("the Graduate stage under Graduate, CBT-1's under Under-Graduate — whatever the title says", () => {
    const row = (stage: string, title: string) => fromWireRow({ title, stage_id: stage, group_id: 'rrb-ntpc' });
    expect(row('rrb-ntpc-cbt-1-grad', 'RRB NTPC CBT-1 (Graduate · English) — Full Mock')).toMatchObject({ group_id: 'rrb-ntpc-cbt-1-grad', stage_id: 'rrb-ntpc-cbt-1-grad-exam' });
    expect(row('rrb-ntpc-cbt-1', 'RRB NTPC CBT-1 (Under-Graduate · English) — Full Mock')).toMatchObject({ group_id: 'rrb-ntpc-cbt-1', stage_id: 'rrb-ntpc-cbt-1-exam' });
    // The backend counts a paper by its stage: one titled Graduate but filed under CBT-1 is Under-Graduate's.
    expect(row('rrb-ntpc-cbt-1', 'RRB NTPC CBT-1 (Graduate · English) — Full Mock')).toMatchObject({ group_id: 'rrb-ntpc-cbt-1' });
  });

  it('a paper title finds its exam by its level', () => {
    expect(stageForTitle('RRB NTPC CBT-1 (Graduate · Tamil) — Mathematics · Mixed')?.id).toBe('rrb-ntpc-cbt-1-grad-exam');
    expect(stageForTitle('RRB NTPC CBT-1 (Under-Graduate · Tamil) — Mathematics · Mixed')?.id).toBe('rrb-ntpc-cbt-1-exam');
  });
});

describe('each exam lists its own level\'s papers', () => {
  const papers = [
    { title: 'RRB NTPC CBT-1 (Graduate · English) — A' },
    { title: 'RRB NTPC CBT-1 (Under-Graduate · English) — B' },
    { title: 'RRB NTPC CBT-1 — C' },
  ];
  it('and the ones that name no level', () => {
    expect(papersForNtpc({ level: ntpcFixedLevel('rrb-ntpc-cbt-1'), language: null }, papers).map(p => p.title.slice(-1))).toEqual(['B', 'C']);
    expect(papersForNtpc({ level: ntpcFixedLevel('rrb-ntpc-cbt-1-grad'), language: null }, papers).map(p => p.title.slice(-1))).toEqual(['A', 'C']);
  });
});

describe('a paper placed under a CBT-1 exam', () => {
  it('is titled by the test, with the level in brackets — not by the portal exam\'s name', () => {
    const title = suggestAssessmentTitle({
      ...EMPTY_TAG,
      group_id: 'rrb-ntpc-cbt-1-grad',
      stage_id: 'rrb-ntpc-cbt-1-grad-exam',
      track: 'mock',
      ntpc_level: 'graduate',
      ntpc_language: 'english',
    });
    expect(title).toMatch(/^RRB NTPC CBT-1 \(Graduate · English\)/);
  });
});

describe('a report of an attempt that carries the backend\'s codes', () => {
  it('finds its exam, and the exam\'s marking, under the portal\'s own ids', async () => {
    const { resolveExamContext } = await import('@/lib/exam-report-config');
    const ug = resolveExamContext({ groupId: 'rrb-ntpc', stageId: 'rrb-ntpc-cbt-1' });
    expect(ug).toMatchObject({ examId: 'rrb-ntpc-cbt-1', stageId: 'rrb-ntpc-cbt-1-exam' });
    expect(ug?.marking).toMatchObject({ negativeMarking: true, negativeMarkValue: 0.33 });
    expect(resolveExamContext({ groupId: 'rrb-ntpc', stageId: 'rrb-ntpc-cbt-1-grad' })).toMatchObject({ examId: 'rrb-ntpc-cbt-1-grad' });
  });
});
