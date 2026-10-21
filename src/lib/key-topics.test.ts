import { describe, expect, it } from 'vitest';
import { findStage, findUnit, unitTopics } from '@/config/tnpsc';
import { bankTopicCounts, chaptersForTopic, questionInTopic } from '@/lib/key-topics';

const stage = findStage('group-4', 'group-4-written')!.stage;
const unit = findUnit(stage, 'g4-gs-indian-polity')!;
const topics = unitTopics(stage, unit);
const rights = topics.find(t => t.id === 'citizenship-rights-duties')!;
const dpsp = topics.find(t => t.id === 'directive-principles')!;

const q = (chapter: string, subject = 'Indian Polity') => ({ subject, chapter });

describe('questionInTopic', () => {
  it('matches the chapter to the printed topic by name, however it is punctuated', () => {
    expect(questionInTopic(q('Citizenship, Fundamental Rights and Fundamental Duties'), rights)).toBe(true);
    expect(questionInTopic(q('citizenship fundamental rights & fundamental duties'), rights)).toBe(true);
  });

  it('matches by the topic id spelled out', () => {
    expect(questionInTopic(q('Directive Principles'), dpsp)).toBe(true);
    expect(questionInTopic(q('directive principles of state policy'), dpsp)).toBe(true);
  });

  it('reads a topic or subtopic when there is no chapter', () => {
    expect(questionInTopic({ subject: 'Indian Polity', topic: 'Directive Principles of State Policy' }, dpsp)).toBe(true);
  });

  it('reads the piece after a dash, as "Group – Topic" labels are written', () => {
    expect(questionInTopic(q('Polity – Directive Principles of State Policy'), dpsp)).toBe(true);
  });

  it('is not another topic', () => {
    expect(questionInTopic(q('Directive Principles of State Policy'), rights)).toBe(false);
    expect(questionInTopic(q(''), rights)).toBe(false);
    expect(questionInTopic({}, rights)).toBe(false);
  });
});

describe('bankTopicCounts', () => {
  const bank = [
    q('Citizenship, Fundamental Rights and Fundamental Duties'),
    q('Citizenship, Fundamental Rights and Fundamental Duties'),
    q('Directive Principles of State Policy'),
    // Same chapter name, but not an Indian Polity question: not this unit's.
    q('Citizenship, Fundamental Rights and Fundamental Duties', 'Geography'),
  ];

  it('counts what the bank can supply per topic of the unit', () => {
    const counts = bankTopicCounts(stage, unit, bank);
    expect(counts['citizenship-rights-duties']).toBe(2);
    expect(counts['directive-principles']).toBe(1);
  });

  it('lists every topic of the unit, with 0 where the bank has nothing', () => {
    const counts = bankTopicCounts(stage, unit, bank);
    expect(Object.keys(counts).sort()).toEqual(topics.map(t => t.id).sort());
    expect(counts['union-state-ut']).toBe(0);
  });

  it('is empty without a stage or unit', () => {
    expect(bankTopicCounts(undefined, unit, bank)).toEqual({});
    expect(bankTopicCounts(stage, undefined, bank)).toEqual({});
  });
});

describe('chaptersForTopic', () => {
  it("gives the chapters as the bank spells them, once each", () => {
    const bank = [q('Citizenship, Fundamental Rights and Fundamental Duties'), q('citizenship fundamental rights fundamental duties'), q('Other')];
    expect(chaptersForTopic(bank, rights).sort()).toEqual([
      'Citizenship, Fundamental Rights and Fundamental Duties',
      'citizenship fundamental rights fundamental duties',
    ]);
  });

  it('is empty when no chapter names the topic', () => {
    expect(chaptersForTopic([q('Other')], rights)).toEqual([]);
  });
});
