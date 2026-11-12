import { beforeEach, describe, expect, it, vi } from 'vitest';

const userApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('./api', () => ({ userApi }));

import { checkFeasibility, createStudyPlan, getIntakeOptions, getStudyPlan, type StudyPlanIntake } from './studyPlanApi';

const intake = (over: Partial<StudyPlanIntake> = {}) =>
  ({ group_id: 'rrb-ntpc-cbt-1', stage_id: 'rrb-ntpc-cbt-1-exam', basis: { kind: 'syllabus' }, ...over }) as StudyPlanIntake;

beforeEach(() => {
  userApi.get.mockReset().mockResolvedValue({});
  userApi.post.mockReset().mockResolvedValue({});
});

describe('study plan exam and stage codes', () => {
  it('asks for an RRB NTPC plan in the backend codes', async () => {
    await getIntakeOptions('rrb-ntpc-cbt-1', 'rrb-ntpc-cbt-1-exam');
    expect(userApi.get).toHaveBeenCalledWith('/api/v1/user/study-plan/intake-options?group_id=rrb-ntpc&stage_id=rrb-ntpc-cbt-1');

    await checkFeasibility(intake());
    await createStudyPlan(intake());
    for (const [, body] of userApi.post.mock.calls) expect(body).toMatchObject({ group_id: 'rrb-ntpc', stage_id: 'rrb-ntpc-cbt-1' });
  });

  it('sends the TNPSC codes as they are', async () => {
    await getIntakeOptions('group-2', 'group-2-prelims');
    expect(userApi.get).toHaveBeenCalledWith('/api/v1/user/study-plan/intake-options?group_id=group-2&stage_id=group-2-prelims');
  });

  it('reads a plan the backend sent back in the portal codes', async () => {
    userApi.get.mockResolvedValue({ plan_id: 'p1', group_id: 'rrb-ntpc', stage_id: 'rrb-ntpc-cbt-2', intake: { group_id: 'rrb-ntpc', stage_id: 'rrb-ntpc-cbt-2' } });
    const plan = await getStudyPlan('p1');
    expect(plan).toMatchObject({ group_id: 'rrb-ntpc-cbt-2', stage_id: 'rrb-ntpc-cbt-2-exam' });
    expect(plan.intake).toMatchObject({ group_id: 'rrb-ntpc-cbt-2', stage_id: 'rrb-ntpc-cbt-2-exam' });
  });
});
