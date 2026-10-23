/**
 * Tagging a paper to a published syllabus unit.
 *
 * The aspirant portal lists practice by unit, so the unit is what decides where a
 * paper appears. These lock the admin side's half of that contract: the unit list
 * an admin picks from, what a valid practice tag looks like, and that the subject
 * the backend still filters on is derived rather than asked for twice.
 */
import { describe, it, expect } from 'vitest';
import { TNPSC_GROUPS, findStage, findUnit, stageUnits, subjectForUnit } from '@/config/tnpsc';
import { EMPTY_TAG, describeTag, validateTnpscTag, type TnpscTagValue } from '@/lib/tnpscAdminApi';

const stage = findStage('group-4', 'group-4-written', TNPSC_GROUPS)!.stage;

/** A complete, valid practice tag — each test spoils one field of it. */
const practiceTag = (over: Partial<TnpscTagValue> = {}): TnpscTagValue => ({
  ...EMPTY_TAG,
  group_id: 'group-4',
  stage_id: 'group-4-written',
  track: 'practice',
  scope: 'unit',
  unit_id: 'g4-gs-indian-polity',
  subject_id: 'indian-polity',
  ...over,
});

describe('stageUnits', () => {
  it('flattens every published unit across the stage, in printed order', () => {
    const units = stageUnits(stage);
    // Group 4: Tamil 7 + English 7 + General Studies 7 + Aptitude 2.
    expect(units).toHaveLength(23);
    expect(units[0].unit.label).toBe('I');
    // Each unit knows the section it was printed under, for the picker's hint.
    expect(new Set(units.map(u => u.sectionName))).toEqual(
      new Set(['General Tamil', 'General English', 'General Studies', 'Aptitude & Mental Ability']),
    );
  });

  it('is empty for a stage with no published pattern', () => {
    expect(stageUnits(undefined)).toEqual([]);
  });
});

describe('findUnit', () => {
  it('finds a unit wherever in the stage it sits', () => {
    expect(findUnit(stage, 'g4-ta-grammar')?.name).toBe('Grammar');
    expect(findUnit(stage, 'g4-gs-indian-polity')?.questions).toBe(15);
  });

  it('returns undefined for an unknown or absent id', () => {
    expect(findUnit(stage, 'not-a-unit')).toBeUndefined();
    expect(findUnit(stage, null)).toBeUndefined();
  });
});

describe('validateTnpscTag — practice', () => {
  it('accepts a unit-tagged practice paper', () => {
    expect(validateTnpscTag(practiceTag()).ok).toBe(true);
  });

  it('requires a unit', () => {
    const { ok, errors } = validateTnpscTag(practiceTag({ unit_id: null }));
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/must be assigned a syllabus unit/i);
  });

  it('rejects a unit from another stage', () => {
    const { ok, errors } = validateTnpscTag(practiceTag({ unit_id: 'g1-something-else' }));
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/does not belong to the selected stage/i);
  });

  it('warns when the set is smaller than the unit carries in the real paper', () => {
    // Indian Polity is 15 questions; a 5-question set is worth flagging, not blocking.
    const { ok, warnings } = validateTnpscTag(practiceTag(), 5);
    expect(ok).toBe(true);
    expect(warnings.join(' ')).toMatch(/carries 15 questions/);
  });
});

describe('validateTnpscTag — exam (mock)', () => {
  const mockTag = (over: Partial<TnpscTagValue> = {}): TnpscTagValue => ({
    ...EMPTY_TAG,
    group_id: 'group-4',
    stage_id: 'group-4-written',
    track: 'mock',
    level: 'simple',
    // Group 4 is sat in one language or the other, so a full mock must say which.
    language: 'tamil',
    ...over,
  });

  it('accepts a levelled mock with no unit — a mock is the whole paper', () => {
    expect(validateTnpscTag(mockTag()).ok).toBe(true);
  });

  // The form no longer asks a mock for a level while the portal shows one level
  // (LEVELS_HIDDEN): the paper is composed to the 20/30/50 blend, so there is nothing
  // for an admin to choose. The server still requires one — see the payload test below.
  it('does not ask for a level while the portal shows a single level', () => {
    const { ok, errors } = validateTnpscTag(mockTag({ level: null }));
    expect(ok).toBe(true);
    expect(errors.join(' ')).not.toMatch(/level/i);
  });

  it('does not ask a mock for a unit', () => {
    expect(validateTnpscTag(mockTag()).errors.join(' ')).not.toMatch(/unit/i);
  });
});

