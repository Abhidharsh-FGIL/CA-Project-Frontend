import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserToken, setUserTokens } from '@/lib/api';
import { logoutUser } from '@/lib/userAuthApi';

/**
 * Signing out must forget the tokens at once. The landing page sends anyone who still has a token to the
 * dashboard, so a token that lingered until the server replied turned the first press of Logout into a bounce.
 */

let store: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', { location: { href: '' } });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  setUserTokens('tok', 'ref');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('logoutUser', () => {
  it('has the browser signed out before the server has answered', async () => {
    let answer!: (r: Response) => void;
    fetchMock.mockReturnValue(new Promise<Response>(resolve => (answer = resolve)));

    const done = logoutUser();
    expect(getUserToken()).toBeNull();
    expect(store.has('user_refresh_token')).toBe(false);

    answer(new Response(JSON.stringify({ message: 'ok', success: true }), { status: 200 }));
    await expect(done).resolves.toEqual({ message: 'ok', success: true });
  });

  it('still tells the server, with the token it had', async () => {
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await logoutUser();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/v1/user/auth/logout');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
  });

  it('leaves the person signed out when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Load failed'));
    await expect(logoutUser()).rejects.toThrow();
    expect(getUserToken()).toBeNull();
  });
});
