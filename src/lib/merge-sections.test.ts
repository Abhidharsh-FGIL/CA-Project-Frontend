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
    expect(secs.find(s => s.name === 'General Studies')!.units?.length).toBe(6);
  });
});