describe('a practice paper carries a difficulty level', () => {
  // The portal gives every unit four buttons — Simple, Medium, Complex, Full Unit
  // — and reads the paper's level to decide which one opens it. Practice papers
  // used to be forbidden a level, so three of the four could never be filled.
  it('accepts each of the three levels', () => {
    for (const level of ['simple', 'medium', 'complex'] as const) {
      expect(validateTnpscTag(practiceTag({ level })).ok).toBe(true);
    }
  });

  it('accepts no level — a set covering the whole unit', () => {
    expect(validateTnpscTag(practiceTag({ level: null })).ok).toBe(true);
  });

  it('names the unit and the button in the placement badge', () => {
    expect(describeTag(practiceTag({ level: 'simple' }))).toBe(
      'Group 4 Written · Practice · Indian Polity · Simple',
    );
    expect(describeTag(practiceTag({ level: null }))).toBe(
      'Group 4 Written · Practice · Indian Polity · Mixed',
    );
  });

  it('does not name a level on an exam — it is built across all three', () => {
    const exam: TnpscTagValue = {
      ...EMPTY_TAG,
      group_id: 'group-4',
      stage_id: 'group-4-written',
      track: 'mock',
      level: null,
      language: 'tamil',
    };
    expect(validateTnpscTag(exam).ok).toBe(true);
    expect(describeTag({ ...exam, level: 'complex' })).toBe('Group 4 Written · Exam');
  });
});

describe('what goes on the wire', () => {
  /**
   * The tagging endpoint distinguishes "leave the level alone" from "clear it":
   * an omitted `level` keeps whatever is stored, an explicit `null` clears it.
   *
   * This admin always makes a deliberate choice — one of the three levels, or
   * "Full Unit" — so it must always send the key. Dropping it when null would
   * silently leave an old level behind and file the paper under the wrong button.
   */
  it('sends level explicitly, including when it is null', async () => {
    const calls: Array<{ path: string; body: any }> = [];
    const api = await import('@/lib/api');
    const original = api.api.patch;
    (api.api as any).patch = (path: string, body: any) => {
      calls.push({ path, body });
      return Promise.resolve({});
    };

    try {
      const { tagAssessment } = await import('@/lib/tnpscAdminApi');
      await tagAssessment('a1', practiceTag({ level: null }));
      expect(Object.prototype.hasOwnProperty.call(calls[0].body, 'level')).toBe(true);
      expect(calls[0].body.level).toBeNull();

      await tagAssessment('a2', practiceTag({ level: 'medium' }));
      expect(calls[1].body.level).toBe('medium');
      expect(calls[1].body.unit_id).toBe('g4-gs-indian-polity');
    } finally {
      (api.api as any).patch = original;
    }
  });

  /**
   * The server answers a mock with no level 422 LEVEL_REQUIRED, and the form no longer
   * asks for one, so the edge supplies it. A level the paper already has is kept — a
   * Medium mock tagged earlier must not be quietly refiled by opening and saving it.
   */
  it('fills in a mock’s level for the server, and keeps one it already has', async () => {
    const calls: any[] = [];
    const api = await import('@/lib/api');
    const original = api.api.patch;
    (api.api as any).patch = (_p: string, body: any) => {
      calls.push(body);
      return Promise.resolve({});
    };
    try {
      const { tagAssessment } = await import('@/lib/tnpscAdminApi');
      const exam = { ...EMPTY_TAG, group_id: 'group-4', stage_id: 'group-4-written', track: 'mock', language: 'tamil' } as TnpscTagValue;
      await tagAssessment('m1', { ...exam, level: null });
      await tagAssessment('m2', { ...exam, level: 'medium' });
      expect(calls[0].level).toBe('simple');
      expect(calls[1].level).toBe('medium');
    } finally {
      (api.api as any).patch = original;
    }
  });

  it('never sends a unit on an exam — a mock is the whole paper', async () => {
    const calls: any[] = [];
    const api = await import('@/lib/api');
    const original = api.api.patch;
    (api.api as any).patch = (_p: string, body: any) => {
      calls.push(body);
      return Promise.resolve({});
    };
    try {
      const { tagAssessment } = await import('@/lib/tnpscAdminApi');
      await tagAssessment('m1', {
        ...EMPTY_TAG,
        group_id: 'group-4',
        stage_id: 'group-4-written',
        track: 'mock',
        level: 'complex',
        language: 'tamil',
        unit_id: 'g4-gs-indian-polity',
        scope: 'unit',
      });
      expect(calls[0].unit_id).toBeNull();
      expect(calls[0].level).toBe('complex');
    } finally {
      (api.api as any).patch = original;
    }
  });
});

