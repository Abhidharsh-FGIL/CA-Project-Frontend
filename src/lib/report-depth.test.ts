import { describe, it, expect } from 'vitest';
import { reportDepth, showsPanel, type ReportDepth } from '@/lib/report-depth';

/** Only the subject count matters to the fallback. */
const withSubjects = (n: number) =>
  ({ subjects: Array.from({ length: n }, (_, i) => ({ subjectId: `s${i}` })) }) as any;

describe('explicit placement decides', () => {
  it('gives a mock the full report, however else it is tagged', () => {
    expect(reportDepth({ track: 'mock' }, withSubjects(1))).toBe('full');
    expect(reportDepth({ track: 'mock', scope: 'unit' }, withSubjects(1))).toBe('full');
  });

  it('gives a unit paper the brief report even when it spans subjects', () => {
    // Group 4's Unit III covers two catalog subjects; it is still one unit.
    expect(reportDepth({ track: 'practice', scope: 'unit' }, withSubjects(2))).toBe('brief');
  });

  it('gives a section paper the section report', () => {
    expect(reportDepth({ track: 'practice', scope: 'section' }, withSubjects(6))).toBe('section');
  });

  it('reads an id when the scope itself is missing', () => {
    expect(reportDepth({ track: 'practice', unitId: 'g4-gs-indian-polity' }, withSubjects(4))).toBe(
      'brief',
    );
    expect(reportDepth({ track: 'practice', sectionName: 'General Studies' }, withSubjects(1))).toBe(
      'section',
    );
  });

  it('is not confused by case or padding', () => {
    expect(reportDepth({ track: ' MOCK ' }, withSubjects(1))).toBe('full');
    expect(reportDepth({ track: 'practice', scope: 'Section' }, withSubjects(1))).toBe('section');
  });
});

describe('falling back to the subject spread', () => {
  it('reads a one-subject practice paper as a unit set', () => {
    expect(reportDepth({ track: 'practice' }, withSubjects(1))).toBe('brief');
  });

  it('reads a multi-subject practice paper as a section set', () => {
    expect(reportDepth({ track: 'practice' }, withSubjects(5))).toBe('section');
  });

  it('can only over-deliver, never under-deliver', () => {
    // The dangerous failure is cutting a real section report down to a score.
    // A unit spanning two subjects reads as a section and gets slightly more.
    expect(reportDepth({ track: 'practice' }, withSubjects(2))).toBe('section');
  });
});

describe('an untracked attempt', () => {
  it('keeps the full report — the long-standing behaviour', () => {
    expect(reportDepth(null, withSubjects(8))).toBe('full');
    expect(reportDepth({}, withSubjects(3))).toBe('full');
  });

  it('still shortens a single-subject paper', () => {
    expect(reportDepth(null, withSubjects(1))).toBe('brief');
  });

  it('does not throw on a missing model', () => {
    expect(reportDepth(null, null)).toBe('brief');
    expect(reportDepth({ track: 'practice' }, undefined)).toBe('brief');
  });
});

describe('what each depth shows', () => {
  const depths: ReportDepth[] = ['brief', 'section', 'full'];

  it('always shows the score and the questions', () => {
    for (const d of depths) {
      expect(showsPanel(d, 'summary')).toBe(true);
      expect(showsPanel(d, 'questions')).toBe(true);
    }
  });

  it('withholds a subject breakdown from a one-unit paper', () => {
    // A single bar is not a breakdown, and presenting it as one implies a
    // comparison the paper cannot support.
    expect(showsPanel('brief', 'subjectPerformance')).toBe(false);
    expect(showsPanel('section', 'subjectPerformance')).toBe(true);
    expect(showsPanel('full', 'subjectPerformance')).toBe(true);
  });

  it('keeps the full diagnostic for full-length papers only', () => {
    expect(showsPanel('brief', 'diagnostics')).toBe(false);
    expect(showsPanel('section', 'diagnostics')).toBe(false);
    expect(showsPanel('full', 'diagnostics')).toBe(true);
  });

  it('grows monotonically — nothing is dropped as the paper gets bigger', () => {
    const panels = ['summary', 'questions', 'subjectPerformance', 'errorAnalysis', 'diagnostics'] as const;
    for (const panel of panels) {
      const shown = depths.map(d => showsPanel(d, panel));
      // Once a panel appears it never disappears at a greater depth.
      expect(shown).toEqual([...shown].sort((a, b) => Number(a) - Number(b)));
    }
  });
});
