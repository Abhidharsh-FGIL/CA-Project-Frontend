/**
 * The Group 4 syllabus, checked against the commission's published paper —
 * "Combined Civil Services Examination – IV (Group IV Services)", Code 496,
 * dated 12.12.2024. Every figure below is printed in that PDF; if the catalog
 * drifts from it, these fail.
 */
import { describe, it, expect } from 'vitest';
import { TNPSC_GROUPS } from './tnpsc';

const stage = TNPSC_GROUPS.find(g => g.id === 'group-4')!
  .stages.find(s => s.id === 'group-4-written')!;
const sections = stage.pattern!.sections;
const section = (n: string) => sections.find(s => s.name === n)!;

describe('TNPSC Group 4 — published syllabus', () => {
  it('is one paper of 200 questions / 300 marks / 3 hours', () => {
    expect(stage.pattern!.total_questions).toBe(200);
    expect(stage.pattern!.total_marks).toBe(300);
    expect(stage.pattern!.duration_minutes).toBe(180);
  });

  it('Part A — General Studies: 6 units summing to 75', () => {
    const u = section('General Studies').units!;
    expect(u.map(x => x.questions)).toEqual([5, 5, 10, 15, 20, 20]);
    expect(u.reduce((n, x) => n + x.questions, 0)).toBe(75);
    expect(section('General Studies').questions).toBe(75);
  });

  it('Part B — Aptitude & Mental Ability: Aptitude 15 + Reasoning 10', () => {
    const u = section('Aptitude & Mental Ability').units!;
    expect(u.map(x => x.name)).toEqual(['Aptitude', 'Reasoning']);
    expect(u.map(x => x.questions)).toEqual([15, 10]);
    // The PDF lists ten aptitude items and six reasoning items.
    expect(u[0].topics).toHaveLength(10);
    expect(u[1].topics).toHaveLength(6);
  });

  it('Part C — Tamil: 7 units, split 25/15/15/10/15/5/15', () => {
    const u = section('General Tamil').units!;
    expect(u.map(x => x.questions)).toEqual([25, 15, 15, 10, 15, 5, 15]);
    expect(u.reduce((n, x) => n + x.questions, 0)).toBe(100);
  });

  it('Part C — English: 7 units, split 25/15/10/10/20/5/15', () => {
    const u = section('General English').units!;
    expect(u.map(x => x.questions)).toEqual([25, 15, 10, 10, 20, 5, 15]);
    expect(u.reduce((n, x) => n + x.questions, 0)).toBe(100);
  });

  it('every unit of every section carries its topics', () => {
    for (const sec of sections) {
      for (const unit of sec.units ?? []) {
        expect(
          (unit.topics?.length ?? 0) > 0 || (unit.subject_ids?.length ?? 0) > 0,
          `${sec.name} → ${unit.name} has neither topics nor subject_ids`,
        ).toBe(true);
      }
    }
  });

  it('the two language papers are alternatives, not additions', () => {
    expect(section('General Tamil').alternative_to).toBe('General English');
    expect(section('General English').alternative_to).toBe('General Tamil');
    // GS 75 + Aptitude 25 + one language 100 = 200, not 300.
    const nonLanguage = sections
      .filter(s => !s.alternative_to)
      .reduce((n, s) => n + s.questions, 0);
    expect(nonLanguage + 100).toBe(stage.pattern!.total_questions);
  });

  it('every unit carries its own printed topics, not a subject taxonomy', () => {
    for (const sec of sections) {
      for (const unit of sec.units ?? []) {
        expect(
          unit.topics?.length ?? 0,
          `${sec.name} → ${unit.name} has no topics of its own`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('General Studies units read from the published syllabus', () => {
    const u = section('General Studies').units!;
    const name = (i: number) => u[i].topics!.map(t => t.name);
    // Unit I's first topics are the PDF's opening clause, not "Physics, Chemistry".
    expect(name(0)[0]).toBe('Nature of Universe');
    expect(name(0)).toContain('Environmental science');
    expect(name(1)[0]).toBe('Earth location');
    expect(name(2)[0]).toBe('Indus Valley Civilization');
    expect(name(3)[0]).toBe('Constitution of India — Preamble');
    expect(name(4)[0]).toBe('Nature of Indian economy');
    expect(name(5)).toContain('Philosophical content in Thirukkural');
  });

  it('keeps subject_ids alongside, so papers still match', () => {
    const u = section('General Studies').units!;
    expect(u[0].subject_ids).toEqual(['general-science']);
    expect(u[2].subject_ids).toEqual(['history-and-culture', 'indian-national-movement']);
    expect(u[4].subject_ids).toEqual(['indian-economy', 'development-administration-tn']);
  });
});
