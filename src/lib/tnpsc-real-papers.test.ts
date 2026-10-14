/**
 * The practice papers as the server actually stores them — titles, sizes and `unit_ids` copied
 * from a live assessment list. The portal has to place each one from those alone, because the
 * list carries no `tnpsc_*` tags: a paper's title is the only thing that says where it belongs.
 */
import { describe, expect, it } from 'vitest';
import { findStage, stageUnits, unitDisplayName } from '@/config/tnpsc';
import { placementFromTitle } from '@/lib/tnpsc-title-placement';
import { fullSetFor } from '@/lib/tnpsc-full-set';
import type { TnpscTest } from '@/lib/tnpscApi';

const stage = findStage('group-4', 'group-4-written')!.stage;

interface Row {
  title: string;
  question_count: number;
  unit_ids: string[];
}

const FULL_SETS: Row[] = [
  {
    title: 'TNPSC Group 4 — Aptitude & Mental Ability · Full Set',
    question_count: 100,
    unit_ids: ['g4-apt-aptitude', 'g4-apt-reasoning'],
  },
  {
    title: 'TNPSC Group 4 — General Studies · Full Set',
    question_count: 100,
    unit_ids: [
      'g4-gs-general-science',
      'g4-gs-geography',
      'g4-gs-history-and-inm',
      'g4-gs-indian-polity',
      'g4-gs-economy-and-dev-admin',
      'g4-gs-tamil-nadu-history',
    ],
  },
  {
    title: 'TNPSC Group 4 — General English · Full Set',
    question_count: 100,
    unit_ids: ['g4-en-grammar', 'g4-en-vocabulary', 'g4-en-writing', 'g4-en-technical-terms', 'g4-en-comprehension', 'g4-en-translation', 'g4-en-literary-works'],
  },
  {
    title: 'TNPSC Group 4 — General Tamil · Full Set',
    question_count: 100,
    unit_ids: ['g4-ta-grammar', 'g4-ta-vocabulary', 'g4-ta-writing', 'g4-ta-technical-terms', 'g4-ta-comprehension', 'g4-ta-translation', 'g4-ta-literature'],
  },
];

const UNIT_PAPERS: Row[] = [
  { title: 'TNPSC Group 4 — History, Culture, Heritage, and Socio-Political Movements of Tamil Nadu · Mixed', question_count: 50, unit_ids: ['g4-gs-tamil-nadu-history'] },
  { title: 'TNPSC Group 4 — Indian Economy and Development Administration in Tamil Nadu · Mixed', question_count: 50, unit_ids: ['g4-gs-economy-and-dev-admin'] },
  { title: 'TNPSC Group 4 — Indian Polity · Mixed', question_count: 50, unit_ids: ['g4-gs-indian-polity'] },
  { title: 'TNPSC Group 4 — History, Culture of India, and Indian National Movement · Mixed', question_count: 25, unit_ids: ['g4-gs-history-and-inm'] },
  { title: 'TNPSC Group 4 — Geography · Mixed', question_count: 50, unit_ids: ['g4-gs-geography'] },
];

let n = 0;
const asTest = (r: Row): TnpscTest => ({
  test_id: `t${++n}`,
  source: 'assessment',
  title: r.title,
  group_id: 'group-4',
  stage_id: 'group-4-written',
  test_type: 'practice',
  level: null,
  unit_id: null,
  subject_id: null,
  subject_name: null,
  topic_id: null,
  topic_name: null,
  question_count: r.question_count,
  max_marks: r.question_count,
  time_limit_minutes: null,
  negative_marking: false,
  negative_mark_value: null,
  price: 0,
  required_tier: null,
  is_locked: false,
  lock_reason: null,
  attempts_used: 0,
  max_attempts: 3,
  best_percentage: null,
  is_completed: false,
});

describe('the stored papers resolve to the units they were built from', () => {
  it.each(UNIT_PAPERS.map(r => [r.title, r] as const))('%s', (_title, row) => {
    const placed = placementFromTitle(stage, row.title);
    expect(placed?.unit_id).toBe(row.unit_ids[0]);
  });
});

describe('the stored full sets are found for their own sections', () => {
  const tests = [...FULL_SETS, ...UNIT_PAPERS].map(asTest);

  it.each(stage.pattern!.sections.map(s => [s.name, s] as const))('%s', (name, section) => {
    const found = fullSetFor(stage, section, tests);
    expect(found?.title).toBe(`TNPSC Group 4 — ${name} · Full Set`);
  });
});

describe('every unit a full set was built from is a real unit of its section', () => {
  const known = new Map(stageUnits(stage).map(({ unit, sectionName }) => [unit.id, sectionName]));

  it.each(FULL_SETS.map(r => [r.title, r] as const))('%s', (title, row) => {
    const section = title.replace('TNPSC Group 4 — ', '').replace(' · Full Set', '');
    for (const id of row.unit_ids) expect(known.get(id), `${id} should belong to ${section}`).toBe(section);
  });

  it('the unit names the title is parsed against', () => {
    // Printed here so a mismatch with a stored title is easy to read off in a failure.
    const names = stageUnits(stage).map(({ unit }) => unitDisplayName(stage, unit));
    expect(names.length).toBeGreaterThan(0);
  });
});
