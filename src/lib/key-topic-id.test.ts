import { describe, expect, it } from 'vitest';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { isUnknownTopicError, topicIdForUnit } from './tnpscAdminApi';

const stage = TNPSC_GROUPS.find(g => g.id === 'group-4')!.stages[0];

describe('topicIdForUnit — a key topic is the one its own unit prints', () => {
  it('gives "Figures of speech" the id of the unit it is filed under, not the first one with that name', () => {
    // Printed twice: a Vocabulary topic and a Literary Works topic, with different ids.
    expect(topicIdForUnit(stage, 'g4-en-vocabulary', 'Figures of speech')).toBe('figures-of-speech');
    expect(topicIdForUnit(stage, 'g4-en-literary-works', 'Figures of speech')).toBe('en-figures-of-speech');
  });

  it('leaves a value that is already one of the unit’s ids alone', () => {
    expect(topicIdForUnit(stage, 'g4-en-literary-works', 'en-figures-of-speech')).toBe('en-figures-of-speech');
    expect(topicIdForUnit(stage, 'g4-en-vocabulary', 'synonyms')).toBe('synonyms');
  });

  it('matches the name loosely: case and spacing do not matter', () => {
    expect(topicIdForUnit(stage, 'g4-en-literary-works', '  FIGURES   of speech ')).toBe('en-figures-of-speech');
  });

  it('passes on, unchanged, a topic the unit does not list, and has nothing for no topic', () => {
    expect(topicIdForUnit(stage, 'g4-en-literary-works', 'Something the syllabus does not print')).toBe(
      'Something the syllabus does not print',
    );
    expect(topicIdForUnit(stage, 'g4-en-literary-works', null)).toBeNull();
    expect(topicIdForUnit(stage, 'g4-en-literary-works', '')).toBeNull();
  });

  it('with no known unit it passes the value on for the server to judge', () => {
    expect(topicIdForUnit(stage, null, 'Figures of speech')).toBe('Figures of speech');
    expect(topicIdForUnit(stage, 'no-such-unit', 'Figures of speech')).toBe('Figures of speech');
  });
});

describe('isUnknownTopicError', () => {
  it('treats a topic printed under another unit as a topic refusal, so the paper still gets placed', () => {
    const e = { message: "Topic 'figures-of-speech' is printed under unit 'g4-en-vocabulary', not 'g4-en-literary-works'." };
    expect(isUnknownTopicError(e)).toBe(true);
    expect(isUnknownTopicError({ code: 'TOPIC_NOT_IN_UNIT' })).toBe(true);
  });

  it('still recognises the older refusals, and not unrelated errors', () => {
    expect(isUnknownTopicError({ message: "Subject 'x' has no topic 'y'" })).toBe(true);
    expect(isUnknownTopicError({ code: 'TNPSC_TOPIC_MISMATCH' })).toBe(true);
    expect(isUnknownTopicError({ message: 'Network error' })).toBe(false);
  });
});
