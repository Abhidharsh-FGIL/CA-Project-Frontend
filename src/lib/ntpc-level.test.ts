import { describe, expect, it } from 'vitest';
import { isNtpcGroup, ntpcLevelOf, paperIsForLevel, paperNtpcLanguage, paperNtpcLevel, papersForLevel, papersForNtpc } from './ntpc-level';

describe('ntpcLevelOf', () => {
  it('reads Under-Graduate before Graduate, whichever way it is written', () => {
    for (const t of ['Under-Graduate', 'Under Graduate', 'undergraduate', 'UG', 'RRB NTPC CBT-1 (UG) — Percentage']) expect(ntpcLevelOf(t), t).toBe('undergraduate');
    for (const t of ['Graduate', 'graduate', 'RRB NTPC CBT-2 (Graduate) — Syllogism · Mixed']) expect(ntpcLevelOf(t), t).toBe('graduate');
  });
  it('says nothing for a title with no level, or a word that merely contains one', () => {
    for (const t of ['RRB NTPC CBT-1 — Percentage · Mixed', 'Postgraduate studies', 'Argument', '', null, undefined]) expect(ntpcLevelOf(t as string), String(t)).toBeNull();
  });
});

describe('papers for a level', () => {
  const grad = { title: 'RRB NTPC CBT-1 (Graduate) — Percentage' };
  const ug = { title: 'RRB NTPC CBT-1 (UG) — Percentage' };
  const both = { title: 'RRB NTPC CBT-1 — Number System' };
  const served = { title: 'x', ntpc_level: 'undergraduate' };

  it('takes the server\'s own level before the title', () => {
    expect(paperNtpcLevel({ title: 'Graduate paper', ntpc_level: 'undergraduate' })).toBe('undergraduate');
    expect(paperNtpcLevel(served)).toBe('undergraduate');
  });
  it('shows an aspirant their level and the papers that name none', () => {
    expect(papersForLevel('graduate', [grad, ug, both, served])).toEqual([grad, both]);
    expect(papersForLevel('undergraduate', [grad, ug, both, served])).toEqual([ug, both, served]);
  });
  it('shows everything until a level is chosen', () => {
    const all = [grad, ug, both];
    expect(papersForLevel(null, all)).toBe(all);
    expect(paperIsForLevel(null, grad)).toBe(true);
  });
});

describe('isNtpcGroup', () => {
  it('is the two RRB NTPC tests only', () => {
    expect(isNtpcGroup('rrb-ntpc-cbt-1')).toBe(true);
    expect(isNtpcGroup('rrb-ntpc-cbt-2')).toBe(true);
    expect(isNtpcGroup('group-4')).toBe(false);
    expect(isNtpcGroup(undefined)).toBe(false);
  });
});

describe('language of an NTPC paper', () => {
  it('reads the head of the title, never the unit after the dash', () => {
    expect(paperNtpcLanguage({ title: 'RRB NTPC CBT-1 (Graduate · Tamil) — Percentage · Mixed' })).toBe('tamil');
    expect(paperNtpcLanguage({ title: 'RRB NTPC CBT-1 (English) — Syllogism' })).toBe('english');
    expect(paperNtpcLanguage({ title: 'RRB NTPC CBT-1 — Indian Literature: Tamil poets' })).toBeNull();
    expect(paperNtpcLanguage({ title: 'x', ntpc_language: 'english' })).toBe('english');
    expect(paperNtpcLanguage({ title: 'x', language: 'ta' })).toBe('tamil');
  });

  it('shows an aspirant papers in their language and level, and the ones that name none', () => {
    const gt = { title: 'RRB NTPC CBT-1 (Graduate · Tamil) — A' };
    const ge = { title: 'RRB NTPC CBT-1 (Graduate · English) — A' };
    const ut = { title: 'RRB NTPC CBT-1 (UG · Tamil) — A' };
    const any = { title: 'RRB NTPC CBT-1 — A' };
    expect(papersForNtpc({ level: 'graduate', language: 'tamil' }, [gt, ge, ut, any])).toEqual([gt, any]);
    expect(papersForNtpc({ level: null, language: 'english' }, [gt, ge, ut, any])).toEqual([ge, any]);
    const all = [gt, ge];
    expect(papersForNtpc({ level: null, language: null }, all)).toBe(all);
    expect(papersForNtpc(null, all)).toBe(all);
  });
});

describe('Hindi and Telugu', () => {
  it('are read from a title head or a code, and only when exactly one is named', () => {
    expect(paperNtpcLanguage({ title: 'RRB NTPC CBT-2 (Graduate · Hindi) — Percentage' })).toBe('hindi');
    expect(paperNtpcLanguage({ title: 'RRB NTPC CBT-2 (Telugu) — Percentage' })).toBe('telugu');
    expect(paperNtpcLanguage({ title: 'x', language: 'te' })).toBe('telugu');
    expect(paperNtpcLanguage({ title: 'x', ntpc_language: 'hi' })).toBe('hindi');
    expect(paperNtpcLanguage({ title: 'RRB NTPC CBT-2 (Hindi · Telugu) — Percentage' })).toBeNull();
  });

  it('keep a Hindi aspirant to Hindi papers and the ones that name no language', () => {
    const hi = { title: 'RRB NTPC CBT-1 (Hindi) — A' };
    const te = { title: 'RRB NTPC CBT-1 (Telugu) — A' };
    const en = { title: 'RRB NTPC CBT-1 (English) — A' };
    const any = { title: 'RRB NTPC CBT-1 — A' };
    expect(papersForNtpc({ level: null, language: 'hindi' }, [hi, te, en, any])).toEqual([hi, any]);
    expect(papersForNtpc({ level: null, language: 'telugu' }, [hi, te, en, any])).toEqual([te, any]);
  });
});
