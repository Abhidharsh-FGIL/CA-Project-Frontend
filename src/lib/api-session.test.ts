import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, getToken, getUserToken, setTokens, setUserTokens, userApi } from '@/lib/api';
import { onSessionExpired, rearmSessionExpired } from '@/lib/session-bus';

/**
 * What the API client does when a signed-in person's token stops working.
 *
 * `fetch`, `localStorage` and `window` are stood in for, so the client runs as it does in the
 * browser: a token is refused, the refresh is tried, and the person is either carried on or told.
 */

const PROFILE = '/api/v1/user/profile';
const REFRESH = '/api/v1/user/auth/refresh';
const LOGOUT = '/api/v1/user/auth/logout';
const ADMIN_STATS = '/api/v1/admin/dashboard';
const ADMIN_REFRESH = '/api/v1/admin/auth/refresh';

let store: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;
let win: { location: { href: string } };
let told: string[];
let off: () => void;

/** A server whose access tokens have all expired; `refresh` says what its refresh endpoint answers. */
function serve(refresh: 'refuse' | 'accept') {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    if (url.endsWith(REFRESH)) {
      return refresh === 'accept'
        ? new Response(JSON.stringify({ access_token: 'fresh', refresh_token: 'fresh-r' }), { status: 200 })
        : new Response(JSON.stringify({ message: 'refresh token expired' }), { status: 401 });
    }
    if (auth === 'Bearer fresh') return new Response(JSON.stringify({ name: 'Aravindh' }), { status: 200 });
    return new Response(JSON.stringify({ message: 'Token expired' }), { status: 401 });
  });
}

const refreshCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith(REFRESH)).length;

/** The same, for the admin portal: every access token has expired. */
function serveAdmin(refresh: 'refuse' | 'accept') {
  fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
    const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
    if (url.endsWith(ADMIN_REFRESH)) {
      return refresh === 'accept'
        ? new Response(JSON.stringify({ access_token: 'fresh', refresh_token: 'fresh-r' }), { status: 200 })
        : new Response(JSON.stringify({ message: 'refresh token expired' }), { status: 401 });
    }
    if (auth === 'Bearer fresh') return new Response(JSON.stringify({ users: 3 }), { status: 200 });
    return new Response(JSON.stringify({ message: 'Token expired' }), { status: 401 });
  });
}
const adminRefreshCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).endsWith(ADMIN_REFRESH)).length;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  win = { location: { href: '' } };
  vi.stubGlobal('window', win);
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  told = [];
  off = onSessionExpired(portal => told.push(portal));
  rearmSessionExpired('user');
});

afterEach(() => {
  off();
  vi.unstubAllGlobals();
});

describe('a signed-in person whose token and refresh have both lapsed', () => {
  beforeEach(() => {
    setUserTokens('old', 'old-r');
    rearmSessionExpired('user');
    serve('refuse');
  });

  it('is told the session expired, and is not redirected behind the popup', async () => {
    await expect(userApi.get(PROFILE)).rejects.toThrow('Session expired');
    expect(told).toEqual(['user']);
    expect(win.location.href).toBe('');
  });

  it('gets an error marked handled, so no second message is toasted', async () => {
    const error = await userApi.get(PROFILE).catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).handled).toBe(true);
  });

  it('is signed out: the tokens are gone', async () => {
    await userApi.get(PROFILE).catch(() => {});
    expect(getUserToken()).toBeNull();
    expect(store.has('user_refresh_token')).toBe(false);
  });

  it('is told once however many calls the page had in flight', async () => {
    const calls = await Promise.allSettled([userApi.get(PROFILE), userApi.get(PROFILE), userApi.get(PROFILE)]);
    expect(calls.every(c => c.status === 'rejected')).toBe(true);
    expect(told).toEqual(['user']);
  });

  it('is told again after signing in and lapsing a second time', async () => {
    await userApi.get(PROFILE).catch(() => {});
    setUserTokens('old-2', 'old-r2'); // signing in again
    await userApi.get(PROFILE).catch(() => {});
    expect(told).toEqual(['user', 'user']);
  });

  it('is not told when logging out with a lapsed token', async () => {
    await expect(userApi.post(LOGOUT)).rejects.toThrow('Session expired');
    expect(told).toEqual([]);
    expect(win.location.href).toContain('#/user/login');
  });
});

