import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { OPEN_EXAM_IDS, UPCOMING_EXAMS } from '@/lib/exam-listing';
import {
  adminCardList,
  applyCard,
  builtInLanguages,
  entryId,
  examEntries,
  legacyEntries,
  logoFileProblem,
  parseExamCards,
  slugify,
  toExamCardsBody,
  validateExamCard,
  type ExamCard,
} from '@/config/exam-cards';

const card = (over: Partial<ExamCard> = {}): ExamCard => ({
  id: 'rrb-group-d',
  name: 'RRB Group D',
  authority: 'Railway Recruitment Boards',
  tagline: '',
  description: '',
  logo_url: '',
  tone: '',
  languages: null,
  subjects: [],
  ...over,
});

describe('legacyEntries — the page before the admin saves anything', () => {
  const entries = legacyEntries(TNPSC_GROUPS, OPEN_EXAM_IDS);
  const ids = entries.map(entryId);

  it('leads with Group 4, the two RRB NTPC CBT-1 exams, then Group 2', () => {
    expect(ids.slice(0, 4)).toEqual(['group-4', 'rrb-ntpc-cbt-1', 'rrb-ntpc-cbt-1-grad', 'group-2']);
  });

  it('marks CBT-1 Graduate coming soon and the open ones open', () => {
    const state = (id: string) => entries.find(e => entryId(e) === id && e.kind === 'exam');
    expect(state('group-4')).toMatchObject({ comingSoon: false });
    expect(state('rrb-ntpc-cbt-1-grad')).toMatchObject({ comingSoon: true });
  });

  it('lists the announced exams, and ends with Group 1', () => {
    for (const e of UPCOMING_EXAMS) expect(ids).toContain(e.id);
    expect(ids[ids.length - 1]).toBe('group-1');
  });

  it('loses no catalog exam and repeats none', () => {
    expect(ids.length).toBe(TNPSC_GROUPS.length + UPCOMING_EXAMS.length);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('examEntries', () => {
  it('is the built-in page when there are no cards', () => {
    expect(examEntries(TNPSC_GROUPS, OPEN_EXAM_IDS, undefined).map(entryId)).toEqual(legacyEntries(TNPSC_GROUPS, OPEN_EXAM_IDS).map(entryId));
    expect(examEntries(TNPSC_GROUPS, OPEN_EXAM_IDS, []).map(entryId)).toEqual(legacyEntries(TNPSC_GROUPS, OPEN_EXAM_IDS).map(entryId));
  });

  it('takes its order from the cards, and shows a card with no catalog exam as announced', () => {
    const cards = [card({ id: 'rrb-group-d' }), card({ id: 'group-2', name: 'Group 2' }), card({ id: 'group-4', name: 'Group 4' })];
    const entries = examEntries(TNPSC_GROUPS, OPEN_EXAM_IDS, cards);
    expect(entries.slice(0, 3).map(entryId)).toEqual(['rrb-group-d', 'group-2', 'group-4']);
    expect(entries[0].kind).toBe('announced');
    expect(entries[1].kind).toBe('exam');
  });

  it('puts the admin’s wording over the catalog’s', () => {
    const entries = examEntries(TNPSC_GROUPS, OPEN_EXAM_IDS, [card({ id: 'group-4', name: 'TNPSC Group IV', description: 'Our words.' })]);
    const e = entries[0];
    expect(e.kind === 'exam' && e.group.name).toBe('TNPSC Group IV');
    expect(e.kind === 'exam' && e.group.description).toBe('Our words.');
  });

  it('keeps the catalog’s wording where the card leaves a field blank', () => {
    const g = TNPSC_GROUPS.find(x => x.id === 'group-4')!;
    expect(applyCard(g, card({ id: 'group-4', name: '', authority: '' }))).toMatchObject({ name: g.name, authority: g.authority });
  });

  it('still shows a catalog exam that no card names, after the cards', () => {
    const entries = examEntries(TNPSC_GROUPS, OPEN_EXAM_IDS, [card({ id: 'group-4' })]);
    expect(entries.map(entryId)).toContain('group-2');
    expect(entries.map(entryId).indexOf('group-4')).toBe(0);
  });

  it('does not bring back a built-in announced exam the admin removed', () => {
    const entries = examEntries(TNPSC_GROUPS, OPEN_EXAM_IDS, [card({ id: 'group-4' })]);
    for (const e of UPCOMING_EXAMS) expect(entries.map(entryId)).not.toContain(e.id);
  });

  it('opens a card by the exam’s Active switch, not by the card', () => {
    const open = examEntries(TNPSC_GROUPS, new Set(['group-1']), [card({ id: 'group-1' }), card({ id: 'group-4' })]);
    expect(open[0]).toMatchObject({ kind: 'exam', comingSoon: false });
    expect(open[1]).toMatchObject({ kind: 'exam', comingSoon: true });
  });
});

describe('adminCardList', () => {
  it('is the built-in page, as cards, when nothing is saved', () => {
    const list = adminCardList(undefined, TNPSC_GROUPS, OPEN_EXAM_IDS);
    expect(list.map(c => c.id)).toEqual(legacyEntries(TNPSC_GROUPS, OPEN_EXAM_IDS).map(entryId));
    expect(list.find(c => c.id === 'group-4')).toMatchObject({ name: expect.any(String), tone: 'teal', languages: ['tamil', 'english'] });
  });

  it('keeps the saved order and fills a blank field from the built-in card', () => {
    const list = adminCardList([card({ id: 'group-2', name: '', tone: '' }), card({ id: 'rrb-group-d' })], TNPSC_GROUPS, OPEN_EXAM_IDS);
    expect(list.slice(0, 2).map(c => c.id)).toEqual(['group-2', 'rrb-group-d']);
    expect(list[0].name).not.toBe('');
    expect(list[0].tone).toBe('indigo');
  });

  it('appends a catalog exam with no card, but not an announced one the admin removed', () => {
    const list = adminCardList([card({ id: 'group-4' })], TNPSC_GROUPS, OPEN_EXAM_IDS);
    expect(list.map(c => c.id)).toContain('group-2');
    for (const e of UPCOMING_EXAMS) expect(list.map(c => c.id)).not.toContain(e.id);
  });
});

describe('the wire', () => {
  it('sends each card with its position as order, blanks as null, and no other keys', () => {
    const body = toExamCardsBody([card({ id: ' a ', name: ' A ', subjects: [' x ', '', 'x', 'y'], languages: ['hindi', 'tamil'] }), card({ id: 'b', tone: 'rose' })]);
    expect(body.items[0]).toEqual({
      id: 'a',
      name: 'A',
      authority: 'Railway Recruitment Boards',
      tagline: null,
      description: null,
      logo_url: null,
      tone: null,
      languages: ['hindi', 'tamil'],
      subjects: ['x', 'y'],
      order: 1,
    });
    expect(body.items[1]).toMatchObject({ order: 2, tone: 'rose', languages: null });
    expect(Object.keys(body.items[0]).sort()).toEqual(['authority', 'description', 'id', 'languages', 'logo_url', 'name', 'order', 'subjects', 'tagline', 'tone']);
  });

  it('reads items in saved order, with odd fields emptied and rows with no id dropped', () => {
    const cards = parseExamCards({
      items: [
        { id: 'b', name: 'B', order: 2, tone: 'nope', languages: ['english', 'klingon'], subjects: ['s', 3] },
        { id: 'a', name: 'A', order: 1, authority: null, logo_url: '/uploads/a.png' },
        { name: 'no id' },
      ],
    });
    expect(cards.map(c => c.id)).toEqual(['a', 'b']);
    expect(cards[0]).toMatchObject({ authority: '', logo_url: '/uploads/a.png', languages: null, tone: '' });
    expect(cards[1]).toMatchObject({ tone: '', languages: ['english'], subjects: ['s'] });
  });

  it('reads an empty or missing answer as no cards', () => {
    expect(parseExamCards(undefined)).toEqual([]);
    expect(parseExamCards({ items: [] })).toEqual([]);
    expect(parseExamCards([])).toEqual([]);
  });

  it('round-trips', () => {
    const cards = [card({ id: 'a', tone: 'amber', languages: ['tamil'], subjects: ['x'] }), card({ id: 'b', logo_url: 'https://x/y.png' })];
    expect(parseExamCards(toExamCardsBody(cards))).toEqual(cards);
  });
});

describe('validateExamCard', () => {
  const ok = (c: ExamCard, taken: string[] = [], real = false) => validateExamCard(c, new Set(taken), real);

  it('accepts a complete announced card', () => {
    expect(ok(card({ subjects: ['Reasoning'] }))).toEqual({});
  });

  it('wants an id that is a lowercase slug and not already used', () => {
    expect(ok(card({ id: '' })).id).toBeTruthy();
    expect(ok(card({ id: 'RRB Group' })).id).toBeTruthy();
    expect(ok(card({ id: 'rrb-group-d' }), ['rrb-group-d']).id).toMatch(/already/);
  });

  it('wants a name, and an authority for an announced exam only', () => {
    expect(ok(card({ name: ' ' })).name).toBeTruthy();
    expect(ok(card({ authority: '' })).authority).toBeTruthy();
    expect(ok(card({ authority: '' }), [], true).authority).toBeUndefined();
  });

  it('holds text to the server’s limits, counting characters not bytes', () => {
    expect(ok(card({ name: 'அ'.repeat(80) })).name).toBeUndefined();
    expect(ok(card({ name: 'x'.repeat(81) })).name).toBeTruthy();
    expect(ok(card({ description: 'x'.repeat(401) })).description).toBeTruthy();
  });

  it('limits an announced exam’s subjects, and ignores them for an exam in the catalog', () => {
    expect(ok(card({ subjects: Array.from({ length: 21 }, (_, i) => `s${i}`) })).subjects).toBeTruthy();
    expect(ok(card({ id: 'group-4', subjects: Array.from({ length: 21 }, (_, i) => `s${i}`) }), [], true).subjects).toBeUndefined();
  });
});

describe('small helpers', () => {
  it('slugifies a name', () => {
    expect(slugify('IBPS Clerk / CSA')).toBe('ibps-clerk-csa');
    expect(slugify('  RRB — Group D  ')).toBe('rrb-group-d');
    expect(slugify('Law & Order')).toBe('law-and-order');
  });

  it('knows the built-in languages', () => {
    expect(builtInLanguages('rrb-ntpc-cbt-1')).toEqual(['tamil', 'english', 'hindi']);
    expect(builtInLanguages('group-4')).toEqual(['tamil', 'english']);
    expect(builtInLanguages('gat-b')).toEqual([]);
  });

  it('refuses an image that is the wrong kind or too big', () => {
    expect(logoFileProblem({ type: 'image/png', size: 1000 })).toBeNull();
    expect(logoFileProblem({ type: 'application/pdf', size: 1000 })).toMatch(/PNG/);
    expect(logoFileProblem({ type: 'image/png', size: 2 * 1024 * 1024 })).toMatch(/MB/);
  });
});
