/**
 * The bundled catalog keeps the naming; the server keeps the availability.
 *
 * These two drift. The server's GAT-B catalog still calls its first subject
 * "Physics (10+2)" where the published syllabus names it "Physics" and states
 * the level once, on the section. Taking the server's list wholesale meant its
 * wording won outright and the rename never reached the screen.
 */
import { describe, it, expect } from 'vitest';
import { mergeCatalog } from '@/lib/tnpscApi';
import { TNPSC_GROUPS, resolveSubjectId } from '@/config/tnpsc';

/** What the live server sends today: the old names, no topics. */
const serverCatalog = [
  {
    id: 'gat-b',
    name: 'GAT-B',
    stages: [
      {
        id: 'gat-b-exam',
        name: 'Graduate Aptitude Test — Biotechnology',
        pattern: {
          total_questions: 160,
          total_marks: 240,
          duration_minutes: 180,
          // The old titles, as the live server still sends them.
          sections: [
            { name: 'Section A — 10+2 Level', questions: 60, marks: 60 },
            { name: 'Section B — Graduate Level', questions: 100, marks: 180 },
          ],
        },
        subjects: [
          { id: 'physics-12', name: 'Physics (10+2)', topics: [] },
          { id: 'chemistry-12', name: 'Chemistry (10+2)', topics: [] },
          { id: 'biology-12', name: 'Biology (10+2)', topics: [] },
        ],
      },
    ],
  },
] as any;

const gatbStage = () =>
  mergeCatalog(serverCatalog, TNPSC_GROUPS)
    .find(g => g.id === 'gat-b')!
    .stages.find(st => st.id === 'gat-b-exam')!;

describe('subject naming', () => {
  it('shows the catalog’s name, not the server’s older wording', () => {
    const names = gatbStage().subjects.map(s => s.name);
    expect(names).toContain('Physics');
    expect(names).toContain('Chemistry');
    expect(names).toContain('Biology');
    expect(names.some(n => n.includes('10+2'))).toBe(false);
  });

  it('keeps the catalog’s topics where the server sent none', () => {
    const physics = gatbStage().subjects.find(s => s.id === 'physics-12')!;
    expect(physics.topics.length).toBeGreaterThan(0);
    expect(physics.topics.map(t => t.name)).toContain('Mechanics');
  });

  it('still resolves a question the backend tagged with the old name', () => {
    // The server's wording joins `aliases` rather than being discarded, so
    // nothing already tagged "Physics (10+2)" is orphaned by the rename.
    const stage = gatbStage();
    expect(resolveSubjectId(stage, 'Physics (10+2)')).toBe('physics-12');
    expect(resolveSubjectId(stage, 'Physics')).toBe('physics-12');
    expect(resolveSubjectId(stage, 'Biology 10+2')).toBe('biology-12');
  });

  it('keeps subjects the server did not send', () => {
    // Section B never appeared in the payload above; it must survive.
    const ids = gatbStage().subjects.map(s => s.id);
    expect(ids).toContain('genetics');
    expect(ids).toContain('mathematics-12');
  });

  it('passes through a subject the catalog has never heard of', () => {
    const withNew = mergeCatalog(
      [
        {
          ...serverCatalog[0],
          stages: [
            {
              ...serverCatalog[0].stages[0],
              subjects: [
                ...serverCatalog[0].stages[0].subjects,
                { id: 'nanotech', name: 'Nanotechnology', topics: [] },
              ],
            },
          ],
        },
      ] as any,
      TNPSC_GROUPS,
    );
    const stage = withNew.find(g => g.id === 'gat-b')!.stages[0];
    expect(stage.subjects.find(s => s.id === 'nanotech')?.name).toBe('Nanotechnology');
  });

  it('falls back to the catalog when the server sends no subjects at all', () => {
    const merged = mergeCatalog(
      [{ ...serverCatalog[0], stages: [{ ...serverCatalog[0].stages[0], subjects: [] }] }] as any,
      TNPSC_GROUPS,
    );
    const stage = merged.find(g => g.id === 'gat-b')!.stages[0];
    expect(stage.subjects.length).toBeGreaterThan(4);
  });
});

describe('section naming', () => {
  it('shows the catalog’s title even when the server sends its own', () => {
    const names = gatbStage().pattern!.sections.map(s => s.name);
    expect(names).toEqual(['Section A — Basic Sciences', 'Section B — Biotechnology']);
    expect(names.some(n => n.includes('10+2'))).toBe(false);
  });

  it('still matches after a rename, because the letter is the key', () => {
    // Matching on the whole name meant renaming either side broke the match and
    // the server's bare section passed through with no units and its old title.
    const secA = gatbStage().pattern!.sections.find(s => s.name.startsWith('Section A'))!;
    expect(secA.questions).toBe(60);
    // The catalog's own per-section fields survived underneath the server's.
    expect(secA.negative_mark_value).toBe(0.5);
    expect(secA.subject_ids?.length).toBeGreaterThan(0);
  });

  it('keeps the section’s choice rule from the catalog', () => {
    const secB = gatbStage().pattern!.sections.find(s => s.name.startsWith('Section B'))!;
    // 100 printed, any 60 answered — the server never sends `attempt`.
    expect(secB.attempt).toBe(60);
    expect(secB.marks_per_question).toBe(3);
  });
});