describe('a token that has expired but can be refreshed', () => {
  it('carries on with the new token and says nothing', async () => {
    setUserTokens('old', 'old-r');
    serve('accept');
    await expect(userApi.get(PROFILE)).resolves.toEqual({ name: 'Aravindh' });
    expect(told).toEqual([]);
    expect(getUserToken()).toBe('fresh');
  });

  it('shares one refresh between the calls that all found the token expired', async () => {
    setUserTokens('old', 'old-r');
    serve('accept');
    const all = await Promise.all([userApi.get(PROFILE), userApi.get(PROFILE), userApi.get(PROFILE)]);
    expect(all).toHaveLength(3);
    expect(refreshCalls()).toBe(1);
  });

  it('can be refreshed again later: the shared refresh is not kept past its answer', async () => {
    setUserTokens('old', 'old-r');
    serve('accept');
    await userApi.get(PROFILE);
    setUserTokens('old-2', 'old-r2');
    await userApi.get(PROFILE);
    expect(refreshCalls()).toBe(2);
  });
});

describe('someone who was never signed in', () => {
  it('is sent to the login page, with no popup about a session they never had', async () => {
    serve('refuse');
    await expect(userApi.get(PROFILE)).rejects.toThrow('Session expired');
    expect(told).toEqual([]);
    expect(win.location.href).toContain('#/user/login');
  });
});

describe('with nothing listening for the popup', () => {
  it('still sends a signed-in person to the login page', async () => {
    off();
    setUserTokens('old', 'old-r');
    serve('refuse');
    await expect(userApi.get(PROFILE)).rejects.toThrow('Session expired');
    expect(win.location.href).toContain('#/user/login');
  });
});

describe('the admin portal', () => {
  beforeEach(() => {
    rearmSessionExpired('admin');
  });

  it('tells an admin whose token and refresh have lapsed, once, without a redirect behind the popup', async () => {
    setTokens('adm', 'adm-r');
    rearmSessionExpired('admin');
    serveAdmin('refuse');
    const calls = await Promise.allSettled([api.get(ADMIN_STATS), api.get(ADMIN_STATS), api.get(ADMIN_STATS)]);
    expect(calls.every(c => c.status === 'rejected')).toBe(true);
    expect(told).toEqual(['admin']);
    expect(win.location.href).toBe('');
    expect(getToken()).toBeNull();
  });

  it('marks that error handled, so it is not toasted on top of the popup', async () => {
    setTokens('adm', 'adm-r');
    rearmSessionExpired('admin');
    serveAdmin('refuse');
    const error = await api.get(ADMIN_STATS).catch(e => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).handled).toBe(true);
  });

  it('shares one refresh between the calls that all found the token expired', async () => {
    setTokens('adm', 'adm-r');
    serveAdmin('accept');
    const all = await Promise.all([api.get(ADMIN_STATS), api.get(ADMIN_STATS), api.get(ADMIN_STATS)]);
    expect(all).toHaveLength(3);
    expect(adminRefreshCalls()).toBe(1);
    expect(told).toEqual([]);
  });

  it('sends someone who was never signed in to the admin login, with no popup', async () => {
    serveAdmin('refuse');
    await expect(api.get(ADMIN_STATS)).rejects.toThrow('Session expired');
    expect(told).toEqual([]);
    expect(win.location.href).toContain('#/adminlogin');
  });

  it('keeps an admin lapse apart from a student one', async () => {
    setTokens('adm', 'adm-r');
    rearmSessionExpired('admin');
    serveAdmin('refuse');
    await api.get(ADMIN_STATS).catch(() => {});
    expect(told).toEqual(['admin']);
    expect(told).not.toContain('user');
  });
});
