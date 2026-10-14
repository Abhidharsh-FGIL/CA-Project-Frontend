import { describe, expect, it } from 'vitest';
import { findStage, sectionSyllabus, stageUnits, type TnpscPatternSection } from '@/config/tnpsc';
import type { TnpscTest } from '@/lib/tnpscApi';
import { fullSetFor, fullSetSectionFromTitle } from '@/lib/tnpsc-full-set';

const stage = findStage('group-4', 'group-4-written')!.stage;
const sectionNamed = (name: string): TnpscPatternSection => stage.pattern!.sections.find(s => s.name === name)!;

const APTITUDE = sectionNamed('Aptitude & Mental Ability');
const STUDIES = sectionNamed('General Studies');
const TAMIL = sectionNamed('General Tamil');
const ENGLISH = sectionNamed('General English');

/** A practice paper as the listing returns it, with just what these tests vary. */
let n = 0;
const paper = (over: Partial<TnpscTest>): TnpscTest => ({
  test_id: `t${++n}`,
  source: 'assessment',
  title: 'A paper',
  group_id: 'group-4',
  stage_id: 'group-4-written',
  test_type: 'practice',
  level: null,
  unit_id: null,
  subject_id: null,
  subject_name: null,
  topic_id: null,
  topic_name: null,
  question_count: 25,
  max_marks: 37.5,
  time_limit_minutes: null,
  negative_marking: false,
  negative_mark_value: null,
  price: 0,
  required_tier: null,
  is_locked: false,
  lock_reason: null,
  attempts_used: 0,
  max_attempts: null,
  best_percentage: null,
  is_completed: false,
  ...over,
});

describe('the sections this is run against', () => {
  it('Aptitude & Mental Ability is 25 questions — the same size as a Tamil literature unit', () => {
    expect(APTITUDE.questions).toBe(25);
    const tamilUnitSizes = stageUnits(stage).filter(u => u.sectionName === TAMIL.name).map(u => u.unit.questions);
    expect(tamilUnitSizes).toContain(25);
  });
});

describe('fullSetFor — the reported mix-up', () => {
  const tamilLiterature = paper({
    title: 'TNPSC Group 4 — இலக்கியம், தமிழ் அறிஞர்களும், தமிழ்த்தொண்டும் · Complex',
    subject_id: 'general-tamil',
    subject_name: 'General Tamil',
    question_count: 25,
  });

  it("does not serve a Tamil unit paper of the same size as Aptitude's full set", () => {
    expect(fullSetFor(stage, APTITUDE, [tamilLiterature])).toBeNull();
  });

  it('does not, even when the listing says nothing at all about its subject', () => {
    expect(fullSetFor(stage, APTITUDE, [{ ...tamilLiterature, subject_id: null, subject_name: null }])).toBeNull();
  });

  it("finds Aptitude's own full set among the other papers", () => {
    const real = paper({ title: 'TNPSC Group 4 — Aptitude & Mental Ability · Full Set' });
    expect(fullSetFor(stage, APTITUDE, [tamilLiterature, real])?.test_id).toBe(real.test_id);
  });
});

