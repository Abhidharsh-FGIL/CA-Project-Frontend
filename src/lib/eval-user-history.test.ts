import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS, stageUnits } from '@/config/tnpsc';
import { buildUserHistory, kindOfAssessment } from './eval-user-history';

const stage = TNPSC_GROUPS.find(g => g.id === 'group-4')!.stages[0];
const unit = stageUnits(stage)[0].unit.id;

const mock = { id: 'm1', title: 'Full Mock', max_score: 300, stage_id: stage.id, track: 'mock' };
const practice = { id: 'p1', title: 'Grammar · Simple', max_score: 60, stage_id: stage.id, track: 'practice', scope: 'unit', unit_id: unit };

describe('kindOfAssessment', () => {
  it('reads mock, practice and unplaced off the tag', () => {
    expect(kindOfAssessment(mock)).toBe('mock');
    expect(kindOfAssessment(practice)).toBe('practice');
    expect(kindOfAssessment({ id: 'x', title: 'No tag' })).toBe('unplaced');
  });
});

describe('buildUserHistory', () => {
  const detailMock = {
    invitations: [
      { id: 'i1', email: 'Asha@x.in', name: 'Asha' },
      { id: 'i2', email: 'ravi@x.in', name: 'Ravi' },
    ],
    attempts: [
      { id: 'a1', invitation_id: 'i1', status: 'submitted', score: 150, max_score: 300, started_at: '2026-10-01T10:00:00Z', submitted_at: '2026-10-01T10:30:00Z' },
      { id: 'a2', invitation_id: 'i1', status: 'submitted', score: 240, max_score: 300, started_at: '2026-10-05T10:00:00Z', submitted_at: '2026-10-05T11:00:00Z' },
    ],
    direct_attempts: [
      { email: 'asha@x.in', name: 'Asha K', attempts: [{ id: 'd1', status: 'in_progress', started_at: '2026-10-09T09:00:00Z' }] },
    ],
  };
  const detailPractice = {
    invitations: [],
    attempts: [],
    direct_attempts: [
      { email: 'asha@x.in', name: 'Asha', attempts: [{ id: 'd2', status: 'auto_submitted', score: 30, max_score: 60, started_at: '2026-10-07T09:00:00Z', submitted_at: '2026-10-07T09:40:00Z' }] },
    ],
  };

  const users = buildUserHistory([
    { assessment: mock, detail: detailMock },
    { assessment: practice, detail: detailPractice },
  ]);
  const asha = users.find(u => u.email.toLowerCase() === 'asha@x.in')!;

  it('merges a person across invitations and direct attempts, by e-mail, however it is cased', () => {
    expect(users).toHaveLength(1); // Ravi never attempted anything
    expect(asha.attempts).toHaveLength(4);
    expect(asha.assessments).toBe(2);
  });

  it('lists the newest attempt first', () => {
    expect(asha.attempts[0].attemptId).toBe('d1');
    expect(asha.lastAt).toBe('2026-10-09T09:00:00Z');
  });

  it('counts only finished attempts in the average and the best, and gives an open one no score', () => {
    const open = asha.attempts.find(a => a.state === 'in_progress')!;
    expect(open.score).toBeNull();
    expect(open.percentage).toBeNull();
    expect(asha.completed).toBe(3);
    // 150/300 = 50 %, 240/300 = 80 %, 30/60 = 50 %
    expect(asha.avgPercentage).toBe(60);
    expect(asha.bestPercentage).toBe(80);
  });

  it('knows each attempt’s kind, max score and time, and the id its report opens by', () => {
    const second = asha.attempts.find(a => a.attemptId === 'a2')!;
    expect(second).toMatchObject({ kind: 'mock', maxScore: 300, percentage: 80, timeSeconds: 3600, assessmentId: 'm1' });
    expect(asha.attempts.find(a => a.attemptId === 'd2')).toMatchObject({ kind: 'practice', state: 'auto_submitted', timeSeconds: 2400 });
  });

  it('says nothing for an assessment whose detail has not arrived', () => {
    expect(buildUserHistory([{ assessment: mock, detail: null }])).toEqual([]);
    expect(buildUserHistory([])).toEqual([]);
  });

  it('takes an invitation’s embedded attempt when no attempt is linked to it', () => {
    const embedded = buildUserHistory([
      { assessment: mock, detail: { invitations: [{ id: 'i9', email: 'e@x.in', name: 'E', attempt_id: 'z', attempt_status: 'submitted', score: 60, max_score: 300, submitted_at: '2026-10-02T10:00:00Z' }], attempts: [] } },
    ]);
    expect(embedded[0].attempts[0]).toMatchObject({ attemptId: 'z', percentage: 20, state: 'submitted' });
  });
});
