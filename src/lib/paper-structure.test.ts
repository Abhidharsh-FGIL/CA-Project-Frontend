import { describe, expect, it } from 'vitest';
import { paperStructure } from '@/lib/paper-structure';
import { findStage } from '@/config/tnpsc';
import type { TnpscExamPattern } from '@/config/tnpsc';

const pattern = (sections: TnpscExamPattern['sections']): TnpscExamPattern => ({
  total_questions: 0,
  total_marks: 0,
  duration_minutes: 0,
  negative_marking: false,
  sections,
});

describe('paperStructure', () => {
  it('lists each section with its question count', () => {
    expect(
      paperStructure(pattern([
        { name: 'General Studies', questions: 75 },
        { name: 'Aptitude', questions: 25 },
      ])),
    ).toEqual([
      { label: 'General Studies', questions: 75 },
      { label: 'Aptitude', questions: 25 },
    ]);
  });

  it('shows a language pair once — the candidate sits one, not both', () => {
    const rows = paperStructure(pattern([
      { name: 'General Tamil', questions: 100, alternative_to: 'General English' },
      { name: 'General English', questions: 100, alternative_to: 'General Tamil' },
      { name: 'General Studies', questions: 75 },
    ]));
    expect(rows).toEqual([
      { label: 'General Tamil / General English', questions: 100 },
      { label: 'General Studies', questions: 75 },
    ]);
  });

  it('keeps a section whose named alternative is not in the paper', () => {
    expect(
      paperStructure(pattern([{ name: 'General Tamil', questions: 100, alternative_to: 'Gone' }])),
    ).toEqual([{ label: 'General Tamil', questions: 100 }]);
  });

  it('returns nothing for a stage without a published pattern', () => {
    expect(paperStructure(undefined)).toEqual([]);
  });

  it('adds up to the paper for Group 4 — 100 + 75 + 25 = 200', () => {
    const stage = findStage('group-4', 'group-4-written')!.stage;
    const rows = paperStructure(stage.pattern);
    expect(rows.map(r => r.label)).toEqual([
      'General Tamil / General English',
      'General Studies',
      'Aptitude & Mental Ability',
    ]);
    expect(rows.reduce((n, r) => n + r.questions, 0)).toBe(stage.pattern!.total_questions);
  });
});
