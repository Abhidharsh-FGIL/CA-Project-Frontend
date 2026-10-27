import { afterEach, describe, expect, it, vi } from 'vitest';
import { createUpdateStore, fetchServedBuild, reloadForUpdate } from '@/lib/app-version';

afterEach(() => vi.unstubAllGlobals());

describe('the update store', () => {
  it('notices a different build, and ignores the same one, a missing one and an empty one', () => {
    const s = createUpdateStore('abc-1');
    s.note('abc-1');
    s.note(null);
    s.note('');
    expect(s.newer()).toBeNull();
    s.note('def-2');
    expect(s.newer()).toBe('def-2');
  });

  it('never offers an update while developing or testing', () => {
    const s = createUpdateStore('dev');
    s.note('def-2');
    expect(s.enabled).toBe(false);
    expect(s.newer()).toBeNull();
  });

  it('tells listeners when a newer build is seen, once, and when a hold starts and ends', () => {
    const s = createUpdateStore('abc-1');
    const listener = vi.fn();
    s.subscribe(listener);
    s.note('def-2');
    s.note('def-2');
    expect(listener).toHaveBeenCalledTimes(1);
    const release = s.hold();
    release();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('holds overlap: the page stays held until every hold is released, and releasing twice does nothing extra', () => {
    const s = createUpdateStore('abc-1');
    const a = s.hold();
    const b = s.hold();
    expect(s.held()).toBe(true);
    a();
    a();
    expect(s.held()).toBe(true);
    b();
    expect(s.held()).toBe(false);
  });
});

describe('reading version.json', () => {
  it('returns the deployed build key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ build: 'def-2', builtAt: 'x' }))));
    await expect(fetchServedBuild()).resolves.toBe('def-2');
  });

  it('returns null when it cannot be read: offline, not found, or a dev server answering with a web page', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    await expect(fetchServedBuild()).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>')));
    await expect(fetchServedBuild()).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(fetchServedBuild()).resolves.toBeNull();
  });

  it('asks without the cache, with a fresh query each time', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ build: 'a' })));
    vi.stubGlobal('fetch', f);
    await fetchServedBuild();
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/version\.json\?t=\d+/);
    expect(init.cache).toBe('no-store');
  });
});

describe('reloading', () => {
  it('reloads once for a given build, and refuses a second time so a stale cache cannot loop', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
    const reload = vi.fn();
    expect(reloadForUpdate('def-2', reload)).toBe(true);
    expect(reloadForUpdate('def-2', reload)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(reloadForUpdate('ghi-3', reload)).toBe(true);
  });
});
