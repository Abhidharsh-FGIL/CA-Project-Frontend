import { describe, expect, it } from 'vitest';
import { SSC_CHSL_GROUPS } from './ssc-chsl';
import { TNPSC_GROUPS, hasPerSectionNegative, marksForSubject, stageUnits } from './tnpsc';
import { BOARDS } from '@/constants';
import { EXAM_SYLLABUS } from '@/data/examSyllabus';

const stage = (n: 1 | 2) => SSC_CHSL_GROUPS[n - 1].stages[0];

describe('SSC CHSL in the catalog', () => {
  it('is two exams of their own, one stage each, in the catalog', () => {
    expect(SSC_CHSL_GROUPS.map(g => g.id)).toEqual(['ssc-chsl-tier-1', 'ssc-chsl-tier-2']);
    for (const g of SSC_CHSL_GROUPS) {
      expect(TNPSC_GROUPS.some(x => x.id === g.id)).toBe(true);
      expect(g.stages).toHaveLength(1);
      expect(g.stages[0].id).toBe(`${g.id}-exam`);
    }
  });

  it('Tier I is 100 questions, 200 marks, 60 minutes: four sections of 25 at 2 marks, 0.50 off', () => {
    const p = stage(1).pattern!;
    expect([p.total_questions, p.total_marks, p.duration_minutes, p.negative_mark_value]).toEqual([100, 200, 60, 0.5]);
    expect(p.sections.map(s => [s.questions, s.marks, s.marks_per_question])).toEqual([[25, 50, 2], [25, 50, 2], [25, 50, 2], [25, 50, 2]]);
  });

  it('Tier II is 135 questions, 405 marks, 2h15: 30 + 30 + 40 + 20 + 15 at 3 marks, 1 off', () => {
    const p = stage(2).pattern!;
    expect([p.total_questions, p.total_marks, p.duration_minutes, p.negative_mark_value]).toEqual([135, 405, 135, 1]);
    expect(p.sections.map(s => [s.name, s.questions, s.marks])).toEqual([
      ['Mathematical Abilities', 30, 90],
      ['Reasoning and General Intelligence', 30, 90],
      ['English Language and Comprehension', 40, 120],
      ['General Awareness', 20, 60],
      ['Computer Knowledge Test', 15, 45],
    ]);
  });

  it('Computer Knowledge is a Tier II subject only', () => {
    expect(stage(1).subjects.map(s => s.id)).not.toContain('chsl-computer');
    expect(stage(2).subjects.map(s => s.id)).toContain('chsl-computer');
  });

  it('shares one set of subject names between the tiers, so one question bank serves both', () => {
    const names = (n: 1 | 2) => stage(n).subjects.map(s => s.name);
    for (const name of names(1)) expect(names(2)).toContain(name);
    expect(names(2)).toContain('Quantitative Aptitude'); // Tier II's section is "Mathematical Abilities"; the subject is the same
  });

  it('marks a question by its subject: 2 in Tier I, 3 in Tier II', () => {
    expect(marksForSubject(stage(1), 'English Language')).toBe(2);
    expect(marksForSubject(stage(2), 'Computer Knowledge')).toBe(3);
  });

  it('every unit has a unique id, a name and topics, and belongs to its section’s subject', () => {
    const seen = new Set<string>();
    for (const n of [1, 2] as const) {
      for (const sec of stage(n).pattern!.sections) {
        expect(sec.units?.length).toBeGreaterThan(0);
        for (const u of sec.units!) {
          expect(seen.has(u.id)).toBe(false);
          seen.add(u.id);
          expect(u.id.startsWith(n === 1 ? 'c1-' : 'c2-')).toBe(true);
          expect(u.name).not.toBe('');
          expect(u.topics!.length).toBeGreaterThan(0);
          expect(sec.subject_ids).toEqual(u.subject_ids);
        }
      }
      expect(stageUnits(stage(n)).length).toBe(stage(n).pattern!.sections.reduce((t, s) => t + s.units!.length, 0));
    }
  });

  it('Tier II adds Statistics and Probability where Tier I has Data Interpretation', () => {
    const maths = (n: 1 | 2) => stage(n).pattern!.sections.find(s => s.subject_ids![0] === 'chsl-quant')!.units!.map(u => u.name);
    expect(maths(1)).toContain('Data Interpretation');
    expect(maths(2)).toContain('Statistics and Probability');
    expect(maths(2)).not.toContain('Data Interpretation');
  });

  it('is a test type the generator and the paper forms know, with the section counts', () => {
    for (const g of SSC_CHSL_GROUPS) {
      expect(BOARDS as readonly string[]).toContain(g.exam_type);
      expect(EXAM_SYLLABUS[g.exam_type].length).toBe(g.stages[0].subjects.length);
    }
    expect(EXAM_SYLLABUS['SSC CHSL Tier-1'].map(s => s.questions)).toEqual([25, 25, 25, 25]);
    expect(EXAM_SYLLABUS['SSC CHSL Tier-2'].map(s => s.questions)).toEqual([30, 30, 40, 20, 15]);
    expect(EXAM_SYLLABUS['SSC CHSL Tier-2'].reduce((t, s) => t + (s.questions ?? 0), 0)).toBe(135);
  });

  // The section names a whole-section practice set is matched on (the backend refuses any other with SECTION_NOT_IN_STAGE).
  it('uses the section names the backend matches on', () => {
    expect(stage(1).pattern!.sections.map(x => x.name)).toEqual([
      'English Language', 'General Intelligence and Reasoning', 'Quantitative Aptitude', 'General Awareness',
    ]);
    expect(stage(2).pattern!.sections.map(x => x.name)).toEqual([
      'Mathematical Abilities', 'Reasoning and General Intelligence', 'English Language and Comprehension', 'General Awareness', 'Computer Knowledge Test',
    ]);
  });

  // The unit ids are the backend's (the Syllabus sheet of the v2 workbook): 26 for Tier-1, 32 for Tier-2, c1-/c2-.
  it('has the 58 unit ids the backend serves', () => {
    const ids = (n: 1 | 2) => stageUnits(stage(n)).map(x => x.unit.id);
    expect(ids(1)).toHaveLength(26);
    expect(ids(2)).toHaveLength(32);
    expect(ids(1).every(id => id.startsWith('c1-'))).toBe(true);
    expect(ids(2).every(id => id.startsWith('c2-'))).toBe(true);
    expect(ids(1)).toContain('c1-english-language-vocabulary');
    expect(ids(2)).toContain('c2-computer-knowledge-cyber-security');
  });

  // The paper form seeds its deduction from the stage when every section is marked alike, so a Tier I paper goes out at 0.5
  // and a Tier II paper at 1 — not at the box's 0.25 default.
  it('marks every section alike, so the paper form can seed the deduction: 0.5 and 1', () => {
    expect(hasPerSectionNegative(stage(1).pattern)).toBe(false);
    expect(hasPerSectionNegative(stage(2).pattern)).toBe(false);
    expect(stage(1).pattern!.negative_mark_value).toBe(0.5);
    expect(stage(2).pattern!.negative_mark_value).toBe(1);
  });
});

describe('SSC CHSL Tier I unit split', () => {
  it('every Tier I unit has a count, and each section adds up to its 25', () => {
    for (const sec of stage(1).pattern!.sections) {
      expect(sec.units!.every(u => (u.questions ?? 0) > 0), sec.name).toBe(true);
      expect(sec.units!.reduce((t, u) => t + (u.questions ?? 0), 0), sec.name).toBe(sec.questions);
    }
    const maths = stage(1).pattern!.sections.find(s => s.name === 'Quantitative Aptitude')!.units!;
    expect(maths.map(u => [u.name, u.questions])).toEqual([
      ['Number Systems', 5], ['Fundamental Arithmetic', 13], ['Algebra', 1], ['Geometry', 2], ['Mensuration', 1], ['Trigonometry', 1], ['Data Interpretation', 2],
    ]);
  });
});