describe('fullSetFor — how a paper is placed', () => {
  it('trusts the section tag, whatever the title says', () => {
    const tagged = paper({ title: 'Practice set 7', section_name: 'Aptitude & Mental Ability' });
    expect(fullSetFor(stage, APTITUDE, [tagged])?.test_id).toBe(tagged.test_id);
  });

  it('reads the title the wizard writes', () => {
    const titled = paper({ title: 'TNPSC Group 4 — Aptitude & Mental Ability · Full Set' });
    expect(fullSetFor(stage, APTITUDE, [titled])?.test_id).toBe(titled.test_id);
  });

  it("never takes another section's full set for this one, whatever its size", () => {
    const studies = paper({ title: 'TNPSC Group 4 — General Studies · Full Set', question_count: 25 });
    expect(fullSetFor(stage, APTITUDE, [studies])).toBeNull();
    expect(fullSetFor(stage, STUDIES, [{ ...studies, question_count: STUDIES.questions }])?.test_id).toBe(studies.test_id);
  });

  it("lets a section tag override a title that names a different section", () => {
    const odd = paper({ title: 'TNPSC Group 4 — General Studies · Full Set', section_name: 'Aptitude & Mental Ability' });
    expect(fullSetFor(stage, APTITUDE, [odd])?.test_id).toBe(odd.test_id);
    expect(fullSetFor(stage, STUDIES, [odd])).toBeNull();
  });

  it("falls back to the paper's subject, when it is the section's size", () => {
    const subject = sectionSyllabus(stage, APTITUDE)[0];
    const bySubject = paper({ title: 'Aptitude test', subject_id: subject.id, question_count: APTITUDE.questions });
    expect(fullSetFor(stage, APTITUDE, [bySubject])?.test_id).toBe(bySubject.test_id);
  });

  it('wants the size as well as the subject', () => {
    const subject = sectionSyllabus(stage, APTITUDE)[0];
    expect(fullSetFor(stage, APTITUDE, [paper({ subject_id: subject.id, question_count: 10 })])).toBeNull();
  });

  it('prefers the one of the section size when several are placed', () => {
    const short = paper({ title: 'TNPSC Group 4 — Aptitude & Mental Ability · Full Set', question_count: 10 });
    const full = paper({ title: 'TNPSC Group 4 — Aptitude & Mental Ability · Full Set', question_count: 25 });
    expect(fullSetFor(stage, APTITUDE, [short, full])?.test_id).toBe(full.test_id);
  });
});

describe('fullSetFor — the language papers', () => {
  // Tamil and English are sat instead of one another, and both are 100 questions.
  const tamilFull = paper({ title: 'TNPSC Group 4 — General Tamil · Full Set', question_count: 100 });
  const englishFull = paper({ title: 'TNPSC Group 4 — General English · Full Set', question_count: 100 });

  it("offers each language its own full set", () => {
    expect(TAMIL.questions).toBe(ENGLISH.questions);
    expect(fullSetFor(stage, TAMIL, [englishFull, tamilFull])?.test_id).toBe(tamilFull.test_id);
    expect(fullSetFor(stage, ENGLISH, [tamilFull, englishFull])?.test_id).toBe(englishFull.test_id);
  });

  it("does not offer Tamil's full set as English's when English has none", () => {
    expect(fullSetFor(stage, ENGLISH, [tamilFull])).toBeNull();
  });
});

describe('fullSetFor — a unit paper is never a full set', () => {
  it('skips a paper tagged to a unit, even one titled and sized like the section', () => {
    const unit = stageUnits(stage).find(u => u.sectionName === APTITUDE.name)!.unit;
    const tagged = paper({
      title: 'TNPSC Group 4 — Aptitude & Mental Ability · Full Set',
      unit_id: unit.id,
    });
    expect(fullSetFor(stage, APTITUDE, [tagged])).toBeNull();
  });

  it('skips a paper tagged to a topic', () => {
    expect(
      fullSetFor(stage, APTITUDE, [paper({ title: 'TNPSC Group 4 — Aptitude & Mental Ability · Full Set', topic_id: 'percentage' })]),
    ).toBeNull();
  });

  it('is null with no papers at all', () => {
    expect(fullSetFor(stage, APTITUDE, [])).toBeNull();
  });
});

describe('fullSetSectionFromTitle', () => {
  it('reads the section out of a full-set title', () => {
    expect(fullSetSectionFromTitle('TNPSC Group 4 — General Studies · Full Set')).toBe('General Studies');
    expect(fullSetSectionFromTitle('TNPSC Group 4 — Aptitude & Mental Ability · Full Set')).toBe('Aptitude & Mental Ability');
  });

  it('is null for every other kind of title', () => {
    expect(fullSetSectionFromTitle('TNPSC Group 4 — Indian Polity · Simple')).toBeNull();
    expect(fullSetSectionFromTitle('TNPSC Group 4 — Full Mock (Tamil)')).toBeNull();
    expect(fullSetSectionFromTitle('Full Set')).toBeNull();
    expect(fullSetSectionFromTitle(null)).toBeNull();
  });

  it('does not mind case or spacing in the marker', () => {
    expect(fullSetSectionFromTitle('TNPSC Group 4 — General Studies · full  set')).toBe('General Studies');
  });
});
