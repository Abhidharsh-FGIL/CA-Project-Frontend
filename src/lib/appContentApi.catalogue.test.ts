import { describe, expect, it } from 'vitest';
import { SAMPLE_CATALOGUE, parseCatalogueFile } from './appContentApi';

describe('parseCatalogueFile', () => {
  it('accepts the sample, as { entries } or a bare list', () => {
    const a = parseCatalogueFile(JSON.stringify(SAMPLE_CATALOGUE));
    expect(a.problems).toEqual([]);
    expect(a.entries).toHaveLength(2);
    expect(parseCatalogueFile(JSON.stringify(SAMPLE_CATALOGUE.entries)).entries).toHaveLength(2);
  });
  it('rejects what the server would', () => {
    expect(parseCatalogueFile('nope').problems[0]).toMatch(/not a JSON/);
    expect(parseCatalogueFile('{"a":1}').problems[0]).toMatch(/Expected/);
    expect(parseCatalogueFile('{"entries":[]}').problems).toContain('The list is empty.');
    const dup = parseCatalogueFile(JSON.stringify({ entries: [{ key: 'a', text: 'x', group: 'G' }, { key: 'a', text: 'y', group: 'G' }] }));
    expect(dup.problems.join()).toMatch(/more than once/);
    const bad = parseCatalogueFile(JSON.stringify({ entries: [{ key: 'a', text: 'x' }, { text: 'y', group: 'G' }, { key: 'c', text: 'x'.repeat(4001), group: 'G' }, { key: 'd', text: 'x', group: 'g'.repeat(81) }] }));
    expect(bad.problems).toHaveLength(4);
  });
});