describe('the placement cascade', () => {
  it('asks practice what it covers before anything else', () => {
    const { ok, errors } = validateTnpscTag(practiceTag({ scope: null }));
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/one unit, one key topic or a whole section/i);
  });

  it('accepts a section-wise paper with no unit', () => {
    const tag = practiceTag({
      scope: 'section',
      section_name: 'General Studies',
      unit_id: null,
      subject_id: 'general-science',
      level: null,
    });
    expect(validateTnpscTag(tag).ok).toBe(true);
  });

  it('wants to know which section', () => {
    const { ok, errors } = validateTnpscTag(
      practiceTag({ scope: 'section', section_name: null, unit_id: null }),
    );
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/select the section/i);
  });

  it('rejects a section from another stage', () => {
    const { ok, errors } = validateTnpscTag(
      practiceTag({ scope: 'section', section_name: 'Botany', unit_id: null }),
    );
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/does not belong to the selected stage/i);
  });

  it('makes a Group 4 exam say which language it is sat in', () => {
    const exam: TnpscTagValue = {
      ...EMPTY_TAG,
      group_id: 'group-4',
      stage_id: 'group-4-written',
      track: 'mock',
      level: 'simple',
    };
    expect(validateTnpscTag(exam).ok).toBe(false);
    expect(validateTnpscTag(exam).errors.join(' ')).toMatch(/language/i);
    expect(validateTnpscTag({ ...exam, language: 'english' }).ok).toBe(true);
  });

  it('keeps a unit off a section paper on the wire', async () => {
    const calls: any[] = [];
    const api = await import('@/lib/api');
    const original = api.api.patch;
    (api.api as any).patch = (_p: string, body: any) => {
      calls.push(body);
      return Promise.resolve({});
    };
    try {
      const { tagAssessment } = await import('@/lib/tnpscAdminApi');
      // A stale unit id left over from switching scope must not travel — the
      // portal would file the paper under a unit *and* as a section set.
      await tagAssessment('s1', practiceTag({ scope: 'section', section_name: 'General Studies' }));
      expect(calls[0].unit_id).toBeNull();
      expect(calls[0].section_name).toBe('General Studies');
      expect(calls[0].scope).toBe('section');
    } finally {
      (api.api as any).patch = original;
    }
  });
});

describe('a unit that names no subject of its own', () => {
  // All seven General Tamil units sit under the single subject `general-tamil`,
  // which only the *section* names. Reading the unit alone found nothing, left
  // the required subject unset, and produced an error the form could not clear.
  it('falls back to the section that prints it', () => {
    expect(subjectForUnit(stage, findUnit(stage, 'g4-ta-grammar'))).toBe('general-tamil');
    expect(subjectForUnit(stage, findUnit(stage, 'g4-ta-literature'))).toBe('general-tamil');
    expect(subjectForUnit(stage, findUnit(stage, 'g4-en-grammar'))).toBe('general-english');
  });

  it('still prefers a subject the unit names itself', () => {
    expect(subjectForUnit(stage, findUnit(stage, 'g4-gs-indian-polity'))).toBe('indian-polity');
    // Unit V spans two; the first is the one the backend filters on.
    expect(subjectForUnit(stage, findUnit(stage, 'g4-gs-economy-and-dev-admin'))).toBe(
      'indian-economy',
    );
  });

  it('has no answer for a unit that is not in the stage', () => {
    expect(subjectForUnit(stage, undefined)).toBeUndefined();
    expect(subjectForUnit(undefined, findUnit(stage, 'g4-ta-grammar'))).toBeUndefined();
  });

  it('validates a Tamil unit paper that carries no subject of its own', () => {
    // The exact form in the screenshot: Grammar picked, subject never set.
    const tag: TnpscTagValue = {
      ...EMPTY_TAG,
      group_id: 'group-4',
      stage_id: 'group-4-written',
      track: 'practice',
      scope: 'unit',
      unit_id: 'g4-ta-grammar',
      level: 'medium',
      subject_id: null,
    };
    const { ok, errors } = validateTnpscTag(tag);
    expect(errors.join(' ')).not.toMatch(/must be assigned a syllabus subject/i);
    expect(ok).toBe(true);
  });

  it('sends the derived subject even when the tag never held one', async () => {
    const calls: any[] = [];
    const api = await import('@/lib/api');
    const original = api.api.patch;
    (api.api as any).patch = (_p: string, body: any) => {
      calls.push(body);
      return Promise.resolve({});
    };
    try {
      const { tagAssessment } = await import('@/lib/tnpscAdminApi');
      await tagAssessment('t1', {
        ...EMPTY_TAG,
        group_id: 'group-4',
        stage_id: 'group-4-written',
        track: 'practice',
        scope: 'unit',
        unit_id: 'g4-ta-grammar',
        subject_id: null,
      });
      expect(calls[0].subject_id).toBe('general-tamil');
    } finally {
      (api.api as any).patch = original;
    }
  });
});

