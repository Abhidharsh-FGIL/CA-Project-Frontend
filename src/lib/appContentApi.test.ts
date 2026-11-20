import { describe, expect, it } from 'vitest';
import { missingPlaceholders, placeholdersOf } from './appContentApi';

describe('placeholders', () => {
  it('lists each {name} once', () => {
    expect(placeholdersOf('Hi {name}, {name}! You have {count}')).toEqual(['name', 'count']);
    expect(placeholdersOf('plain')).toEqual([]);
  });
  it('reports the ones an edit dropped', () => {
    expect(missingPlaceholders('Hello {name}, {count} left', 'Hi {name}')).toEqual(['count']);
    expect(missingPlaceholders('Hello {name}', 'Hey there {name}!')).toEqual([]);
    expect(missingPlaceholders('No placeholders', 'Anything')).toEqual([]);
  });
});
