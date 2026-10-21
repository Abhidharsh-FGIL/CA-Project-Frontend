import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  api,
  apiDownload,
  getToken,
  getUserToken,
  publicApi,
  setTokens,
  setUserTokens,
  streamRequest,
  userApi,
} from '@/lib/api';
import { NETWORK_ERROR_MESSAGE, NetworkError } from '@/lib/network-error';
import { onSessionExpired, rearmSessionExpired } from '@/lib/session-bus';

/**
 * What the API client says when a request gets no usable reply — Safari's "Load failed" and its
 * cousins — and what it does to a signed-in person's tokens when that happens during a refresh.
 */

const SEND_OTP = '/api/v1/user/auth/login-otp/send';
const PROFILE = '/api/v1/user/profile';
const REFRESH = '/api/v1/user/auth/refresh';
const ADMIN_STATS = '/api/v1/admin/dashboard';
const ADMIN_REFRESH = '/api/v1/admin/auth/refresh';

let store: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;
let win: { location: { href: string } };
let told: string[];
let off: () => void;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const offline = () => Promise.reject(new TypeError('Load failed'));

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
  rearmSessionExpired('admin');
});

afterEach(() => {
  off();
  vi.unstubAllGlobals();
});

describe('a request that gets no reply', () => {
  it('is explained on the public client — the login screen\'s own calls', async () => {
    fetchMock.mockImplementation(offline);
    const error = (await publicApi.post(SEND_OTP, { identifier: 'a@b.co' }).catch(e => e)) as Error;
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('is explained whatever the browser calls it', async () => {
    for (const wording of ['Load failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.']) {
      fetchMock.mockImplementation(() => Promise.reject(new TypeError(wording)));
      const error = (await publicApi.post(SEND_OTP, {}).catch(e => e)) as Error;
      expect(error.message, wording).toBe(NETWORK_ERROR_MESSAGE);
    }
  });

  it('is explained on the student client', async () => {
    setUserTokens('t', 'r');
    fetchMock.mockImplementation(offline);
    await expect(userApi.get(PROFILE)).rejects.toThrow(NETWORK_ERROR_MESSAGE);
  });

  it('is explained on the admin client, the download helper and the stream helper', async () => {
    setTokens('t', 'r');
    fetchMock.mockImplementation(offline);
    await expect(api.get(ADMIN_STATS)).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    await expect(apiDownload(ADMIN_STATS)).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    const streamed = await new Promise<Error>(resolve => streamRequest(ADMIN_STATS, {}, () => {}, undefined, resolve));
    expect(streamed.message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('is not mistaken for a lapsed session', async () => {
    setUserTokens('t', 'r');
    rearmSessionExpired('user');
    fetchMock.mockImplementation(offline);
    await userApi.get(PROFILE).catch(() => {});
    expect(told).toEqual([]);
    expect(win.location.href).toBe('');
    expect(getUserToken()).toBe('t');
  });
});

describe('a server that does answer', () => {
  it('is still read: its own message reaches the person', async () => {
    fetchMock.mockResolvedValue(json(400, { success: false, error_code: 'BAD_REQUEST', message: 'Invalid or expired OTP' }));
    await expect(publicApi.post('/api/v1/user/auth/login-otp/verify', {})).rejects.toThrow('Invalid or expired OTP');
  });

  it('is still read when it is the 429 for asking for a code too soon', async () => {
    fetchMock.mockResolvedValue(json(429, { message: 'Please wait 42 seconds before requesting a new OTP' }));
    await expect(publicApi.post(SEND_OTP, {})).rejects.toThrow('Please wait 42 seconds before requesting a new OTP');
  });
});

describe('a refresh that cannot be made', () => {
  const expired = (url: string) => !url.endsWith(REFRESH) && !url.endsWith(ADMIN_REFRESH);

  it('keeps a student signed in when the refresh gets no reply', async () => {
    setUserTokens('old', 'old-r');
    rearmSessionExpired('user');
    fetchMock.mockImplementation(async (url: string) => (expired(url) ? json(401, { message: 'expired' }) : offline()));
    await expect(userApi.get(PROFILE)).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    expect(getUserToken()).toBe('old');
    expect(store.get('user_refresh_token')).toBe('old-r');
    expect(told).toEqual([]);
    expect(win.location.href).toBe('');
  });

  it('keeps a student signed in when the refresh hits a server error', async () => {
    setUserTokens('old', 'old-r');
    rearmSessionExpired('user');
    fetchMock.mockImplementation(async (url: string) =>
      expired(url) ? json(401, { message: 'expired' }) : json(500, { message: 'Internal Server Error' }),
    );
    await expect(userApi.get(PROFILE)).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    expect(getUserToken()).toBe('old');
    expect(told).toEqual([]);
  });

  it('can be tried again once the connection is back', async () => {
    setUserTokens('old', 'old-r');
    rearmSessionExpired('user');
    let online = false;
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const auth = (init?.headers as Record<string, string> | undefined)?.Authorization;
      if (url.endsWith(REFRESH)) return online ? json(200, { access_token: 'fresh', refresh_token: 'fresh-r' }) : offline();
      return auth === 'Bearer fresh' ? json(200, { name: 'Aravindh' }) : json(401, { message: 'expired' });
    });
    await expect(userApi.get(PROFILE)).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    online = true;
    await expect(userApi.get(PROFILE)).resolves.toEqual({ name: 'Aravindh' });
    expect(getUserToken()).toBe('fresh');
  });

  it('still ends the session when the server refuses the refresh', async () => {
    setUserTokens('old', 'old-r');
    rearmSessionExpired('user');
    fetchMock.mockImplementation(async () => json(401, { message: 'refresh token expired' }));
    const error = (await userApi.get(PROFILE).catch(e => e)) as Error;
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Session expired');
    expect(told).toEqual(['user']);
    expect(getUserToken()).toBeNull();
  });

  it('keeps an admin signed in when the refresh gets no reply', async () => {
    setTokens('adm', 'adm-r');
    rearmSessionExpired('admin');
    fetchMock.mockImplementation(async (url: string) => (expired(url) ? json(401, { message: 'expired' }) : offline()));
    await expect(api.get(ADMIN_STATS)).rejects.toThrow(NETWORK_ERROR_MESSAGE);
    expect(getToken()).toBe('adm');
    expect(told).toEqual([]);
  });

  it('shares the failure between calls that were all waiting on one refresh', async () => {
    setUserTokens('old', 'old-r');
    rearmSessionExpired('user');
    fetchMock.mockImplementation(async (url: string) => (expired(url) ? json(401, { message: 'expired' }) : offline()));
    const calls = await Promise.allSettled([userApi.get(PROFILE), userApi.get(PROFILE), userApi.get(PROFILE)]);
    expect(calls.map(c => c.status)).toEqual(['rejected', 'rejected', 'rejected']);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith(REFRESH))).toHaveLength(1);
    expect(getUserToken()).toBe('old');
  });
});