describe('listReportsPlacement', () => {
  it('is false for a list whose rows carry no placement — the case that made every paper read Not placed', async () => {
    const { listReportsPlacement } = await import('@/lib/tnpscAdminApi');
    expect(listReportsPlacement([{ id: 'a', title: 'x' }, { id: 'b', title: 'y' }])).toBe(false);
    expect(listReportsPlacement([])).toBe(false);
    expect(listReportsPlacement(undefined)).toBe(false);
  });

  it('is true as soon as any row says where it is placed', async () => {
    const { listReportsPlacement } = await import('@/lib/tnpscAdminApi');
    expect(listReportsPlacement([{ id: 'a' }, { id: 'b', tnpsc_stage_id: 'group-4-written' }])).toBe(true);
    expect(listReportsPlacement([{ id: 'a', track: 'practice' }])).toBe(true);
  });
});

describe('a key-topic paper', () => {
  const topicTag = (over: Partial<TnpscTagValue> = {}): TnpscTagValue =>
    practiceTag({ scope: 'topic', topic_id: 'citizenship-rights-duties', level: 'simple', ...over });

  it('is valid with a unit and one of that unit’s topics', () => {
    expect(validateTnpscTag(topicTag()).ok).toBe(true);
  });

  it('needs a category', () => {
    const { ok, errors } = validateTnpscTag(topicTag({ topic_id: null }));
    expect(ok).toBe(false);
    expect(errors.join(' ')).toMatch(/pick the category/i);
  });

  it('takes the bank category as its topic, whether or not the syllabus prints it', () => {
    expect(validateTnpscTag(topicTag({ topic_id: 'அணியிலக்கணம்' })).ok).toBe(true);
  });

  it('still needs a unit', () => {
    expect(validateTnpscTag(topicTag({ unit_id: null })).ok).toBe(false);
  });

  it('does not compare its size to the whole unit’s', () => {
    expect(validateTnpscTag(topicTag(), 10).warnings.join(' ')).not.toMatch(/carries \d+ questions in the real paper/);
  });

  it('is named for its unit and topic in the placement badge', () => {
    expect(describeTag(topicTag())).toContain('Indian Polity: Citizenship, Fundamental Rights and Fundamental Duties');
  });

  /** The server knows unit papers; a key topic is one that names its topic. */
  it('goes out as a unit paper that names its topic', async () => {
    const calls: any[] = [];
    const api = await import('@/lib/api');
    const original = api.api.patch;
    (api.api as any).patch = (_p: string, body: any) => {
      calls.push(body);
      return Promise.resolve({});
    };
    try {
      const { tagAssessment } = await import('@/lib/tnpscAdminApi');
      await tagAssessment('k1', topicTag());
      expect(calls[0]).toMatchObject({ scope: 'unit', unit_id: 'g4-gs-indian-polity', topic_id: 'citizenship-rights-duties' });
    } finally {
      (api.api as any).patch = original;
    }
  });

  it('sends no topic for a whole-unit paper', async () => {
    const calls: any[] = [];
    const api = await import('@/lib/api');
    const original = api.api.patch;
    (api.api as any).patch = (_p: string, body: any) => {
      calls.push(body);
      return Promise.resolve({});
    };
    try {
      const { tagAssessment } = await import('@/lib/tnpscAdminApi');
      await tagAssessment('u1', practiceTag({ scope: 'unit', topic_id: 'citizenship-rights-duties' }));
      expect(calls[0].scope).toBe('unit');
      expect(calls[0].topic_id).toBeNull();
    } finally {
      (api.api as any).patch = original;
    }
  });

  it('is read back as a key topic: a unit paper with a topic', async () => {
    const { readTnpscTag } = await import('@/lib/tnpscAdminApi');
    const read = readTnpscTag({ tnpsc_stage_id: 'group-4-written', track: 'practice', tnpsc_scope: 'unit', tnpsc_unit_id: 'g4-gs-indian-polity', tnpsc_topic_id: 'directive-principles' });
    expect(read).toMatchObject({ scope: 'topic', unit_id: 'g4-gs-indian-polity', topic_id: 'directive-principles' });
    const whole = readTnpscTag({ tnpsc_stage_id: 'group-4-written', track: 'practice', tnpsc_scope: 'unit', tnpsc_unit_id: 'g4-gs-indian-polity' });
    expect(whole.scope).toBe('unit');
  });
});

