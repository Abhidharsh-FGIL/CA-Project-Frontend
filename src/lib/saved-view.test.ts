import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSavedView, saveView } from './saved-view';

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('what the dashboard remembers', () => {
  it('is nothing for someone who has chosen nothing', () => {
    expect(loadSavedView('u1', 'group-4')).toEqual({});
  });

  it('brings back the exam, test type and range that were chosen', () => {
    saveView('u1', { group: 'group-2', forPreferred: 'group-4' });
    saveView('u1', { track: 'mock' });
    saveView('u1', { range: { key: 'custom', from: '2026-10-01', to: '2026-10-15' } });
    expect(loadSavedView('u1', 'group-4')).toEqual({
      group: 'group-2',
      forPreferred: 'group-4',
      track: 'mock',
      range: { key: 'custom', from: '2026-10-01', to: '2026-10-15' },
    });
  });

  it('keeps one account’s choices from another’s', () => {
    saveView('u1', { track: 'mock' });
    expect(loadSavedView('u2', 'group-4')).toEqual({});
  });

  it('sets the remembered exam aside when the profile’s exam has changed since', () => {
    saveView('u1', { group: 'group-4', forPreferred: 'group-4', track: 'mock' });
    // The profile now says Group 2: the pages should follow it, not the old choice.
    const view = loadSavedView('u1', 'group-2');
    expect(view.group).toBeUndefined();
    // …but the test type is not tied to the exam, and stays.
    expect(view.track).toBe('mock');
  });

  it('works the last-30-days range out again today rather than replaying old dates', () => {
    saveView('u1', { range: { key: 'month', from: '2020-01-01', to: null } });
    const range = loadSavedView('u1', 'group-4').range!;
    expect(range.key).toBe('month');
    expect(range.from).not.toBe('2020-01-01');
  });

  it('ignores anything it does not recognise', () => {
    store.set('mge.view.u1', JSON.stringify({ group: 'group-99', track: 'banana', range: { key: 'forever' } }));
    expect(loadSavedView('u1', 'group-4')).toEqual({});
    store.set('mge.view.u1', 'not json');
    expect(loadSavedView('u1', 'group-4')).toEqual({});
  });

  it('does nothing without an account, and does not throw when storage refuses', () => {
    saveView(null, { track: 'mock' });
    expect(store.size).toBe(0);
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => saveView('u1', { track: 'mock' })).not.toThrow();
    expect(loadSavedView('u1', 'group-4')).toEqual({});
  });
});
