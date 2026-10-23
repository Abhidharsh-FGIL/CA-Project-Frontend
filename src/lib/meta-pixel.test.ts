import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** The pixel reads its ID when the module loads, so each test sets it first and imports the module afresh. */
async function load(pixelId: string) {
  vi.resetModules();
  vi.stubEnv('VITE_META_PIXEL_ID', pixelId);
  return import('@/lib/meta-pixel');
}

/** What the browser would have been asked to load. */
let scripts: Array<{ src: string }>;
let win: { fbq?: any; _fbq?: any };

const calls = () => (win.fbq?.queue as unknown[][] | undefined)?.map(c => Array.from(c as ArrayLike<unknown>)) ?? [];

describe('meta pixel', () => {
  beforeEach(() => {
    scripts = [];
    win = {};
    const store = new Map<string, string>();
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', {
      createElement: () => ({ src: '', async: false }),
      head: { appendChild: (s: { src: string }) => scripts.push(s) },
    });
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does nothing without a Pixel ID', async () => {
    const px = await load('');
    px.trackPageView();
    px.trackCompleteRegistration('a@b.com');
    expect(win.fbq).toBeUndefined();
    expect(scripts).toHaveLength(0);
  });

  it("sends Meta's standard PageView and CompleteRegistration events - never a custom one", async () => {
    const px = await load('991837453988661');
    px.trackPageView();
    px.trackCompleteRegistration('a@b.com');
    expect(calls()).toContainEqual(['init', '991837453988661']);
    expect(calls()).toContainEqual(['track', 'PageView']);
    expect(calls()).toContainEqual(['track', 'CompleteRegistration']);
    expect(calls().some(c => c[0] === 'trackCustom')).toBe(false);
    expect(scripts.map(s => s.src)).toEqual(['https://connect.facebook.net/en_US/fbevents.js']);
  });

  it('counts one registration once, and a different one separately', async () => {
    const px = await load('991837453988661');
    px.trackCompleteRegistration('a@b.com');
    px.trackCompleteRegistration('A@B.com');
    px.trackCompleteRegistration('c@d.com');
    expect(calls().filter(c => c[1] === 'CompleteRegistration')).toHaveLength(2);
  });
});
