import { describe, it, expect } from 'vitest';
import { mergeCatalog } from '@/lib/tnpscApi';
import { TNPSC_GROUPS } from '@/config/tnpsc';

describe('mergeSections — combined language section', () => {
  it('expands the server\'s combined section into the bundled split, keeping units', () => {
    // What the live server sends today: the language paper as one section, no units.
    const server = [{
      id: 'group-4', name: 'TNPSC Group 4', stages: [{
        id: 'group-4-written', name: 'Written Examination',
        subjects: [],
        pattern: {
          total_questions: 200, total_marks: 300, duration_minutes: 180,
          sections: [
            { name: 'General Tamil / General English', questions: 100 },
            { name: 'General Studies', questions: 75 },
            { name: 'Aptitude & Mental Ability', questions: 25 },
          ],
        },
      }],
    }] as any;

    const merged = mergeCatalog(server, TNPSC_GROUPS);
    const secs = merged.find(g => g.id === 'group-4')!.stages
      .find(s => s.id === 'group-4-written')!.pattern!.sections;

    const names = secs.map(s => s.name);
    expect(names).toContain('General Tamil');
    expect(names).toContain('General English');
    expect(names).not.toContain('General Tamil / General English');

    const ta = secs.find(s => s.name === 'General Tamil')!;
    const en = secs.find(s => s.name === 'General English')!;
    expect(ta.units?.length).toBe(7);
    expect(en.units?.length).toBe(7);
    expect(ta.questions).toBe(100);
    expect(en.questions).toBe(100);
    // English's published split differs from Tamil's.
    expect(en.units!.map(u => u.questions)).toEqual([25, 15, 10, 10, 20, 5, 15]);
    expect(secs.find(s => s.name === 'General Studies')!.units?.length).toBe(7);
  });
});

describe('mergeCatalog — a server that lists Group 2 without the language paper', () => {
  const server = [
    {
      id: 'group-2',
      name: 'TNPSC Group 2',
      stages: [
        {
          id: 'group-2-prelims',
          pattern: {
            sections: [
              { name: 'General Studies', questions: 175 },
              { name: 'Aptitude & Mental Ability', questions: 25 },
            ],
          },
        },
      ],
    },
  ] as any;

  it('keeps General Tamil and General English, ahead of the sections the server sent', () => {
    const merged = mergeCatalog(server, TNPSC_GROUPS);
    const names = merged.find(g => g.id === 'group-2')!.stages[0].pattern!.sections.map(s => s.name);
    expect(names).toEqual(['General Tamil', 'General English', 'General Studies', 'Aptitude & Mental Ability']);
  });

  it('leaves them as an either-or pair, each with its units', () => {
    const sections = mergeCatalog(server, TNPSC_GROUPS).find(g => g.id === 'group-2')!.stages[0].pattern!.sections;
    expect(sections.find(s => s.name === 'General Tamil')).toMatchObject({ alternative_to: 'General English' });
    expect(sections.find(s => s.name === 'General Tamil')!.units!.length).toBeGreaterThan(0);
  });

  it('does not change what Group 4 gets from a server that sends the pair combined', () => {
    const g4 = [
      {
        id: 'group-4',
        name: 'TNPSC Group 4',
        stages: [
          {
            id: 'group-4-written',
            pattern: {
              sections: [
                { name: 'General Tamil / General English', questions: 100 },
                { name: 'General Studies', questions: 75 },
                { name: 'Aptitude & Mental Ability', questions: 25 },
              ],
            },
          },
        ],
      },
    ] as any;
    const names = mergeCatalog(g4, TNPSC_GROUPS).find(g => g.id === 'group-4')!.stages[0].pattern!.sections.map(s => s.name);
    expect(names).toEqual(['General Tamil', 'General English', 'General Studies', 'Aptitude & Mental Ability']);
  });
});
