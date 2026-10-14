import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { exportStageSyllabus } from '@/lib/syllabus-export';

const stage = TNPSC_GROUPS.find(g => g.id === 'group-4')!.stages.find(s => s.id === 'group-4-written')!;
const exported = exportStageSyllabus(
  stage,
  'TNPSC Combined Civil Services Examination - IV (Group IV Services), Code 496, dated 12.12.2024',
);

describe('the Group 4 syllabus export', () => {
  it('matches the file handed to the backend', async () => {
    // Regenerate with `npx vitest run src/lib/syllabus-export.test.ts -u` after the
    // catalog changes, and give the backend the new file.
    await expect(JSON.stringify(exported, null, 2) + '\n').toMatchFileSnapshot('../../TNPSC_G4_SYLLABUS.json');
  });

  it('carries every unit of the printed paper', () => {
    const units = exported.sections.flatMap(s => s.units);
    // 6 General Studies + 2 Aptitude/Reasoning + 7 Tamil + 7 English.
    expect(units).toHaveLength(22);
    expect(units.every(u => u.topics.length > 0)).toBe(true);
  });

  it('lists the language subjects the server must know to place a Tamil or English paper', () => {
    // Placing a paper sends its subject, and the server refuses a subject it does not
    // have for the stage — 'general-tamil' was refused exactly this way.
    const ids = exported.subjects.map(s => s.id);
    expect(ids).toContain('general-tamil');
    expect(ids).toContain('general-english');
  });

  it('gives every unit a subject that is in the list', () => {
    const subjects = new Set(exported.subjects.map(s => s.id));
    for (const unit of exported.sections.flatMap(s => s.units)) {
      expect(unit.subject_ids.length, unit.id).toBeGreaterThan(0);
      for (const id of unit.subject_ids) expect(subjects.has(id), `${unit.id} → ${id}`).toBe(true);
    }
  });

  it('has no duplicate unit or topic ids within a unit', () => {
    const units = exported.sections.flatMap(s => s.units);
    expect(new Set(units.map(u => u.id)).size).toBe(units.length);
    for (const u of units) {
      expect(new Set(u.topics.map(t => t.id)).size, u.id).toBe(u.topics.length);
    }
  });

  it('still adds up: each unit set sums to its section', () => {
    for (const sec of exported.sections) {
      expect(sec.units.reduce((n, u) => n + u.questions, 0), sec.name).toBe(sec.questions);
    }
  });
});