describe('a key topic the server has no row for', () => {
  const topicTag = practiceTag({ unit_id: 'g4-gs-geography', subject_id: 'geography', scope: 'topic', topic_id: 'forest-wildlife', level: null });

  it('recognises the refusal by its message and by its code', async () => {
    const { isUnknownTopicError } = await import('@/lib/tnpscAdminApi');
    expect(isUnknownTopicError({ message: "'Geography of India' has no topic 'forest-wildlife'." })).toBe(true);
    expect(isUnknownTopicError({ code: 'TNPSC_TOPIC_MISMATCH', message: 'x' })).toBe(true);
    expect(isUnknownTopicError({ message: 'Server error' })).toBe(false);
    expect(isUnknownTopicError(null)).toBe(false);
  });

  it('is saved as a plain unit paper when the server refuses the topic, and says so', async () => {
    const calls: any[] = [];
    const api = await import('@/lib/api');
    const original = api.api.patch;
    (api.api as any).patch = (_p: string, body: any) => {
      calls.push(body);
      return body.topic_id
        ? Promise.reject(Object.assign(new Error("'Geography of India' has no topic 'forest-wildlife'."), { status: 404 }))
        : Promise.resolve({});
    };
    try {
      const { tagAssessmentKeepingTopic } = await import('@/lib/tnpscAdminApi');
      const result = await tagAssessmentKeepingTopic('a1', topicTag);
      expect(result).toEqual({ topicInTitleOnly: true });
      expect(calls).toHaveLength(2);
      expect(calls[1]).toMatchObject({ scope: 'unit', unit_id: 'g4-gs-geography', topic_id: null });
    } finally {
      (api.api as any).patch = original;
    }
  });

  it('is left alone when the server takes the topic', async () => {
    const calls: any[] = [];
    const api = await import('@/lib/api');
    const original = api.api.patch;
    (api.api as any).patch = (_p: string, body: any) => {
      calls.push(body);
      return Promise.resolve({});
    };
    try {
      const { tagAssessmentKeepingTopic } = await import('@/lib/tnpscAdminApi');
      expect(await tagAssessmentKeepingTopic('a2', topicTag)).toEqual({ topicInTitleOnly: false });
      expect(calls).toHaveLength(1);
      expect(calls[0].topic_id).toBe('forest-wildlife');
    } finally {
      (api.api as any).patch = original;
    }
  });

  it('does not hide any other failure', async () => {
    const api = await import('@/lib/api');
    const original = api.api.patch;
    (api.api as any).patch = () => Promise.reject(Object.assign(new Error('boom'), { status: 500 }));
    try {
      const { tagAssessmentKeepingTopic } = await import('@/lib/tnpscAdminApi');
      await expect(tagAssessmentKeepingTopic('a3', topicTag)).rejects.toThrow('boom');
    } finally {
      (api.api as any).patch = original;
    }
  });
});
