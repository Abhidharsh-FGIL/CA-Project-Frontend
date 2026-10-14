import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS, findUnit } from '@/config/tnpsc';
import { G4_TAXONOMY_KEYS, g4ReachedTopics, syllabusForTask } from '@/lib/plan-syllabus';

const stage = TNPSC_GROUPS.find(g => g.id === 'group-4')!.stages.find(s => s.id === 'group-4-written')!;

const task = (subject_id: string, topic_id: string | null, unit_id: string | null = null) => ({
  subject_id,
  topic_id,
  unit_id,
});

describe('the Group 4 taxonomy map', () => {
  it('only names taxonomy topics the server actually has', () => {
    const real = new Set(stage.subjects.flatMap(s => s.topics.map(t => `${s.id}/${t.id}`)));
    for (const key of G4_TAXONOMY_KEYS) expect(real.has(key), key).toBe(true);
  });

  it('only names units and printed topics that exist in the syllabus', () => {
    for (const key of G4_TAXONOMY_KEYS) {
      const [subject, topic] = key.split('/');
      const s = syllabusForTask(stage, task(subject, topic));
      expect(s, key).not.toBeNull();
      expect(s!.topics.length, key).toBeGreaterThan(0);
    }
  });

  it('leaves exactly the documented taxonomy topics without a syllabus', () => {
    // A new taxonomy topic arriving unmapped should fail here, not silently show
    // a task with no syllabus.
    const mapped = new Set(G4_TAXONOMY_KEYS);
    const unmapped = stage.subjects
      .flatMap(s => s.topics.map(t => `${s.id}/${t.id}`))
      .filter(k => !mapped.has(k))
      .sort();
    expect(unmapped).toEqual([
      'aptitude-and-mental-ability/data-interpretation',
      'current-events/international-current-affairs',
      'current-events/national-current-affairs',
      'current-events/schemes-and-policies',
      'current-events/sports-and-awards',
      'current-events/tamil-nadu-current-affairs',
      'development-administration-tn/e-governance-tn',
    ]);
  });
});

describe('syllabusForTask', () => {
  it('reads a task as the printed topics it covers', () => {
    const s = syllabusForTask(stage, task('indian-polity', 'constitution-basics'))!;
    expect(s.unitLabel).toBe('IV');
    expect(s.unitName).toBe('Indian Polity');
    expect(s.questions).toBe(15);
    expect(s.topics.map(t => t.name)).toEqual([
      'Constitution of India — Preamble',
      'Salient features of the Constitution',
      'Union, State and Union Territory',
    ]);
  });

  it('keeps printed order, whatever order the map lists them in', () => {
    const s = syllabusForTask(stage, task('geography', 'physical-geography'))!;
    expect(s.topics.map(t => t.id)).toEqual(['earth-location', 'physical-features', 'geographical-landmarks']);
  });

  it('takes a whole unit for a subject that is the unit', () => {
    const s = syllabusForTask(stage, task('general-tamil', 'grammar'))!;
    // The Tamil paper's units are named as the syllabus prints them: in Tamil, with no gloss.
    expect(s.unitName).toBe('இலக்கணம்');
    expect(s.unitNameTa).toBeUndefined();
    expect(s.topics).toHaveLength(findUnit(stage, 'g4-ta-grammar')!.topics!.length);
  });

  it('trusts a unit the server names over the taxonomy', () => {
    const s = syllabusForTask(stage, task('indian-polity', 'constitution-basics', 'g4-gs-geography'))!;
    expect(s.unitName).toBe('Geography');
    // No printed topic of that name, so the whole unit rather than a guess.
    expect(s.topics).toHaveLength(findUnit(stage, 'g4-gs-geography')!.topics!.length);
  });

  it('narrows to one printed topic when the server names it', () => {
    const s = syllabusForTask(stage, task('indian-polity', 'federalism', 'g4-gs-indian-polity'))!;
    expect(s.topics.map(t => t.id)).toEqual(['federalism']);
  });

  it('falls back to the taxonomy when the named unit is unknown', () => {
    const s = syllabusForTask(stage, task('indian-polity', 'local-self-government', 'no-such-unit'))!;
    expect(s.unitName).toBe('Indian Polity');
  });

  it.each([
    ['current affairs, which the syllabus keeps inside each unit', 'current-events', 'national-current-affairs'],
    ['data interpretation, which is not printed', 'aptitude-and-mental-ability', 'data-interpretation'],
    ['e-governance, which is not printed', 'development-administration-tn', 'e-governance-tn'],
  ])('shows no syllabus for %s', (_why, subject, topic) => {
    expect(syllabusForTask(stage, task(subject, topic))).toBeNull();
  });

  it('shows nothing for a task with no topic', () => {
    expect(syllabusForTask(stage, task('indian-polity', null))).toBeNull();
  });

  it('shows nothing without a stage', () => {
    expect(syllabusForTask(undefined, task('indian-polity', 'constitution-basics'))).toBeNull();
  });

  it('does not apply the Group 4 reading to another exam', () => {
    const group1 = TNPSC_GROUPS.find(g => g.id === 'group-1')!.stages[0];
    expect(syllabusForTask(group1, task('indian-polity', 'constitution-basics'))).toBeNull();
  });
});

describe('what the taxonomy never reaches', () => {
  // Not an assertion about quality — a record. These printed topics are in no
  // taxonomy topic, so today's server plan never schedules them. The same
  // sentence is in STUDY_PLAN_BACKEND_CHANGES.md for the backend team.
  it('leaves the writing, technical-terms and translation units of both language papers out of reach', () => {
    const reached = g4ReachedTopics();
    for (const unit of [
      'g4-ta-writing', 'g4-ta-technical-terms', 'g4-ta-translation',
      'g4-en-writing', 'g4-en-technical-terms', 'g4-en-translation',
    ]) {
      expect(reached.has(unit), unit).toBe(false);
    }
  });
});
